import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: transactionId } = await params;

  // 1. Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Fetch transaction
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("id, item_id, borrower_id, owner_id, state, payment_intent_id")
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  // 3. Only the borrower can cancel
  if (transaction.borrower_id !== user.id) {
    return NextResponse.json(
      { error: "Only the borrower can cancel" },
      { status: 403 }
    );
  }

  // 4. Can only cancel from approved or deposit_held states
  if (!["approved", "deposit_held"].includes(transaction.state)) {
    return NextResponse.json(
      {
        error: `Cannot cancel a transaction in state "${transaction.state}"`,
      },
      { status: 409 }
    );
  }

  // 5. If deposit was held, cancel the Stripe PaymentIntent
  if (transaction.state === "deposit_held" && transaction.payment_intent_id) {
    // TODO: Actual Stripe cancellation
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // await stripe.paymentIntents.cancel(transaction.payment_intent_id);
    console.log(
      `[Stripe stub] Would cancel PI: ${transaction.payment_intent_id}`
    );
  }

  // 6. Update transaction
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      state: "cancelled",
      cancelled_at: now,
      resolution_type: "cancelled_by_borrower",
      updated_at: now,
    })
    .eq("id", transactionId);

  if (updateError) {
    console.error("Cancel failed:", updateError);
    return NextResponse.json(
      { error: "Failed to cancel", detail: updateError.message },
      { status: 500 }
    );
  }

  // 7. Sync borrow_requests
  await supabase
    .from("borrow_requests")
    .update({ status: "cancelled", updated_at: now })
    .eq("transaction_id", transactionId);

  // 8. Release item
  await supabase
    .from("items")
    .update({ availability_status: "available", updated_at: now })
    .eq("id", transaction.item_id);

  // 9. Log state change
  await supabase.from("transaction_state_log").insert({
    transaction_id: transactionId,
    from_state: transaction.state,
    to_state: "cancelled",
    changed_by: user.id,
    change_reason: "borrower_cancelled",
  });

  // 10. Notify owner
  const { data: borrowerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const { data: item } = await supabase
    .from("items")
    .select("title")
    .eq("id", transaction.item_id)
    .single();

  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: transaction.owner_id,
    message_type: "request_cancelled",
    content: `${borrowerProfile?.display_name ?? "The borrower"} cancelled their request for "${item?.title ?? "this item"}".`,
    payload: {
      transaction_id: transactionId,
      item_id: transaction.item_id,
    },
    topic: transaction.item_id,
  });

  return NextResponse.json({
    success: true,
    transaction_id: transactionId,
    new_state: "cancelled",
  });
}
