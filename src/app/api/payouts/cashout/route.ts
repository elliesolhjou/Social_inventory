import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

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

  // Get the payout method
  let method: any = null;
  if (payout_method_id) {
    const { data } = await supabase
      .from("payout_methods")
      .select("*")
      .eq("id", payout_method_id)
      .eq("user_id", user.id)
      .single();
    method = data;
  } else {
    // Use default method
    const { data } = await supabase
      .from("payout_methods")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single();
    method = data;
  }

  if (!method) {
    return NextResponse.json(
      { error: "Please add a payout method first" },
      { status: 400 }
    );
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

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  // ── Handle Stripe Connect payout (automated) ──────────────────
  if (method.method === "stripe_connect" && method.stripe_account_id && method.verified) {
    try {
      // Create transfer to connected account
      const transfer = await stripe.transfers.create({
        amount: amount_cents,
        currency: "usd",
        destination: method.stripe_account_id,
        description: `Proxe payout for ${profile?.display_name ?? "user"}`,
        metadata: {
          proxe_user_id: user.id,
          payout_type: "cashout",
        },
      });

      // Record the payout request as completed immediately
      const { data: request } = await supabase
        .from("payout_requests")
        .insert({
          user_id: user.id,
          payout_method_id: method.id,
          amount_cents,
          status: "completed",
          processed_at: new Date().toISOString(),
          notes: `Stripe transfer: ${transfer.id}`,
        })
        .select()
        .single();

      // Record in earnings ledger
      await supabase
        .from("earnings_ledger")
        .insert({
          user_id: user.id,
          amount_cents: -amount_cents,
          type: "payout",
          description: `Bank payout via Stripe (${transfer.id})`,
        });

      // Notify user
      await supabase.from("messages").insert({
        sender_id: FOUNDER_ID,
        recipient_id: user.id,
        message_type: "payout_completed",
        content: `💰 Your cash out of $${(amount_cents / 100).toFixed(2)} has been sent to your bank account. It should arrive in 2-3 business days.`,
        topic: "payouts",
        payload: {
          payout_request_id: request?.id,
          amount_cents,
          transfer_id: transfer.id,
        },
      });

      return NextResponse.json({
        success: true,
        method: "stripe_connect",
        status: "completed",
        transfer_id: transfer.id,
        request,
      });

    } catch (err: any) {
      console.error("Stripe transfer failed:", err);
      return NextResponse.json(
        { error: `Stripe transfer failed: ${err.message}` },
        { status: 500 }
      );
    }
  }

  // ── Handle PayPal / manual payout ─────────────────────────────
  // Create pending request — founder processes manually or via PayPal API
  const { data: request } = await supabase
    .from("payout_requests")
    .insert({
      user_id: user.id,
      payout_method_id: method.id,
      amount_cents,
      status: "pending",
    })
    .select()
    .single();

  // Notify founder for manual processing
  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: FOUNDER_ID,
    message_type: "payout_request",
    content: `💰 Payout request: ${profile?.display_name ?? "A user"} wants to cash out $${(amount_cents / 100).toFixed(2)} via ${method.method === "paypal" ? "PayPal" : method.method} (${method.handle})`,
    topic: "payouts",
    payload: {
      payout_request_id: request?.id,
      amount_cents,
      method: method.method,
      handle: method.handle,
    },
  });

  // Notify user
  await supabase.from("messages").insert({
    sender_id: FOUNDER_ID,
    recipient_id: user.id,
    message_type: "payout_pending",
    content: `💰 Your cash out request of $${(amount_cents / 100).toFixed(2)} via ${method.method === "paypal" ? "PayPal" : method.method} has been submitted. We'll process it within 24-48 hours.`,
    topic: "payouts",
    payload: {
      payout_request_id: request?.id,
      amount_cents,
    },
  });

  return NextResponse.json({
    success: true,
    method: method.method,
    status: "pending",
    request,
  });
}
