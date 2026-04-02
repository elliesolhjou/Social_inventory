import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { id: transactionId } = await params;
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.redirect(new URL("/inbox", request.url));
  }

  try {
    // 1. Retrieve the Checkout Session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    // 2. Verify the session matches this transaction
    if (session.metadata?.transaction_id !== transactionId) {
      console.error("Session/transaction mismatch");
      return NextResponse.redirect(new URL("/inbox", request.url));
    }

    // 3. Determine transaction type from metadata
    const isRental = session.metadata?.transaction_type === "rent";

    // 4. Get PaymentIntent
    const pi = typeof session.payment_intent === "string"
      ? await stripe.paymentIntents.retrieve(session.payment_intent)
      : session.payment_intent;

    // For borrow: PI should be "requires_capture" (manual hold)
    // For rent: PI should be "succeeded" (automatic charge)
    if (!isRental && pi?.status !== "requires_capture") {
      console.error("Borrow PaymentIntent not authorized:", pi?.status);
      return NextResponse.redirect(new URL("/inbox", request.url));
    }

    if (isRental && pi?.status !== "succeeded") {
      console.error("Rental PaymentIntent not succeeded:", pi?.status);
      return NextResponse.redirect(new URL("/inbox", request.url));
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntentId) {
      console.error("No payment intent found");
      return NextResponse.redirect(new URL("/inbox", request.url));
    }

    // 5. Fetch transaction to verify state
    const { data: transaction } = await supabase
      .from("transactions")
      .select("id, item_id, borrower_id, owner_id, state, borrow_days, daily_rent_cents")
      .eq("id", transactionId)
      .single();

    if (!transaction || transaction.state !== "approved") {
      return NextResponse.redirect(new URL("/inbox", request.url));
    }

    // 6. Get item details
    const { data: item } = await supabase
      .from("items")
      .select("title, deposit_cents, rent_price_day_cents")
      .eq("id", transaction.item_id)
      .single();

    const depositAmountCents = item?.deposit_cents ?? 0;
    const itemTitle = item?.title ?? "the item";
    const depositDisplay = `$${(depositAmountCents / 100).toFixed(2)}`;

    // 7. Calculate rental amounts
    const rentalDays = transaction.borrow_days ?? 1;
    const dailyRateCents = transaction.daily_rent_cents ?? item?.rent_price_day_cents ?? 0;
    const rentalFeeCents = isRental ? rentalDays * dailyRateCents : 0;
    const rentalFeeDisplay = `$${(rentalFeeCents / 100).toFixed(2)}`;

    // 8. Update transaction to deposit_held
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      state: "deposit_held",
      deposit_confirmed_at: now,
      payment_intent_id: paymentIntentId,
      deposit_held: depositAmountCents,
      updated_at: now,
    };

    if (isRental) {
      updateData.rent_captured_cents = rentalFeeCents;
      updateData.daily_rent_cents = dailyRateCents;
    }

    await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", transactionId);

    // 9. Update item availability
    await supabase
      .from("items")
      .update({ availability_status: "borrowed", updated_at: now })
      .eq("id", transaction.item_id);

    // 10. Log state change
    await supabase.from("transaction_state_log").insert({
      transaction_id: transactionId,
      from_state: "approved",
      to_state: "deposit_held",
      changed_by: transaction.borrower_id,
      change_reason: isRental ? "borrower_paid_rental_and_deposit" : "borrower_confirmed_deposit",
      metadata: {
        payment_intent_id: paymentIntentId,
        stripe_session_id: sessionId,
        deposit_amount_cents: depositAmountCents,
        transaction_type: isRental ? "rent" : "borrow",
        ...(isRental && {
          rental_fee_cents: rentalFeeCents,
          rental_days: rentalDays,
          daily_rate_cents: dailyRateCents,
        }),
      },
    });

    // 11. Record rental earnings for owner (if rental)
    if (isRental && rentalFeeCents > 0) {
      await supabaseAdmin.from("earnings_ledger").insert({
        user_id: transaction.owner_id,
        transaction_id: transactionId,
        amount_cents: rentalFeeCents,
        type: "rental",
        description: `Rental: "${itemTitle}" for ${rentalDays} day${rentalDays !== 1 ? "s" : ""} at $${(dailyRateCents / 100).toFixed(2)}/day`,
      });
    }

    // 12. Get borrower name
    const { data: borrowerProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", transaction.borrower_id)
      .single();

    const borrowerName = borrowerProfile?.display_name ?? "The borrower";

    // 13. Send message to owner
    const messageContent = isRental
      ? `${borrowerName} paid the rental fee (${rentalFeeDisplay} for ${rentalDays} day${rentalDays !== 1 ? "s" : ""}) and deposit (${depositDisplay}) for "${itemTitle}". Coordinate pickup!`
      : `${borrowerName} confirmed the deposit (${depositDisplay}) for "${itemTitle}". Coordinate pickup!`;

    await supabase.from("messages").insert({
      sender_id: transaction.borrower_id,
      recipient_id: transaction.owner_id,
      message_type: isRental ? "rental_paid" : "deposit_confirmed",
      content: messageContent,
      topic: transaction.item_id,
      payload: {
        transaction_id: transactionId,
        item_id: transaction.item_id,
        deposit_amount_cents: depositAmountCents,
        item_title: itemTitle,
        payment_intent_id: paymentIntentId,
        transaction_type: isRental ? "rent" : "borrow",
        ...(isRental && {
          rental_fee_cents: rentalFeeCents,
          rental_days: rentalDays,
          daily_rate_cents: dailyRateCents,
        }),
      },
    });

    // 14. Redirect back to inbox
    return NextResponse.redirect(new URL("/inbox", request.url));
  } catch (err: any) {
    console.error("Checkout success handler failed:", err);
    return NextResponse.redirect(new URL("/inbox", request.url));
  }
}
