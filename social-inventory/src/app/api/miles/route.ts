import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

// ── Types ─────────────────────────────────────────────────────────────────────
type MilesAction =
  | { type: "items"; items: Item[]; query: string }
  | {
      type: "no_results";
      query: string;
      amazonUrl: string;
      amazonQuery: string;
    }
  | { type: "broadcast_offer"; query: string }
  | { type: "broadcast_sent"; query: string }
  | { type: "platform_answer"; answer: string }
  | { type: "chitchat" };

type Item = {
  id: string;
  title: string;
  category: string;
  deposit_cents: number;
  ai_condition: string;
  owner: { display_name: string; unit_number: string; trust_score: number };
};

// ── System prompt ─────────────────────────────────────────────────────────────
const MILES_SYSTEM = `You are Miles, the AI concierge for Anbo — a hyper-local sharing platform for apartment buildings.
Your building is called The Meridian.

Your personality: warm, helpful, slightly witty. You speak like a knowledgeable neighbor, not a robot. Short sentences. Conversational.

You respond ONLY with valid JSON. No markdown. No preamble. Just JSON.

Decide which action to take based on the user message:

1. If they want to FIND or BORROW an item → { "action": "search", "query": "<normalized search query>", "response": "<your message>" }
2. If they want to ASK NEIGHBORS via broadcast → { "action": "broadcast", "query": "<item they want>", "response": "<your message>" }
3. If they're asking about HOW THE PLATFORM WORKS, deposits, trust scores, how to list items, etc → { "action": "platform", "response": "<answer in 2-3 sentences>" }
4. If it's casual chat / greeting → { "action": "chitchat", "response": "<your response>" }

Rules:
- Keep responses under 3 sentences
- Never say "I'm an AI" or "I'm a language model"
- If someone says "ask my neighbors" or "send a message to neighbors" → use broadcast action
- For item searches, extract the core item type (e.g. "I need something to blend my smoothie" → query: "blender")
- Be specific about what you found or didn't find`;

// ── Semantic item search ──────────────────────────────────────────────────────
async function searchItems(query: string, supabase: any): Promise<Item[]> {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Build OR filter across title, description, category, subcategory
  const orConditions = keywords
    .map(
      (k) =>
        `title.ilike.%${k}%,description.ilike.%${k}%,category.ilike.%${k}%,subcategory.ilike.%${k}%`,
    )
    .join(",");

  const { data } = await supabase
    .from("items")
    .select(
      "id, title, category, deposit_cents, ai_condition, owner:profiles(display_name, unit_number, trust_score)",
    )
    .eq("status", "available")
    .or(orConditions)
    .limit(6);

  return data ?? [];
}

// ── Broadcast to neighbors ────────────────────────────────────────────────────
async function broadcastRequest(
  query: string,
  requesterId: string,
  supabase: any,
) {
  // Insert a broadcast notification visible to all neighbors
  await supabase.from("broadcasts").insert({
    sender_id: requesterId,
    message: `Hey neighbors! Does anyone have a **${query}** they'd be willing to lend? Miles sent this on my behalf 🙏`,
    item_query: query,
    broadcast_type: "item_request",
    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  });
}

// ── Amazon search URL ─────────────────────────────────────────────────────────
function buildAmazonUrl(query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=anbo-20`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      message,
      history = [],
      broadcastConfirmed = false,
    } = await req.json();
    const supabase = await createServerSupabase();

    // Get current user (graceful fallback for demo)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;

    // ── Handle broadcast confirmation ──────────────────────────────────────
    if (broadcastConfirmed) {
      const { query } = await req.json().catch(() => ({ query: message }));
      if (userId) await broadcastRequest(message, userId, supabase);
      return NextResponse.json({
        response: `Done! I've sent a message to all your neighbors asking about **${message}**. You'll get a notification if someone responds 🏘️`,
        action: { type: "broadcast_sent", query: message },
      });
    }

    // ── Call Gemini directly (same pattern as vision route) ───────────────
    const conversationHistory = history.map(
      (m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }),
    );

    const geminiRes = await fetch(
      `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: MILES_SYSTEM }] },
          contents: [
            ...conversationHistory,
            { role: "user", parts: [{ text: message }] },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    const geminiData = await geminiRes.json();
    const raw =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    console.log("Miles raw response:", raw);
    console.log(
      "Miles gemini status:",
      geminiRes.status,
      JSON.stringify(geminiData).slice(0, 200),
    );

    let parsed: any;
    try {
      // Strip markdown fences and any leading/trailing whitespace
      const clean = raw
        .replace(/^```(?:json)?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error("Miles JSON parse failed, raw was:", raw);
      return NextResponse.json({
        response: "Sorry, I got a bit confused there. Try asking again!",
        action: { type: "chitchat" },
      });
    }

    // ── Route action ───────────────────────────────────────────────────────
    const { action, query, response } = parsed;

    if (action === "search" && query) {
      const items = await searchItems(query, supabase);

      if (items.length > 0) {
        return NextResponse.json({
          response:
            response ||
            `Found ${items.length} match${items.length > 1 ? "es" : ""} in your building!`,
          action: { type: "items", items, query },
        });
      } else {
        // Nothing found — offer Amazon + broadcast
        const amazonUrl = buildAmazonUrl(query);
        return NextResponse.json({
          response:
            response ||
            `No one in The Meridian has a **${query}** listed right now.`,
          action: { type: "no_results", query, amazonUrl, amazonQuery: query },
        });
      }
    }

    if (action === "broadcast" && query) {
      if (userId) await broadcastRequest(query, userId, supabase);
      return NextResponse.json({
        response:
          response ||
          `I've sent a message to your neighbors asking about **${query}**. I'll let you know if someone responds!`,
        action: { type: "broadcast_sent", query },
      });
    }

    if (action === "platform") {
      return NextResponse.json({
        response,
        action: { type: "platform_answer", answer: response },
      });
    }

    // Chitchat / fallback
    return NextResponse.json({
      response,
      action: { type: "chitchat" },
    });
  } catch (err) {
    console.error("Miles error:", err);
    return NextResponse.json(
      {
        response: "Something went wrong on my end. Try again!",
        action: { type: "chitchat" },
      },
      { status: 500 },
    );
  }
}
