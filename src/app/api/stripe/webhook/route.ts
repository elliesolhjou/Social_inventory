import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabase } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for deposit lifecycle.
 * Verifies webhook signature using STRIPE_WEBHOOK_SECRET.
 *
 * Events handled:
 *   payment_intent.created          → transaction state: requested (no-op, already set)
 *   payment_intent.amount_capturable_updated → deposit authorized, update state: approved
 *   payment_intent.captured         → deposit charged (damage), update state: completed
 *   payment_intent.canceled         → deposit released fully, update state: completed
 *   payment_intent.payment_failed   → payment failed, update state: cancelled
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook error: ${err.message}` },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();

  try {
    switch (event.type) {
      // ── Deposit authorized — funds reserved on card ──────────────────────
      case "payment_intent.amount_capturable_updated": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { transaction_id } = pi.metadata;
        if (!transaction_id) break;

        await supabase
          .from("transactions")
          .update({
            state: "approved",
            deposit_held: pi.amount_capturable,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction_id)
          .eq("state", "requested");

        await supabase.from("agent_logs").insert({
          agent: "LedgerAgent",
          action: "webhook_deposit_authorized",
          payload: {
            transaction_id,
            payment_intent_id: pi.id,
            amount_capturable: pi.amount_capturable,
          },
        });
        break;
      }

      // ── Deposit captured — funds charged (damage case) ───────────────────
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { transaction_id } = pi.metadata;
        if (!transaction_id) break;

        const charged = pi.amount_received;
        const held = pi.amount;
        const returned = held - charged;

        await supabase
          .from("transactions")
          .update({
            state: "completed",
            deposit_returned: returned,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction_id);

        await supabase.from("agent_logs").insert({
          agent: "LedgerAgent",
          action: "webhook_deposit_captured",
          payload: {
            transaction_id,
            payment_intent_id: pi.id,
            charged,
            returned,
          },
        });
        break;
      }

      // ── Deposit canceled — full refund, no charge ────────────────────────
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { transaction_id } = pi.metadata;
        if (!transaction_id) break;

        await supabase
          .from("transactions")
          .update({
            state: "completed",
            deposit_returned: pi.amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction_id);

        await supabase.from("agent_logs").insert({
          agent: "LedgerAgent",
          action: "webhook_deposit_released",
          payload: {
            transaction_id,
            payment_intent_id: pi.id,
            returned: pi.amount,
          },
        });
        break;
      }

      // ── Payment failed ───────────────────────────────────────────────────
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { transaction_id } = pi.metadata;
        if (!transaction_id) break;

        await supabase
          .from("transactions")
          .update({
            state: "cancelled",
            notes: `Payment failed: ${pi.last_payment_error?.message ?? "unknown"}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction_id);

        await supabase.from("agent_logs").insert({
          agent: "LedgerAgent",
          action: "webhook_payment_failed",
          payload: {
            transaction_id,
            payment_intent_id: pi.id,
            error: pi.last_payment_error?.message,
          },
        });
        break;
      }

      default:
        // Unhandled event — acknowledge receipt
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    // Return 200 to Stripe so it doesn't retry — log the error internally
    return NextResponse.json({ received: true, error: error.message });
  }
}

// Disable body parsing — Stripe needs raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
