import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateImageEmbedding, base64ToBuffer } from "@/lib/embeddings";

/**
 * POST /api/search/visual
 *
 * Visual similarity search — resident uploads a photo, Miles finds matching
 * items in their building using CLIP embeddings + pgvector cosine similarity.
 *
 * Patent alignment: Fig. 5, Steps 501–506 (full pipeline)
 *   501: Image received (this route)
 *   502: VisionAgent extracts category for pre-filtering
 *   503: CLIP embedding generated
 *   504: pgvector cosine similarity search (building-scoped)
 *   505: Composite ranking (similarity + trust + availability)
 *   506: Miles presents results with trust context
 *
 * Body: { frame: string, use_category_filter?: boolean }
 */

// Gemini API for step 502 — VisionAgent category extraction
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

const CATEGORY_PROMPT = `You are VisionAgent for Proxe, a peer-to-peer sharing platform.
Analyze this image and identify the object. Return ONLY valid JSON, no markdown:
{
  "object_name": "string — what the item is",
  "category": "string — one of: electronics, kitchen, outdoor, sports, tools, entertainment, home, wellness, travel, creative, beauty, clothing, baby_kids, music, automotive",
  "confidence": "number — 0 to 1"
}`;

// Composite ranking weights (step 505)
const W_SIMILARITY = 0.60;
const W_TRUST = 0.25;
const W_RECENCY = 0.15;
const DEFAULT_TRUST = 4.0; // Until Claim 2 (trust scoring) ships
const MAX_TRUST = 5.0;
const RECENCY_WINDOW_DAYS = 90;

export async function POST(request: NextRequest) {
  try {
    const { frame, use_category_filter = false } = await request.json();

    if (!frame) {
      return NextResponse.json(
        { error: "No frame provided. Send { frame: base64DataUri }" },
        { status: 400 }
      );
    }

    // Auth — get user's building_id
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's building_id from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("building_id")
      .eq("id", user.id)
      .single();

    if (!profile?.building_id) {
      return NextResponse.json(
        { error: "No building associated with your profile" },
        { status: 400 }
      );
    }

    const imageBuffer = base64ToBuffer(frame);

    // ── Step 502: VisionAgent category extraction (optional) ──────────
    let detectedCategory: string | null = null;

    if (use_category_filter) {
      try {
        const base64Data = frame.replace(/^data:image\/\w+;base64,/, "");
        const geminiResponse = await fetch(
          `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: CATEGORY_PROMPT }] },
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
                    { text: "What is this item? Return JSON only." },
                  ],
                },
              ],
              generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
            }),
          }
        );

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const text =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const cleanJson = text.replace(/```json\n?|```\n?/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          detectedCategory = parsed.category ?? null;
        }
      } catch (err) {
        // Category extraction failed — proceed without filter
        console.warn("Category extraction failed, searching all categories:", err);
      }
    }

    // ── Step 503: Generate CLIP embedding ─────────────────────────────
    const queryEmbedding = await generateImageEmbedding(imageBuffer);

    // ── Step 504: pgvector cosine similarity search ───────────────────
    // Use service role for the RPC call to avoid RLS issues on the function
    const serviceSupabase = createServerClient(
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

    const { data: searchResults, error: searchError } = await serviceSupabase.rpc(
      "search_items_by_image",
      {
        query_embedding: JSON.stringify(queryEmbedding),
        search_building_id: profile.building_id,
        filter_category: detectedCategory,
        match_threshold: 0.3, // Lower for dev/testing — raise to 0.7 in prod
        match_count: 10,
      }
    );

    if (searchError) {
      console.error("pgvector search error:", searchError);
      return NextResponse.json(
        { error: "Search failed: " + searchError.message },
        { status: 500 }
      );
    }

    if (!searchResults || searchResults.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        miles_message:
          "I couldn\u2019t find anything matching that in your building right now. Want me to post a broadcast request to your neighbors?",
        detected_category: detectedCategory,
      });
    }

    // ── Step 505: Composite ranking ───────────────────────────────────
    // Fetch owner profiles for trust context (no-join pattern)
    const ownerIds = [...new Set(searchResults.map((r: any) => r.owner_id))];
    const { data: ownerProfiles } = await serviceSupabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", ownerIds);

    const profileMap = new Map(
      (ownerProfiles ?? []).map((p: any) => [p.id, p])
    );

    const now = Date.now();
    const ranked = searchResults
      .map((item: any) => {
        const daysSinceListed =
          (now - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(
          0,
          1 - daysSinceListed / RECENCY_WINDOW_DAYS
        );
        const trustScore = DEFAULT_TRUST / MAX_TRUST; // Placeholder until Claim 2

        const compositeScore =
          W_SIMILARITY * item.similarity +
          W_TRUST * trustScore +
          W_RECENCY * recencyScore;

        const owner = profileMap.get(item.owner_id);

        return {
          id: item.id,
          title: item.title,
          thumbnail_url: item.thumbnail_url,
          category: item.category,
          ai_condition: item.ai_condition,
          deposit_cents: item.deposit_cents,
          similarity: Math.round(item.similarity * 100) / 100,
          composite_score: Math.round(compositeScore * 1000) / 1000,
          owner: {
            id: item.owner_id,
            name: owner?.full_name ?? "A neighbor",
            avatar_url: owner?.avatar_url ?? null,
            trust_score: DEFAULT_TRUST, // Placeholder
          },
        };
      })
      .sort((a: any, b: any) => b.composite_score - a.composite_score);

    // ── Step 506: Miles presents results ──────────────────────────────
    const topResult = ranked[0];
    const milesMessage =
      ranked.length === 1
        ? `I found 1 item in your building that matches — ${topResult.owner.name} has a ${topResult.title}.`
        : `I found ${ranked.length} items in your building that match. ${topResult.owner.name} has a ${topResult.title} — that\u2019s your closest match.`;

    return NextResponse.json({
      success: true,
      results: ranked,
      miles_message: milesMessage,
      detected_category: detectedCategory,
    });
  } catch (error: any) {
    console.error("Visual search error:", error);
    return NextResponse.json(
      { error: error.message || "Visual search failed" },
      { status: 500 }
    );
  }
}
