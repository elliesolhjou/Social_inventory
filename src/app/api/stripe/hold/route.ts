import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabase } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

/**
 * POST /api/stripe/hold
 *
 * Creates a Stripe PaymentIntent with manual capture (deposit hold).
 * Updates transaction state to 'approved' and stores payment_intent_id.
 *
 * Body: { transaction_id: string }
 * Returns: { client_secret: string, payment_intent_id: string }
 */
export async function POST(request: NextRequest) {
  // Always return JSON — never let Next.js return HTML error page
  try {
    const body = await request.json().catch(() => ({}));
    const { transaction_id } = body;

    if (!transaction_id) {
      return NextResponse.json(
        { error: "transaction_id is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();

    // ── Auth check ──────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Fetch transaction + item ────────────────────────────────────────────
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*, item:items(title, deposit_cents)")
      .eq("id", transaction_id)
      .eq("borrower_id", user.id) // only borrower can initiate hold
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found or unauthorized" },
        { status: 404 }
      );
    }

    if (transaction.state !== "requested") {
      return NextResponse.json(
        { error: `Cannot hold deposit — transaction is in state: ${transaction.state}` },
        { status: 400 }
      );
    }

    const depositCents = transaction.item?.deposit_cents ?? transaction.deposit_held;
    if (!depositCents || depositCents <= 0) {
      return NextResponse.json(
        { error: "Item has no deposit amount configured" },
        { status: 400 }
      );
    }

    // ── Create Stripe PaymentIntent with manual capture ─────────────────────
    // manual capture = funds authorized but NOT charged until we capture
    const paymentIntent = await stripe.paymentIntents.create({
      amount: depositCents,
      currency: "usd",
      capture_method: "manual",
      metadata: {
        transaction_id,
        item_id: transaction.item_id,
        borrower_id: transaction.borrower_id,
        owner_id: transaction.owner_id,
      },
      description: `Deposit hold — ${transaction.item?.title ?? "item"}`,
    });

    // ── Update transaction: state → approved, store deposit_held + pi id ────
    const updatePayload: Record<string, any> = {
      state: "approved",
      deposit_held: depositCents,
      approved_at: new Date().toISOString(),
      notes: paymentIntent.id,
      updated_at: new Date().toISOString(),
    };

    // Add payment_intent_id if column exists (run stripe-schema.sql first)
    try {
      updatePayload.payment_intent_id = paymentIntent.id;
    } catch {}

    const { error: updateError } = await supabase
      .from("transactions")
      .update(updatePayload)
      .eq("id", transaction_id);

    if (updateError) {
      // Stripe PI created but DB update failed — cancel the PI to avoid orphaned holds
      await stripe.paymentIntents.cancel(paymentIntent.id);
      throw updateError;
    }

    // ── Log to agent_logs ───────────────────────────────────────────────────
    await supabase.from("agent_logs").insert({
      agent: "LedgerAgent",
      action: "deposit_hold",
      payload: {
        transaction_id,
        payment_intent_id: paymentIntent.id,
        amount_cents: depositCents,
      },
      building_id: transaction.building_id,
    });

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount_cents: depositCents,
    });

  } catch (error: any) {
    console.error("Stripe hold error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create deposit hold" },
      { status: 500 }
    );
  }
}