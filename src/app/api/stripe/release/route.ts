import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabase } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

/**
 * POST /api/stripe/release
 *
 * Releases or adjusts the deposit hold after item return.
 *
 * Actions:
 *   "release_full"   — item returned in good condition, cancel PI (no charge)
 *   "capture_damage" — damage confirmed, capture partial or full amount
 *   "capture_full"   — full deposit captured (e.g. item not returned)
 *
 * Body: {
 *   transaction_id: string,
 *   action: "release_full" | "capture_damage" | "capture_full",
 *   damage_cents?: number  — required for capture_damage
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { transaction_id, action, damage_cents } = await request.json();

    if (!transaction_id || !action) {
      return NextResponse.json(
        { error: "transaction_id and action are required" },
        { status: 400 },
      );
    }

    const validActions = ["release_full", "capture_damage", "capture_full"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabase();

    // ── Auth check ──────────────────────────────────────────────────────────
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Fetch transaction ───────────────────────────────────────────────────
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    // Only borrower or owner can trigger release
    if (
      transaction.borrower_id !== user.id &&
      transaction.owner_id !== user.id
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Transaction must be in returned or inspecting state
    const releasableStates = ["returned", "inspecting", "approved", "active"];
    if (!releasableStates.includes(transaction.state)) {
      return NextResponse.json(
        {
          error: `Cannot release deposit — transaction is in state: ${transaction.state}`,
        },
        { status: 400 },
      );
    }

    // Get PI id from notes field (stored during hold)
    const paymentIntentId = transaction.notes;
    if (!paymentIntentId || !paymentIntentId.startsWith("pi_")) {
      return NextResponse.json(
        { error: "No payment intent found on this transaction" },
        { status: 400 },
      );
    }

    let result: any = {};
    let newState = "completed";
    let depositReturned = 0;

    if (action === "release_full") {
      // ── Cancel PI — borrower gets full deposit back, no charge ─────────────
      await stripe.paymentIntents.cancel(paymentIntentId);
      depositReturned = transaction.deposit_held;
      result = { released: depositReturned, charged: 0 };
    } else if (action === "capture_damage") {
      // ── Capture partial — damage fee charged, remainder returned ────────────
      if (!damage_cents || damage_cents <= 0) {
        return NextResponse.json(
          { error: "damage_cents is required for capture_damage" },
          { status: 400 },
        );
      }
      const captureable = Math.min(damage_cents, transaction.deposit_held);
      await stripe.paymentIntents.capture(paymentIntentId, {
        amount_to_capture: captureable,
      });
      depositReturned = transaction.deposit_held - captureable;
      newState = "completed";
      result = { released: depositReturned, charged: captureable };
    } else if (action === "capture_full") {
      // ── Capture full deposit ────────────────────────────────────────────────
      await stripe.paymentIntents.capture(paymentIntentId);
      depositReturned = 0;
      result = { released: 0, charged: transaction.deposit_held };
    }

    // ── Update transaction state ────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        state: newState,
        deposit_returned: depositReturned,
        returned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction_id);

    if (updateError) throw updateError;

    // ── Log to agent_logs ───────────────────────────────────────────────────
    await supabase.from("agent_logs").insert({
      agent: "LedgerAgent",
      action: `deposit_${action}`,
      payload: {
        transaction_id,
        payment_intent_id: paymentIntentId,
        action,
        ...result,
      },
      building_id: transaction.building_id,
    });

    return NextResponse.json({
      success: true,
      action,
      ...result,
      transaction_id,
      new_state: newState,
    });
  } catch (error: any) {
    console.error("Stripe release error:", error);

    // Handle Stripe-specific errors gracefully
    if (error?.type === "StripeInvalidRequestError") {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to release deposit" },
      { status: 500 },
    );
  }
}
