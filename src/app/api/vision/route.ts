import { NextRequest, NextResponse } from "next/server";

/**
 * VisionAgent — Magic Upload endpoint (Gemini 2.5 Pro)
 *
 * Accepts base64-encoded image frames and sends them to Google's Gemini
 * vision API for item identification. Returns structured item metadata.
 *
 * POST /api/vision
 * Body: { frames: string[] }  (array of base64 JPEG data URIs, up to 10)
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

// VisionAgent system prompt — for item identification
const VISION_SYSTEM_PROMPT = `You are VisionAgent, part of Proxe — a hyper-local sharing platform for apartment buildings.

Your task: Analyze images of a household item and return structured metadata for a lending listing.

PROHIBITED ITEMS — CRITICAL RULE:
Before doing anything else, check if the item in the image is prohibited.
The following items are NEVER allowed on Proxe under any circumstances:

- HIGHEST PRIORITY — Sexual or pornographic materials of any kind: magazines, videos, DVDs, images, or any media depicting nudity or sexual acts. This includes adult magazines, adult DVDs, sex toys, or any sexually explicit material.
- ABSOLUTE TOP PRIORITY — Any material that sexualizes, depicts, or could be used to harm minors in any way. This includes but is not limited to child sexual abuse material (CSAM), any suggestive content involving minors, or items marketed toward the grooming or exploitation of children. If there is ANY doubt, flag as prohibited.

- Weapons of any kind: firearms, handguns, pistols, rifles, shotguns, revolvers, BB guns, airsoft guns, pellet guns, knives intended as weapons, daggers, swords, tasers, stun guns, brass knuckles
- Ammunition, bullets, shell casings, gun parts or accessories (holsters, magazines, scopes used on weapons)
- Explosive devices, grenades, fireworks, pyrotechnics
- Illegal drugs, controlled substances, drug paraphernalia (pipes, bongs, rolling papers marketed for drug use)
- Child car seats or child safety restraints of any kind
- Medical devices requiring prescription or professional supervision (oxygen tanks, CPAP machines, insulin pens, defibrillators)
- Hazardous materials: fuel canisters, gas tanks, propane tanks, solvents, pesticides, paint thinner
- Biological materials or biohazard items
- Motorized vehicles requiring registration: cars, motorcycles, scooters, e-bikes over 750W
- Items with visible product recall stickers or warnings

IF THE ITEM IS PROHIBITED, return this exact JSON and nothing else:
{
  "prohibited": true,
  "prohibited_reason": "string — one sentence explaining what was detected and why, e.g. 'A Glock 23 handgun was detected. Firearms are not permitted on Proxe.'"
}
Do NOT fill out any other fields. Do NOT attempt to describe or categorize the item.

IF THE ITEM IS ALLOWED, return the full metadata below with prohibited set to false.

You MUST respond with ONLY valid JSON, no markdown, no explanation, no preamble:

{
  "prohibited": false,
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

Guidelines for allowed items:
- Be specific about brand/model when visible
- Condition assessment should be based on visible wear, scratches, dents, etc.
- Suggested deposit should reflect item value and fragility
- Rules should be practical (e.g. "Return cleaned" for kitchen items, "Keep in case" for electronics)
- If multiple items visible, focus on the primary/central item
- Multiple photos from different angles should increase your confidence — look for details visible in some photos but not others
- If you cannot identify the item with reasonable confidence, still provide your best guess with a low confidence score`;

const MAX_FRAMES = 10;

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
        {
          error:
            "Gemini API key not configured. Set GEMINI_API_KEY in .env.local",
        },
        { status: 500 },
      );
    }

    // Build the parts array for Gemini's format
    const parts: any[] = [];

    // Accept up to MAX_FRAMES photos
    const selectedFrames = frames.slice(0, MAX_FRAMES);
    for (const frame of selectedFrames) {
      // Strip data URI prefix if present (handles jpeg, png, webp, etc.)
      const base64Data = frame.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: base64Data,
        },
      });
    }

    parts.push({
      text:
        selectedFrames.length === 1
          ? `This is a photo of an item someone wants to lend to their neighbors. Analyze the item and return the structured JSON metadata. Remember: respond with ONLY valid JSON.`
          : `These are ${selectedFrames.length} photos of an item someone wants to lend to their neighbors, taken from different angles. Analyze all photos together for the most accurate identification and condition assessment. Return the structured JSON metadata. Remember: respond with ONLY valid JSON.`,
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
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

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

    // ── Prohibited item check — VisionAgent detected a prohibited item ────────
    if (itemData.prohibited === true) {
      return NextResponse.json(
        {
          prohibited: true,
          prohibited_reason:
            itemData.prohibited_reason ??
            "This item is not permitted on Proxe.",
        },
        { status: 403 },
      );
    }

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
