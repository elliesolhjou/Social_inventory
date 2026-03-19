import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAdaptiveThreshold, applyAdaptiveThreshold } from "@/lib/adaptive_thresholds";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { id: transactionId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get transaction + item
  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("id, item_id, owner_id, borrower_id")
    .eq("id", transactionId)
    .single();

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Get item info + listing photos
  const { data: item } = await supabaseAdmin
    .from("items")
    .select("title, media_urls, condition_checklist_json, ai_category")
    .eq("id", transaction.item_id)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Get V3 evidence (required)
  const { data: v3Evidence } = await supabaseAdmin
    .from("transaction_evidence")
    .select("id, video_url, extracted_frames")
    .eq("transaction_id", transactionId)
    .eq("evidence_type", "V3")
    .single();

  if (!v3Evidence) {
    return NextResponse.json(
      { error: "V3 inspection evidence not found. Record an inspection video first." },
      { status: 400 }
    );
  }

  // Get V1 evidence (optional — pickup scan)
  const { data: v1Evidence } = await supabaseAdmin
    .from("transaction_evidence")
    .select("id, video_url, extracted_frames")
    .eq("transaction_id", transactionId)
    .eq("evidence_type", "V1")
    .single();

  // Collect images for comparison
  // Priority: V1 frames vs V3 frames. Fallback: listing photos vs V3 frames.
  const beforeImages: string[] = [];
  const afterImages: string[] = [];

  // Before images: V1 extracted frames, or listing photos
  if (v1Evidence?.extracted_frames && Array.isArray(v1Evidence.extracted_frames)) {
    for (const frame of v1Evidence.extracted_frames.slice(0, 4)) {
      const f = frame as { frame_url?: string };
      if (f.frame_url) {
        try {
          const res = await fetch(f.frame_url);
          const buf = await res.arrayBuffer();
          beforeImages.push(Buffer.from(buf).toString("base64"));
        } catch { /* skip */ }
      }
    }
  }

  // If no V1 frames, use listing photos
  if (beforeImages.length === 0 && item.media_urls && Array.isArray(item.media_urls)) {
    for (const url of (item.media_urls as string[]).slice(0, 4)) {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        beforeImages.push(Buffer.from(buf).toString("base64"));
      } catch { /* skip */ }
    }
  }

  // After images: V3 extracted frames
  if (v3Evidence.extracted_frames && Array.isArray(v3Evidence.extracted_frames)) {
    for (const frame of v3Evidence.extracted_frames.slice(0, 4)) {
      const f = frame as { frame_url?: string };
      if (f.frame_url) {
        try {
          const res = await fetch(f.frame_url);
          const buf = await res.arrayBuffer();
          afterImages.push(Buffer.from(buf).toString("base64"));
        } catch { /* skip */ }
      }
    }
  }

  // Helper: construct full Supabase Storage URL from relative path
  const storageBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;
  function fullUrl(path: string, bucket: string = "return-photos"): string {
    if (path.startsWith("http")) return path;
    return `${storageBaseUrl}/${bucket}/${path}`;
  }

  // Fallback after images: return photos from transaction_photos table
  if (afterImages.length === 0) {
    const { data: returnPhotos } = await supabaseAdmin
      .from("transaction_photos")
      .select("photo_url")
      .eq("transaction_id", transactionId)
      .eq("photo_type", "return")
      .order("display_order", { ascending: true })
      .limit(4);

    if (returnPhotos && returnPhotos.length > 0) {
      for (const photo of returnPhotos) {
        try {
          const res = await fetch(fullUrl(photo.photo_url));
          const buf = await res.arrayBuffer();
          afterImages.push(Buffer.from(buf).toString("base64"));
        } catch { /* skip */ }
      }
    }
  }

  // Fallback before images: listing baseline photos from transaction_photos
  if (beforeImages.length === 0) {
    const { data: baselinePhotos } = await supabaseAdmin
      .from("transaction_photos")
      .select("photo_url")
      .eq("transaction_id", transactionId)
      .eq("photo_type", "listing_baseline")
      .order("display_order", { ascending: true })
      .limit(4);

    if (baselinePhotos && baselinePhotos.length > 0) {
      for (const photo of baselinePhotos) {
        try {
          const res = await fetch(fullUrl(photo.photo_url));
          const buf = await res.arrayBuffer();
          beforeImages.push(Buffer.from(buf).toString("base64"));
        } catch { /* skip */ }
      }
    }
  }

  if (beforeImages.length === 0 && afterImages.length === 0) {
    return NextResponse.json(
      { error: "No comparison images available. Upload listing photos via Magic Upload and ensure return photos were submitted." },
      { status: 400 }
    );
  }

  // Determine comparison mode
  let comparisonMode = "full"; // before vs after
  if (beforeImages.length === 0) comparisonMode = "after_only";
  if (afterImages.length === 0) comparisonMode = "before_only";

  // Build Gemini prompt
  const checklistContext = item.condition_checklist_json
    ? `\nOwner's condition certification at listing time:\n${JSON.stringify((item.condition_checklist_json as Record<string, unknown>).answers ?? [])}`
    : "";

  const sourceLabel = v1Evidence ? "PICKUP SCAN (V1) — borrower's video at pickup" : "LISTING PHOTOS — item when first listed";

  let taskDescription = "";
  if (comparisonMode === "full") {
    taskDescription = `Compare the BEFORE photos (${sourceLabel}) with the AFTER photos (item after return from borrower). Identify any new damage, missing parts, or condition changes.`;
  } else if (comparisonMode === "after_only") {
    taskDescription = `Assess the condition of the item in these AFTER photos (item after return from borrower). No before photos are available. Look for any visible damage, wear, or issues. Note that without before photos, confidence should be lower.`;
  } else {
    taskDescription = `These are BEFORE photos of the item. No after photos are available yet. Describe the current condition for baseline documentation.`;
  }

  // Get adaptive threshold for this item's category + condition
  const itemCategory = (item.ai_category as string) ?? "general";
  const itemCondition = null; // Could come from item.ai_condition if available
  const threshold = getAdaptiveThreshold(itemCategory, itemCondition);

  const prompt = `You are a damage assessment AI for Proxe, a peer-to-peer lending platform.

ITEM: "${item.title}"
CATEGORY: ${threshold.category}
${checklistContext}

TASK: ${taskDescription}

RULES:
- Only flag CLEAR, VISIBLE differences or damage.
- For this item category (${threshold.category}), normal wear includes: "${threshold.normal_wear_description}" — do NOT flag these as damage.
- If you cannot clearly see damage or the photos are ambiguous, set confidence below 70 and recommend needs_human_review.
- Be specific about WHAT changed and WHERE on the item.
- Be fair to both parties.
- If only one set of photos is available, assess what you can see but lower your confidence.

Respond ONLY in JSON, no markdown, no backticks:
{
  "damage_detected": boolean,
  "confidence": number (0-100),
  "summary": "1-2 sentence plain English summary",
  "findings": [{"component": "string", "issue": "string", "severity": "none|minor|moderate|severe"}],
  "recommendation": "release_deposit|capture_full|capture_partial|needs_human_review",
  "recommended_capture_percent": number or null
}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const parts: (string | { inlineData: { mimeType: "image/jpeg"; data: string } })[] = [];

    if (beforeImages.length > 0) {
      parts.push(`BEFORE PHOTOS (${sourceLabel}):`);
      for (const b64 of beforeImages) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
      }
    }

    if (afterImages.length > 0) {
      parts.push("AFTER PHOTOS (item condition after return from borrower):");
      for (const b64 of afterImages) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
      }
    }

    parts.push(prompt);

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const assessment = JSON.parse(cleaned);

    // Patent Step 404: Apply adaptive threshold
    const thresholdResult = applyAdaptiveThreshold(
      assessment,
      itemCategory,
      itemCondition
    );

    // Combine raw assessment + threshold result for storage
    const fullReport = {
      ...assessment,
      adaptive_threshold: {
        category: threshold.category,
        condition_adjustment: thresholdResult.threshold_applied.condition_adjustment,
        effective_auto_resolve: thresholdResult.threshold_applied.effective_auto_resolve,
        normal_wear_description: threshold.normal_wear_description,
        final_recommendation: thresholdResult.final_recommendation,
        auto_resolved: thresholdResult.auto_resolved,
        reason: thresholdResult.reason,
      },
    };

    // Store on V3 evidence row
    await supabaseAdmin
      .from("transaction_evidence")
      .update({ ai_damage_report: fullReport })
      .eq("id", v3Evidence.id);

    // Patent Step 405: Show AI result to both parties
    const recLabel =
      thresholdResult.final_recommendation === "release_deposit"
        ? "No damage detected — recommending deposit release."
        : thresholdResult.final_recommendation === "needs_human_review"
          ? "Inconclusive — flagged for manual review."
          : "Damage detected — recommending deposit capture.";

    const aiMessage = `AI Damage Analysis for "${item.title}": ${fullReport.summary} (${fullReport.confidence}% confidence). ${recLabel}`;

    for (const recipientId of [transaction.owner_id, transaction.borrower_id]) {
      await supabaseAdmin.from("messages").insert({
        sender_id: transaction.owner_id,
        recipient_id: recipientId,
        message_type: "ai_damage_report",
        content: aiMessage,
        topic: transaction.item_id,
        payload: {
          transaction_id: transactionId,
          assessment_summary: fullReport.summary,
          confidence: fullReport.confidence,
          damage_detected: fullReport.damage_detected,
          final_recommendation: thresholdResult.final_recommendation,
          auto_resolved: thresholdResult.auto_resolved,
          category: threshold.category,
        },
      });
    }

    return NextResponse.json({ success: true, assessment: fullReport });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI comparison failed";
    return NextResponse.json(
      { error: "AI comparison failed", detail: message },
      { status: 500 }
    );
  }
}
