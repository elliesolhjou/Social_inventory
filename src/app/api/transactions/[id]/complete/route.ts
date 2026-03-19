import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Create clients inside function to guarantee env vars are loaded
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-04-30.basil",
  });

  const supabase = await createServerSupabase();
  const { id: transactionId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("id, item_id, borrower_id, owner_id, state, payment_intent_id")
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json(
      {
        error: "Transaction not found",
        debug: { txError, transactionId, hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL, hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
      },
      { status: 404 }
    );
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

  const { error: updateError } = await supabaseAdmin
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

  await supabaseAdmin
    .from("items")
    .update({ availability_status: "available", updated_at: now })
    .eq("id", transaction.item_id);

  await supabaseAdmin.from("transaction_state_log").insert({
    transaction_id: transactionId,
    from_state: "return_submitted",
    to_state: "completed",
    changed_by: user.id,
    change_reason: "owner_confirmed_no_damage",
  });

  const { data: ownerProfile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const ownerName = ownerProfile?.display_name ?? "The owner";

  const { data: item } = await supabaseAdmin
    .from("items")
    .select("title, deposit_cents")
    .eq("id", transaction.item_id)
    .single();

  const itemTitle = item?.title ?? "the item";

  const depositDollars = item?.deposit_cents
    ? `$${((item as any)?.deposit_cents / 100).toFixed(2)}`
    : "Your deposit";

  await supabaseAdmin.from("messages").insert({
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

  await supabaseAdmin.from("messages").insert({
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
