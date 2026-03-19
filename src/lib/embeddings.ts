/**
 * embeddings.ts — CLIP image embedding generation via Hugging Face Inference API
 *
 * Uses openai/clip-vit-base-patch32 (512-dim vectors).
 * Same model handles both image→embedding and text→embedding,
 * so Sprint 4 (semantic text search) is nearly free once this ships.
 *
 * Patent alignment: Fig. 5, Step 503 — Vector embedding generated
 */

const HF_MODEL = "openai/clip-vit-base-patch32";
const HF_API_BASE = "https://api-inference.huggingface.co/pipeline/feature-extraction";

/**
 * Generate a 512-dim CLIP embedding from an image buffer.
 * Used for both:
 *   - Write path: generating embeddings on item creation (Magic Upload)
 *   - Read path: generating query embedding for visual search
 *
 * @param imageBuffer - Raw image bytes (JPEG, PNG, or WebP)
 * @returns 512-dimensional float array
 */
export async function generateImageEmbedding(
  imageBuffer: Buffer
): Promise<number[]> {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    throw new Error("HF_API_KEY not configured. Set it in .env.local");
  }

  const response = await fetch(`${HF_API_BASE}/${HF_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/octet-stream",
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HF Inference API error (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();

  // HF feature-extraction returns nested arrays — flatten to 1D
  // Response shape varies: could be number[] or number[][]
  const embedding = Array.isArray(result[0]) ? result[0] : result;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(
      `Unexpected embedding shape: ${JSON.stringify(result).slice(0, 200)}`
    );
  }

  return embedding;
}

/**
 * Generate a 512-dim CLIP embedding from text.
 * CLIP embeds text and images into the same vector space,
 * so this enables text→image search using the same pgvector index.
 *
 * Sprint 4 — not used in Sprint 2, but included for completeness.
 *
 * @param text - Search query text (e.g., "camping tent")
 * @returns 512-dimensional float array
 */
export async function generateTextEmbedding(
  text: string
): Promise<number[]> {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    throw new Error("HF_API_KEY not configured. Set it in .env.local");
  }

  const response = await fetch(`${HF_API_BASE}/${HF_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HF Inference API error (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();
  const embedding = Array.isArray(result[0]) ? result[0] : result;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(
      `Unexpected embedding shape: ${JSON.stringify(result).slice(0, 200)}`
    );
  }

  return embedding;
}

/**
 * Convert a base64 data URI to a Buffer for embedding generation.
 * Handles both raw base64 and data URI format.
 */
export function base64ToBuffer(base64Input: string): Buffer {
  const base64Data = base64Input.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}
