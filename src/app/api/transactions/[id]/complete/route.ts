import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    .select("id, item_id, borrower_id, owner_id, state, payment_intent_id, transaction_type, rent_captured_cents, deposit_held")
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
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

  const isRental = transaction.transaction_type === "rent";
  const depositCents = transaction.deposit_held ?? 0;

  // ── Handle Stripe deposit release ──────────────────────────────
  if (transaction.payment_intent_id) {
    try {
      if (isRental) {
        // RENTAL: Payment was charged immediately (automatic capture).
        // Refund only the deposit portion. Rental fee stays.
        if (depositCents > 0) {
          await stripe.refunds.create({
            payment_intent: transaction.payment_intent_id,
            amount: depositCents,
            reason: "requested_by_customer",
            metadata: {
              transaction_id: transactionId,
              refund_type: "deposit_return",
              rental_fee_kept: String(transaction.rent_captured_cents ?? 0),
            },
          });
        }
      } else {
        // BORROW: Payment was held (manual capture). Cancel to release.
        const pi = await stripe.paymentIntents.retrieve(transaction.payment_intent_id);
        if (pi.status === "requires_capture") {
          await stripe.paymentIntents.cancel(transaction.payment_intent_id);
        }
      }
    } catch (stripeErr: unknown) {
      const message = stripeErr instanceof Error ? stripeErr.message : "Stripe operation failed";
      console.error("Stripe deposit release failed:", message);
      return NextResponse.json(
        { error: "Failed to release deposit", detail: message },
        { status: 500 }
      );
    }
  }

  const now = new Date().toISOString();

  // ── Update transaction state ───────────────────────────────────
  const { error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({
      state: "completed",
      completed_at: now,
      deposit_released_cents: depositCents,
      updated_at: now,
    })
    .eq("id", transactionId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to complete transaction", detail: updateError.message },
      { status: 500 }
    );
  }

  // ── Update item availability ───────────────────────────────────
  await supabaseAdmin
    .from("items")
    .update({ availability_status: "available", updated_at: now })
    .eq("id", transaction.item_id);

  // ── Log state change ───────────────────────────────────────────
  await supabaseAdmin.from("transaction_state_log").insert({
    transaction_id: transactionId,
    from_state: "return_submitted",
    to_state: "completed",
    changed_by: user.id,
    change_reason: "owner_confirmed_no_damage",
    metadata: {
      transaction_type: isRental ? "rent" : "borrow",
      deposit_refunded_cents: depositCents,
      rental_fee_kept_cents: isRental ? transaction.rent_captured_cents : 0,
    },
  });

  // ── Get item and profile info ──────────────────────────────────
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
  const depositDollars = depositCents > 0
    ? `$${(depositCents / 100).toFixed(2)}`
    : "Your deposit";
  const rentalFeeDollars = transaction.rent_captured_cents
    ? `$${(transaction.rent_captured_cents / 100).toFixed(2)}`
    : "$0";

  // ── Message to borrower ────────────────────────────────────────
  const borrowerMessage = isRental
    ? `${ownerName} confirmed "${itemTitle}" is in good condition. Your ${depositDollars} deposit has been refunded. Rental fee of ${rentalFeeDollars} has been paid to the owner. Transaction complete!`
    : `${ownerName} confirmed "${itemTitle}" is in good condition. ${depositDollars} deposit has been released. Transaction complete!`;

  await supabaseAdmin.from("messages").insert({
    sender_id: user.id,
    recipient_id: transaction.borrower_id,
    message_type: "transaction_completed",
    content: borrowerMessage,
    topic: transaction.item_id,
    payload: {
      transaction_id: transactionId,
      item_id: transaction.item_id,
      item_title: itemTitle,
      deposit_released: true,
      deposit_refunded_cents: depositCents,
      transaction_type: isRental ? "rent" : "borrow",
      rental_fee_cents: isRental ? transaction.rent_captured_cents : 0,
      completed_at: now,
    },
  });

  // ── Message to owner ───────────────────────────────────────────
  const ownerMessage = isRental
    ? `You confirmed "${itemTitle}" is back in good condition. The borrower's ${depositDollars} deposit has been refunded. Your rental earnings of ${rentalFeeDollars} are available in your Payouts dashboard. Transaction complete!`
    : `You confirmed "${itemTitle}" is back in good condition. The borrower's ${depositDollars} deposit has been released. Transaction complete!`;

  await supabaseAdmin.from("messages").insert({
    sender_id: user.id,
    recipient_id: transaction.owner_id,
    message_type: "transaction_completed",
    content: ownerMessage,
    topic: transaction.item_id,
    payload: {
      transaction_id: transactionId,
      item_id: transaction.item_id,
      item_title: itemTitle,
      deposit_released: true,
      transaction_type: isRental ? "rent" : "borrow",
      rental_earnings_cents: isRental ? transaction.rent_captured_cents : 0,
      completed_at: now,
    },
  });

  return NextResponse.json({
    success: true,
    new_state: "completed",
    deposit_released: true,
    deposit_refunded_cents: depositCents,
    transaction_type: isRental ? "rent" : "borrow",
    rental_fee_kept_cents: isRental ? transaction.rent_captured_cents : 0,
  });
}
