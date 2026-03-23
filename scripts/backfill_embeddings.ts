/**
 * backfill_embeddings.ts
 *
 * Generate Gemini embeddings for all existing items that have
 * images (thumbnail_url or media_urls) but no embedding yet.
 *
 * Pipeline: image URL -> Gemini vision describes it -> gemini-embedding-001 -> 768-dim vector
 *
 * Usage:
 *   npx tsx scripts/backfill_embeddings.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const VISION_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
const EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
const RATE_LIMIT_MS = 1000; // 1s between items to avoid rate limits

async function describeImage(imageUrl: string, apiKey: string): Promise<string> {
  // Fetch the image and convert to base64
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const base64Data = buffer.toString('base64');

  const response = await fetch(`${VISION_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
          { text: 'Describe this item in detail for a search index. Include: what it is, brand/model if visible, color, material, condition, size, and any distinguishing features. Be specific and factual. Write a single dense paragraph, no bullet points.' },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vision error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const description = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!description) {
    const reason = data?.candidates?.[0]?.finishReason;
    throw new Error(`Empty description, finishReason: ${reason}`);
  }
  return description;
}

async function embedText(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(`${EMBED_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embed error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data?.embedding?.values;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not found in .env.local');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find items with images but no embedding
  const { data: items, error } = await supabase
    .from('items')
    .select('id, title, thumbnail_url, media_urls')
    .is('image_embedding', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch items:', error);
    process.exit(1);
  }

  const itemsWithImages = (items ?? []).filter(
    (item) => item.thumbnail_url || (item.media_urls && item.media_urls.length > 0)
  );

  console.log(`Found ${items?.length ?? 0} items without embeddings, ${itemsWithImages.length} have images\n`);

  let success = 0;
  let failed = 0;

  for (const item of itemsWithImages) {
    const imageUrl = item.thumbnail_url || item.media_urls?.[0];
    if (!imageUrl) continue;

    try {
      process.stdout.write(`[${success + failed + 1}/${itemsWithImages.length}] ${item.title}... `);

      // Step 1: Gemini vision describes the image
      const description = await describeImage(imageUrl, apiKey);

      // Step 2: Embed the description
      const embedding = await embedText(description, apiKey);

      // Step 3: Store in DB
      const { error: updateError } = await supabase
        .from('items')
        .update({ image_embedding: JSON.stringify(embedding) })
        .eq('id', item.id);

      if (updateError) {
        console.log(`FAIL (store: ${updateError.message})`);
        failed++;
      } else {
        console.log(`OK (${embedding.length} dims)`);
        success++;
      }

      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    } catch (err: any) {
      console.log(`FAIL (${err.message.slice(0, 100)})`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}

main();
