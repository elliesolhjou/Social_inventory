import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface FrameTimestamp {
  timestamp_offset_ms: number;
  angle_label: string;
}

/**
 * Ask Gemini to identify key frames from a video description.
 * In Phase 1 this runs async after upload — results stored in
 * transaction_evidence.extracted_frames for manual review.
 *
 * NOTE: Gemini 2.5 Pro can accept video directly via the File API.
 * For Phase 1, we send frame thumbnails (captured during recording)
 * and ask for the best subset. In Phase 2, switch to direct video input.
 */
export async function identifyKeyFrames(
  frameDataUrls: string[]
): Promise<FrameTimestamp[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const imageParts = frameDataUrls.map((dataUrl, i) => {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    return {
      inlineData: {
        mimeType: "image/jpeg" as const,
        data: base64,
      },
    };
  });

  const prompt = `These are ${frameDataUrls.length} frames extracted from a 10-second video of a physical item being inspected.
Identify 5-8 key frames that show distinct angles or important details of the item.
For each selected frame, provide the frame index (0-based) and a short label describing the angle/view.
Respond ONLY in JSON array format, no markdown, no backticks:
[{"timestamp_offset_ms": number, "angle_label": "string"}]
Use timestamp_offset_ms as approximate: frame_index * ${Math.round(10000 / frameDataUrls.length)}`;

  const result = await model.generateContent([prompt, ...imageParts]);
  const text = result.response.text().trim();

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini returned invalid frame extraction format");
  }

  return parsed;
}

/**
 * Run async frame extraction after evidence upload.
 * Call this in a fire-and-forget pattern from the evidence POST route
 * or via a Supabase Edge Function trigger.
 */
export async function processEvidenceFrames(
  evidenceId: string,
  frameDataUrls: string[],
  supabaseAdmin: {
    from: (table: string) => {
      update: (data: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>;
      };
    };
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          data: Buffer | Blob,
          options?: Record<string, unknown>
        ) => Promise<{ error: unknown }>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  }
): Promise<void> {
  try {
    const keyFrames = await identifyKeyFrames(frameDataUrls);

    // Store frame images in Supabase Storage
    const storedFrames = [];
    for (let i = 0; i < Math.min(keyFrames.length, frameDataUrls.length); i++) {
      const frameIndex = Math.round(
        keyFrames[i].timestamp_offset_ms /
          (10000 / frameDataUrls.length)
      );
      const safeIndex = Math.min(frameIndex, frameDataUrls.length - 1);
      const dataUrl = frameDataUrls[safeIndex];

      if (!dataUrl) continue;

      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const path = `frames/${evidenceId}/frame_${i}.jpg`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from("evidence-videos")
        .upload(path, buffer, { contentType: "image/jpeg" });

      if (!uploadErr) {
        const { data: urlData } = supabaseAdmin.storage
          .from("evidence-videos")
          .getPublicUrl(path);

        storedFrames.push({
          ...keyFrames[i],
          frame_url: urlData.publicUrl,
          frame_index: safeIndex,
        });
      }
    }

    // Update evidence record with extracted frames
    await supabaseAdmin
      .from("transaction_evidence")
      .update({ extracted_frames: storedFrames })
      .eq("id", evidenceId);
  } catch {
    // Async extraction failure is non-blocking in Phase 1.
    // Frames just won't be available for quick browsing.
  }
}
