import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Service role — this runs as a cron job, not as a user
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export async function GET(request: NextRequest) {
  // Optional: verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find transactions past their inspection deadline with no dispute filed
  const { data: expired, error: queryError } = await supabase
    .from("transactions")
    .select("id, payment_intent_id, borrower_id, owner_id, item_id, deposit_cents")
    .eq("state", "return_submitted")
    .not("inspection_deadline", "is", null)
    .lt("inspection_deadline", new Date().toISOString());

  if (queryError) {
    return NextResponse.json(
      { error: "Query failed", detail: queryError.message },
      { status: 500 }
    );
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ released: 0 });
  }

  // Filter out any that have disputes filed
  const txIds = expired.map((t) => t.id);
  const { data: disputes } = await supabase
    .from("disputes")
    .select("transaction_id")
    .in("transaction_id", txIds);

  const disputedTxIds = new Set((disputes ?? []).map((d) => d.transaction_id));
  const toRelease = expired.filter((t) => !disputedTxIds.has(t.id));

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const tx of toRelease) {
    try {
      // Cancel Stripe hold
      if (tx.payment_intent_id) {
        const pi = await stripe.paymentIntents.retrieve(tx.payment_intent_id);
        if (pi.status === "requires_capture") {
          await stripe.paymentIntents.cancel(tx.payment_intent_id);
        }
      }

      const now = new Date().toISOString();

      // Complete the transaction
      await supabase
        .from("transactions")
        .update({
          state: "completed",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", tx.id);

      // Release the item back to available
      await supabase
        .from("items")
        .update({ availability_status: "available", updated_at: now })
        .eq("id", tx.item_id);

      // Log state change
      await supabase.from("transaction_state_log").insert({
        transaction_id: tx.id,
        from_state: "return_submitted",
        to_state: "completed",
        changed_by: null,
        change_reason: "inspection_window_expired_auto_release",
      });

      // Get item title for notifications
      const { data: item } = await supabase
        .from("items")
        .select("title")
        .eq("id", tx.item_id)
        .single();

      const itemTitle = item?.title ?? "the item";
      const depositDollars = tx.deposit_cents
        ? `$${(tx.deposit_cents / 100).toFixed(2)}`
        : "The deposit";

      // Notify borrower: deposit released
      await supabase.from("messages").insert({
        sender_id: tx.owner_id,
        recipient_id: tx.borrower_id,
        message_type: "transaction_completed",
        content: `Inspection window closed for "${itemTitle}". ${depositDollars} deposit has been released. Transaction complete!`,
        topic: tx.item_id,
        payload: {
          transaction_id: tx.id,
          item_id: tx.item_id,
          item_title: itemTitle,
          deposit_released: true,
          auto_released: true,
          completed_at: now,
        },
      });

      // Notify owner: window expired
      await supabase.from("messages").insert({
        sender_id: tx.borrower_id,
        recipient_id: tx.owner_id,
        message_type: "transaction_completed",
        content: `The 24-hour inspection window for "${itemTitle}" has closed. No damage was reported. ${depositDollars} deposit has been released to the borrower.`,
        topic: tx.item_id,
        payload: {
          transaction_id: tx.id,
          item_id: tx.item_id,
          item_title: itemTitle,
          deposit_released: true,
          auto_released: true,
          completed_at: now,
        },
      });

      results.push({ id: tx.id, success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ id: tx.id, success: false, error: message });
    }
  }

  return NextResponse.json({
    released: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    details: results,
  });
}
