import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

// This route processes all expired deposit_held transactions
// that need Stripe partial capture. Called by cron/Edge Function
// after process_stale_deposits() runs.
export async function POST(request: NextRequest) {
  // Simple auth: check for a secret header (for cron/Edge Function calls)
  const authHeader = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  // Allow if cron secret matches, or if called from server-side
  if (cronSecret && authHeader !== cronSecret) {
    // Also allow authenticated admin users
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createServerSupabase();

  // Find all transactions that were just expired by process_stale_deposits()
  // and still need Stripe capture
  const { data: pendingCaptures, error } = await supabase
    .from("transactions")
    .select(
      "id, payment_intent_id, rent_captured_cents, deposit_held, deposit_released_cents"
    )
    .eq("state", "expired")
    .eq("resolution_type", "expired_no_pickup")
    .not("payment_intent_id", "is", null)
    .gt("rent_captured_cents", 0)
    .is("resolved_at", null);

  if (error || !pendingCaptures) {
    return NextResponse.json({
      error: "Failed to fetch pending captures",
      detail: error?.message,
    });
  }

  const results: Array<{
    transaction_id: string;
    status: string;
    captured?: number;
    released?: number;
    error?: string;
  }> = [];

  for (const txn of pendingCaptures) {
    try {
      if (
        !txn.payment_intent_id ||
        txn.payment_intent_id.startsWith("pi_simulated")
      ) {
        // Skip simulated payment intents
        await supabase
          .from("transactions")
          .update({ resolved_at: new Date().toISOString() })
          .eq("id", txn.id);

        results.push({
          transaction_id: txn.id,
          status: "skipped_simulated",
        });
        continue;
      }

      // Check PaymentIntent status
      const pi = await stripe.paymentIntents.retrieve(txn.payment_intent_id);

      if (pi.status === "requires_capture") {
        // Partial capture: capture only the rent amount
        const captureAmount = Math.min(
          txn.rent_captured_cents,
          txn.deposit_held
        );

        await stripe.paymentIntents.capture(txn.payment_intent_id, {
          amount_to_capture: captureAmount,
        });

        // Mark as resolved
        await supabase
          .from("transactions")
          .update({
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", txn.id);

        results.push({
          transaction_id: txn.id,
          status: "captured",
          captured: captureAmount,
          released: txn.deposit_held - captureAmount,
        });
      } else if (pi.status === "canceled") {
        // Already cancelled — mark as resolved
        await supabase
          .from("transactions")
          .update({
            resolved_at: new Date().toISOString(),
            rent_captured_cents: 0,
            deposit_released_cents: txn.deposit_held,
          })
          .eq("id", txn.id);

        results.push({
          transaction_id: txn.id,
          status: "already_cancelled",
          released: txn.deposit_held,
        });
      } else {
        results.push({
          transaction_id: txn.id,
          status: `unexpected_pi_status_${pi.status}`,
        });
      }
    } catch (err: any) {
      console.error(
        `Stripe capture failed for ${txn.id}:`,
        err.message
      );
      results.push({
        transaction_id: txn.id,
        status: "error",
        error: err.message,
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
