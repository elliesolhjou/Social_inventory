import { NextRequest, NextResponse } from "next/server";

/**
 * VisionAgent — Magic Upload endpoint (Gemini 2.5 Pro)
 *
 * Accepts base64-encoded video frames and sends them to Google's Gemini
 * vision API for item identification. Returns structured item metadata.
 *
 * POST /api/vision
 * Body: { frames: string[] }  (array of base64 JPEG data URIs)
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

// VisionAgent system prompt — for item identification
const VISION_SYSTEM_PROMPT = `You are VisionAgent, part of The Social Inventory — a hyper-local sharing platform for apartment buildings.

Your task: Analyze images of a household item and return structured metadata for a lending listing.

You MUST respond with ONLY valid JSON, no markdown, no explanation, no preamble. The JSON schema:

{
  "title": "string — concise item name, e.g. 'DJI Mini 4 Pro Drone'",
  "category": "string — one of: electronics, kitchen, outdoor, sports, tools, entertainment, home, wellness, travel, creative, beauty, clothing, baby_kids, music, automotive",
  "subcategory": "string — a more specific sub-type, use snake_case, e.g. 'drone', 'stand_mixer', 'yoga_mat'",
  "description": "string — 1-2 sentence friendly description of the item as it appears, written for neighbors",
  "ai_description": "string — detailed technical description including observed condition, features, and any notable wear",
  "condition": "string — one of: like_new, good, fair, worn",
  "brand": "string or null — detected brand name",
  "model": "string or null — detected model name/number",
  "color": "string or null — primary color",
  "year": "number or null — estimated year/generation if identifiable",
  "original_price_cents": "number or null — estimated retail price in cents if you can identify the exact product",
  "suggested_deposit_cents": "number — suggested refundable deposit in cents (typically 10-20% of retail value)",
  "max_borrow_days": "number — suggested max borrow duration in days",
  "rules": "string — suggested lending rules based on item type",
  "confidence": "number — 0 to 1, your confidence in the identification"
}

Guidelines:
- Be specific about brand/model when visible
- Condition assessment should be based on visible wear, scratches, dents, etc.
- Suggested deposit should reflect item value and fragility
- Rules should be practical (e.g. "Return cleaned" for kitchen items, "Keep in case" for electronics)
- If multiple items visible, focus on the primary/central item
- If you cannot identify the item with reasonable confidence, still provide your best guess with a low confidence score`;

export async function POST(request: NextRequest) {
  try {
    const { frames } = await request.json();

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json(
        { error: "No frames provided. Send { frames: [base64DataUri, ...] }" },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured. Set GEMINI_API_KEY in .env.local" },
        { status: 500 },
      );
    }

    // Build the parts array for Gemini's format
    const parts: any[] = [];

    // Add up to 4 frames (to keep within reasonable limits)
    const selectedFrames = frames.slice(0, 4);
    for (const frame of selectedFrames) {
      // Strip data URI prefix if present
      const base64Data = frame.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: base64Data,
        },
      });
    }

    parts.push({
      text: `These are ${selectedFrames.length} frames captured from a short video of an item someone wants to lend to their neighbors. Analyze the item and return the structured JSON metadata. Remember: respond with ONLY valid JSON.`,
    });

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: VISION_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Vision API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();

    // Extract text from Gemini response
    const textContent =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      console.error("Unexpected Gemini response shape:", JSON.stringify(data));
      return NextResponse.json(
        { error: "No response from Vision API" },
        { status: 502 },
      );
    }

    // Parse the JSON response (strip any accidental markdown fences)
    const cleanJson = textContent.replace(/```json\n?|```\n?/g, "").trim();
    const itemData = JSON.parse(cleanJson);

    return NextResponse.json({
      success: true,
      item: itemData,
      framesAnalyzed: selectedFrames.length,
    });
  } catch (error: any) {
    console.error("VisionAgent error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Failed to parse Vision API response as JSON" },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}