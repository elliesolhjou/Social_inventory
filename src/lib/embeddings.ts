/**
 * embeddings.ts — Image embedding generation via Gemini
 *
 * Strategy: Gemini vision describes the image → text-embedding-004
 * generates a 768-dim vector. Both search queries (photo or text)
 * go through the same pipeline, so cosine similarity works.
 *
 * Patent alignment: Fig. 5, Step 503 — Vector embedding generated
 */

// Two separate endpoints — different API versions
const VISION_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"; /**
 * Use Gemini vision to generate a detailed text description of an image,
 * then embed that description with text-embedding-004.
 *
 * @param imageBuffer - Raw image bytes (JPEG, PNG, or WebP)
 * @returns 768-dimensional float array
 */
export async function generateImageEmbedding(
  imageBuffer: Buffer,
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured.");
  }

  // Step 1: Gemini vision → detailed item description
  const base64Data = imageBuffer.toString("base64");

  const visionResponse = await fetch(`${VISION_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data,
              },
            },
            {
              text: "Describe this item in detail for a search index. Include: what it is, brand/model if visible, color, material, condition, size, and any distinguishing features. Be specific and factual. Write a single dense paragraph, no bullet points.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!visionResponse.ok) {
    const errText = await visionResponse.text();
    throw new Error(
      `Gemini vision error (${visionResponse.status}): ${errText}`,
    );
  }

  const visionData = await visionResponse.json();
  console.log(
    "Gemini vision raw response:",
    JSON.stringify(visionData).slice(0, 500),
  );

  const description =
    visionData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!description) {
    const finishReason = visionData?.candidates?.[0]?.finishReason;
    const blockReason = visionData?.promptFeedback?.blockReason;
    throw new Error(
      `Gemini returned empty description. finishReason: ${finishReason}, blockReason: ${blockReason}`,
    );
  }

  // Step 2: Embed the description with text-embedding-004
  return generateTextEmbedding(description);
}

/**
 * Generate a 768-dim embedding from text using Gemini text-embedding-004.
 * Used for both image descriptions and direct text search queries.
 *
 * @param text - Text to embed
 * @returns 768-dimensional float array
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured.");
  }

  const response = await fetch(`${EMBED_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: {
        parts: [{ text }],
      },
      outputDimensionality: 768,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini embedding error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const embedding = data?.embedding?.values;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(
      `Unexpected embedding shape: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }

  return embedding;
}

/**
 * Convert a base64 data URI to a Buffer for embedding generation.
 */
export function base64ToBuffer(base64Input: string): Buffer {
  const base64Data = base64Input.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}
