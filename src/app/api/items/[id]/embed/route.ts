import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateImageEmbedding, base64ToBuffer } from "@/lib/embeddings";

/**
 * POST /api/items/[id]/embed
 *
 * Generate a CLIP embedding for an item's image and store it in pgvector.
 * Called fire-and-forget after Magic Upload publishes an item.
 *
 * Patent alignment: Fig. 5, Steps 502–503
 *   502: VisionAgent already ran during /api/vision (category + attributes extracted)
 *   503: This route generates the vector embedding
 *
 * Body: { frame: string }  — base64 image data URI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
    const { frame } = await request.json();

    if (!frame) {
      return NextResponse.json(
        { error: "No frame provided. Send { frame: base64DataUri }" },
        { status: 400 }
      );
    }

    // Use service role to bypass RLS for embedding writes
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      }
    );

    // Verify item exists
    const { data: item, error: fetchError } = await supabase
      .from("items")
      .select("id, title")
      .eq("id", itemId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Generate CLIP embedding (step 503)
    const imageBuffer = base64ToBuffer(frame);
    const embedding = await generateImageEmbedding(imageBuffer);

    // Store embedding in pgvector column
    const { error: updateError } = await supabase
      .from("items")
      .update({ image_embedding: JSON.stringify(embedding) })
      .eq("id", itemId);

    if (updateError) {
      console.error("Failed to store embedding:", updateError);
      return NextResponse.json(
        { error: "Failed to store embedding" },
        { status: 500 }
      );
    }

    console.log(
      `Embedding stored for item ${itemId} (${item.title}) — ${embedding.length} dims`
    );

    return NextResponse.json({
      success: true,
      item_id: itemId,
      dimensions: embedding.length,
    });
  } catch (error: any) {
    console.error("Embed route error:", error);
    return NextResponse.json(
      { error: error.message || "Embedding generation failed" },
      { status: 500 }
    );
  }
}
