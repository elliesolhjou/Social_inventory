/**
 * backfill_embeddings.ts
 *
 * One-time script to generate CLIP embeddings for all existing items
 * that have images (thumbnail_url or media_urls) but no embedding.
 *
 * Usage:
 *   npx tsx scripts/backfill_embeddings.ts
 *
 * Requires: HF_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * in .env.local (loaded via dotenv)
 */

import "dotenv/config";

const HF_MODEL = "openai/clip-vit-base-patch32";
const HF_API_BASE =
  "https://api-inference.huggingface.co/pipeline/feature-extraction";
const RATE_LIMIT_MS = 300; // ms between requests to avoid HF rate limits

async function generateEmbedding(imageUrl: string): Promise<number[]> {
  // Fetch the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }
  const imageBuffer = await imageResponse.arrayBuffer();

  // Generate embedding via CLIP
  const response = await fetch(`${HF_API_BASE}/${HF_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      "Content-Type": "application/octet-stream",
    },
    body: Buffer.from(imageBuffer),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HF API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return Array.isArray(result[0]) ? result[0] : result;
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find items with images but no embedding
  const { data: items, error } = await supabase
    .from("items")
    .select("id, title, thumbnail_url, media_urls")
    .is("image_embedding", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch items:", error);
    process.exit(1);
  }

  // Filter to items that actually have an image URL
  const itemsWithImages = (items ?? []).filter(
    (item) => item.thumbnail_url || (item.media_urls && item.media_urls.length > 0)
  );

  console.log(
    `Found ${items?.length ?? 0} items without embeddings, ${itemsWithImages.length} have images`
  );

  let success = 0;
  let failed = 0;

  for (const item of itemsWithImages) {
    const imageUrl = item.thumbnail_url || item.media_urls?.[0];
    if (!imageUrl) continue;

    try {
      console.log(`[${success + failed + 1}/${itemsWithImages.length}] ${item.title}...`);
      const embedding = await generateEmbedding(imageUrl);

      const { error: updateError } = await supabase
        .from("items")
        .update({ image_embedding: JSON.stringify(embedding) })
        .eq("id", item.id);

      if (updateError) {
        console.error(`  ✗ Failed to store: ${updateError.message}`);
        failed++;
      } else {
        console.log(`  ✓ Stored ${embedding.length}-dim embedding`);
        success++;
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    } catch (err: any) {
      console.error(`  ✗ ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}

main();
