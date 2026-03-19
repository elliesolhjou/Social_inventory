import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: transactionId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("id, item_id, borrower_id, owner_id, state, payment_intent_id, deposit_cents")
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Only the owner can complete this transaction" },
      { status: 403 }
    );
  }

  if (transaction.state !== "return_submitted") {
    return NextResponse.json(
      { error: `Cannot complete a transaction in state "${transaction.state}"` },
      { status: 409 }
    );
  }

  // Release Stripe deposit hold
  if (transaction.payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(transaction.payment_intent_id);
      if (pi.status === "requires_capture") {
        await stripe.paymentIntents.cancel(transaction.payment_intent_id);
      }
    } catch (stripeErr: unknown) {
      const message = stripeErr instanceof Error ? stripeErr.message : "Stripe cancel failed";
      return NextResponse.json(
        { error: "Failed to release deposit", detail: message },
        { status: 500 }
      );
    }
  }

  const now = new Date().toISOString();

  // Transition to completed
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      state: "completed",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", transactionId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to complete transaction", detail: updateError.message },
      { status: 500 }
    );
  }

  // Update item availability back to available
  await supabase
    .from("items")
    .update({ availability_status: "available", updated_at: now })
    .eq("id", transaction.item_id);

  // Log state change
  await supabase.from("transaction_state_log").insert({
    transaction_id: transactionId,
    from_state: "return_submitted",
    to_state: "completed",
    changed_by: user.id,
    change_reason: "owner_confirmed_no_damage",
  });

  // Get names and item title for notifications
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const ownerName = ownerProfile?.display_name ?? "The owner";

  const { data: item } = await supabase
    .from("items")
    .select("title")
    .eq("id", transaction.item_id)
    .single();

  const itemTitle = item?.title ?? "the item";

  const depositDollars = transaction.deposit_cents
    ? `$${(transaction.deposit_cents / 100).toFixed(2)}`
    : "Your deposit";

  // Notify borrower: deposit released, transaction complete
  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: transaction.borrower_id,
    message_type: "transaction_completed",
    content: `${ownerName} confirmed "${itemTitle}" is in good condition. ${depositDollars} deposit has been released. Transaction complete!`,
    topic: transaction.item_id,
    payload: {
      transaction_id: transactionId,
      item_id: transaction.item_id,
      item_title: itemTitle,
      deposit_released: true,
      completed_at: now,
    },
  });

  // Notify owner: confirmation recorded
  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: transaction.owner_id,
    message_type: "transaction_completed",
    content: `You confirmed "${itemTitle}" is back in good condition. The borrower's ${depositDollars} deposit has been released. Transaction complete!`,
    topic: transaction.item_id,
    payload: {
      transaction_id: transactionId,
      item_id: transaction.item_id,
      item_title: itemTitle,
      deposit_released: true,
      completed_at: now,
    },
  });

  return NextResponse.json({
    success: true,
    new_state: "completed",
    deposit_released: true,
  });
}
