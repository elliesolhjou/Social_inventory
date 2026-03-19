import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

const LOGISTICS_SYSTEM = `You are Miles, an AI concierge analyzing a chat conversation between two people coordinating a physical item pickup.

Your job: detect if the conversation contains an AGREED-UPON pickup plan — meaning both parties have converged on a location, date, and/or time.

Analyze the messages and respond ONLY with valid JSON. No markdown. No preamble.

Rules:
- Only extract logistics that BOTH parties seem to agree on (one person proposes, the other confirms/accepts)
- If only one person proposed and the other hasn't responded yet, return no_change
- Relative dates like "tomorrow", "today", "this Saturday" should be resolved using the reference_date provided
- Relative times like "evening", "after work", "morning" should be mapped to reasonable hours:
  - "morning" → "09:00"
  - "afternoon" → "14:00"
  - "evening" / "after work" → "18:00"
  - "night" → "20:00"
- Locations like "my place", "my unit", "my door" should be mapped to the speaker's unit number if provided
- "lobby", "front desk", "leasing office", "mailroom", "pool area" etc. should be kept as-is
- If you can only extract SOME fields (e.g. they agreed on a time but not location), return only those fields

Response format:
{
  "detected": true/false,
  "confidence": 0.0-1.0,
  "logistics": {
    "location": "string or null",
    "date": "YYYY-MM-DD or null",
    "time": "HH:MM (24hr) or null",
    "note": "any relevant context or null"
  },
  "reasoning": "brief explanation of what you detected"
}

If nothing was agreed upon:
{ "detected": false, "confidence": 0.0, "logistics": null, "reasoning": "..." }`;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  // 1. Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { transaction_id } = body;

  if (!transaction_id) {
    return NextResponse.json(
      { error: "transaction_id is required" },
      { status: 400 }
    );
  }

  // 2. Fetch transaction
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("id, borrower_id, owner_id, item_id, state, pickup_location, pickup_date, pickup_time")
    .eq("id", transaction_id)
    .single();

  if (txError || !transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Only parse for active transactions
  if (!["approved", "deposit_held"].includes(transaction.state)) {
    return NextResponse.json({ detected: false, reason: "Transaction not in logistics-eligible state" });
  }

  // Must be a participant
  const isParticipant =
    user.id === transaction.borrower_id || user.id === transaction.owner_id;
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Fetch recent chat messages between the two parties (last 20)
  const { data: messages } = await supabase
    .from("messages")
    .select("sender_id, content, message_type, payload, created_at")
    .or(
      `and(sender_id.eq.${transaction.borrower_id},recipient_id.eq.${transaction.owner_id}),` +
      `and(sender_id.eq.${transaction.owner_id},recipient_id.eq.${transaction.borrower_id})`
    )
    .in("message_type", ["chat", "direct", "pickup_proposal"])
    .order("created_at", { ascending: true })
    .limit(20);

  if (!messages || messages.length < 2) {
    return NextResponse.json({ detected: false, reason: "Not enough messages to parse" });
  }

  // 4. Fetch profiles for context
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, unit_number")
    .in("id", [transaction.borrower_id, transaction.owner_id]);

  const borrowerProfile = profiles?.find((p) => p.id === transaction.borrower_id);
  const ownerProfile = profiles?.find((p) => p.id === transaction.owner_id);

  // 5. Build conversation for Gemini
  const today = new Date().toISOString().split("T")[0];

  const conversationText = messages
    .map((m) => {
      const name =
        m.sender_id === transaction.borrower_id
          ? `${borrowerProfile?.display_name ?? "Borrower"} (borrower, unit ${borrowerProfile?.unit_number ?? "?"})`
          : `${ownerProfile?.display_name ?? "Owner"} (owner, unit ${ownerProfile?.unit_number ?? "?"})`;

      // If it's a pickup_proposal with structured data, include that
      if (m.message_type === "pickup_proposal" && m.payload) {
        const p = m.payload as Record<string, unknown>;
        return `${name}: [PICKUP PROPOSAL] Location: ${p.location}, Date: ${p.date}, Time: ${p.time}${p.note ? `, Note: ${p.note}` : ""}`;
      }

      return `${name}: ${m.content}`;
    })
    .join("\n");

  const currentLogistics = transaction.pickup_location || transaction.pickup_date || transaction.pickup_time
    ? `\nCurrent saved logistics: location="${transaction.pickup_location ?? "none"}", date="${transaction.pickup_date ?? "none"}", time="${transaction.pickup_time ?? "none"}"`
    : "\nNo logistics saved yet.";

  const prompt = `reference_date: ${today}\n${currentLogistics}\n\nConversation:\n${conversationText}`;

  // 6. Call Gemini
  const geminiRes = await fetch(
    `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: LOGISTICS_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingBudget: 1024,
          },
        },
      }),
    }
  );

  // const geminiData = await geminiRes.json();
  // const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const geminiData = await geminiRes.json();
  console.log("MILES LOGISTICS: Gemini status:", geminiRes.status);
  console.log("MILES LOGISTICS: Gemini response:", JSON.stringify(geminiData).slice(0, 500));
  const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  console.log("MILES LOGISTICS: raw text:", raw);
  
  let parsed;
  try {
    const clean = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    console.error("Miles logistics parse failed:", raw);
    return NextResponse.json({ detected: false, reason: "AI parse error" });
  }

  // 7. If logistics detected with decent confidence, send suggestion message
  if (parsed.detected && parsed.confidence >= 0.6 && parsed.logistics) {
    const logistics = parsed.logistics;

    // Don't re-suggest if logistics already match what's saved
    const alreadyMatches =
      transaction.pickup_location === logistics.location &&
      transaction.pickup_date === logistics.date &&
      transaction.pickup_time === logistics.time;

    if (alreadyMatches) {
      return NextResponse.json({ detected: true, already_saved: true });
    }

    // Format for display
    const dateDisplay = logistics.date
      ? new Date(`${logistics.date}T12:00:00`).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      : null;

    const timeDisplay = logistics.time
      ? new Date(`2000-01-01T${logistics.time}`).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

    let suggestionText = `I noticed you two agreed on pickup details! Here's what I picked up:`;
    if (logistics.location) suggestionText += `\n📍 ${logistics.location}`;
    if (dateDisplay) suggestionText += `\n📅 ${dateDisplay}`;
    if (timeDisplay) suggestionText += `\n🕐 ${timeDisplay}`;
    if (logistics.note) suggestionText += `\n💬 ${logistics.note}`;
    suggestionText += `\nConfirm below to lock it in.`;

    // Send suggestion to BOTH parties as a system-like message from Miles
    const partnerId =
      user.id === transaction.borrower_id
        ? transaction.owner_id
        : transaction.borrower_id;

    // Insert one message visible to both (send to the partner; sender sees it too via conversation view)
    await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: partnerId,
      message_type: "pickup_suggestion",
      content: suggestionText,
      topic: transaction.item_id,
      payload: {
        transaction_id: transaction.id,
        suggested_location: logistics.location,
        suggested_date: logistics.date,
        suggested_time: logistics.time,
        suggested_note: logistics.note,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        date_display: dateDisplay,
        time_display: timeDisplay,
      },
    });

    return NextResponse.json({
      detected: true,
      confidence: parsed.confidence,
      logistics: parsed.logistics,
      suggestion_sent: true,
    });
  }

  return NextResponse.json({
    detected: false,
    confidence: parsed.confidence ?? 0,
    reasoning: parsed.reasoning ?? "No agreed logistics detected",
  });
}
