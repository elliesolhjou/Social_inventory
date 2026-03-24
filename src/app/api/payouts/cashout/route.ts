import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const FOUNDER_ID = "e7eb677b-a7a3-401c-a682-9775f1303a52";
const MIN_CASHOUT_CENTS = 500; // $5 minimum

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { payout_method_id, amount_cents } = await req.json();

  if (!amount_cents || amount_cents < MIN_CASHOUT_CENTS) {
    return NextResponse.json(
      { error: `Minimum cash out is $${(MIN_CASHOUT_CENTS / 100).toFixed(2)}` },
      { status: 400 }
    );
  }

  // Verify payout method belongs to user
  if (payout_method_id) {
    const { data: method } = await supabase
      .from("payout_methods")
      .select("id, method, handle")
      .eq("id", payout_method_id)
      .eq("user_id", user.id)
      .single();

    if (!method) {
      return NextResponse.json({ error: "Payout method not found" }, { status: 404 });
    }
  } else {
    // Must have at least one payout method
    const { data: methods } = await supabase
      .from("payout_methods")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (!methods || methods.length === 0) {
      return NextResponse.json(
        { error: "Please add a payout method first" },
        { status: 400 }
      );
    }
  }

  // Check available balance
  const { data: earnings } = await supabase
    .from("earnings_ledger")
    .select("amount_cents, type")
    .eq("user_id", user.id);

  const totalEarned = (earnings ?? [])
    .filter((e: any) => ["rental", "sale"].includes(e.type))
    .reduce((sum: number, e: any) => sum + e.amount_cents, 0);

  const totalPaidOut = (earnings ?? [])
    .filter((e: any) => e.type === "payout")
    .reduce((sum: number, e: any) => sum + Math.abs(e.amount_cents), 0);

  // Check pending payouts
  const { data: pendingPayouts } = await supabase
    .from("payout_requests")
    .select("amount_cents")
    .eq("user_id", user.id)
    .eq("status", "pending");

  const pendingAmount = (pendingPayouts ?? [])
    .reduce((sum: number, p: any) => sum + p.amount_cents, 0);

  const available = totalEarned - totalPaidOut - pendingAmount;

  if (amount_cents > available) {
    return NextResponse.json(
      { error: `Insufficient balance. Available: $${(available / 100).toFixed(2)}` },
      { status: 400 }
    );
  }

  // Create payout request
  const { data: request, error } = await supabase
    .from("payout_requests")
    .insert({
      user_id: user.id,
      payout_method_id: payout_method_id || null,
      amount_cents,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get user info for notification
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  // Get payout method details
  const { data: methodInfo } = await supabase
    .from("payout_methods")
    .select("method, handle")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .single();

  // Notify founder
  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: FOUNDER_ID,
    message_type: "payout_request",
    content: `💰 Payout request: ${profile?.display_name ?? "A user"} wants to cash out $${(amount_cents / 100).toFixed(2)} via ${methodInfo?.method ?? "unknown"} (${methodInfo?.handle ?? "no handle"})`,
    topic: "payouts",
    payload: {
      payout_request_id: request.id,
      amount_cents,
      method: methodInfo?.method,
      handle: methodInfo?.handle,
    },
  });

  return NextResponse.json({
    success: true,
    request,
  });
}
