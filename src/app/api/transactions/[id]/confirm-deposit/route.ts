import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

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
    .select("id, item_id, borrower_id, owner_id, state, deposit_held, transaction_type, borrow_days, daily_rent_cents")
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  // 3. Only the borrower can confirm deposit
  if (transaction.borrower_id !== user.id) {
    return NextResponse.json(
      { error: "Only the borrower can confirm the deposit" },
      { status: 403 }
    );
  }

  // 4. Must be in 'approved' state
  if (transaction.state !== "approved") {
    return NextResponse.json(
      {
        error: `Cannot confirm deposit for a transaction in state "${transaction.state}"`,
      },
      { status: 409 }
    );
  }

  // 5. Get item details
  const { data: item } = await supabase
    .from("items")
    .select("title, deposit_cents, rent_price_day_cents")
    .eq("id", transaction.item_id)
    .single();

  const depositAmountCents =
    item?.deposit_cents ?? transaction.deposit_held ?? 5000;
  const itemTitle = item?.title ?? "Item";

  // 6. Determine if this is a rental
  const isRental = transaction.transaction_type === "rent";
  const rentalDays = transaction.borrow_days ?? 1;
  const dailyRateCents = transaction.daily_rent_cents ?? item?.rent_price_day_cents ?? 0;
  const rentalFeeCents = isRental ? rentalDays * dailyRateCents : 0;

  // 7. Get origin for redirects
  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  // 8. Create Stripe Checkout Session
  try {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (isRental && rentalFeeCents > 0) {
      // ── RENTAL: Immediate charge for rental fee + deposit ──────────
      // Rental fee line item
      lineItems.push({
        price_data: {
          currency: "usd",
          unit_amount: rentalFeeCents,
          product_data: {
            name: `Rental: ${itemTitle} (${rentalDays} day${rentalDays !== 1 ? "s" : ""})`,
            description: `${rentalDays} day${rentalDays !== 1 ? "s" : ""} × $${(dailyRateCents / 100).toFixed(2)}/day`,
          },
        },
        quantity: 1,
      });

      // Deposit line item (charged immediately, refunded on safe return)
      lineItems.push({
        price_data: {
          currency: "usd",
          unit_amount: depositAmountCents,
          product_data: {
            name: `Refundable deposit: ${itemTitle}`,
            description:
              "This deposit will be refunded when you return the item in good condition.",
          },
        },
        quantity: 1,
      });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        // Automatic capture — charges immediately for rentals
        payment_intent_data: {
          capture_method: "automatic",
          metadata: {
            transaction_id: transactionId,
            item_id: transaction.item_id,
            borrower_id: user.id,
            owner_id: transaction.owner_id,
            transaction_type: "rent",
            rental_fee_cents: String(rentalFeeCents),
            deposit_cents: String(depositAmountCents),
            rental_days: String(rentalDays),
          },
        },
        line_items: lineItems,
        success_url: `${origin}/api/transactions/${transactionId}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/inbox`,
        metadata: {
          transaction_id: transactionId,
          transaction_type: "rent",
        },
      });

      return NextResponse.json({
        checkout_url: session.url,
        session_id: session.id,
        transaction_type: "rent",
        rental_fee_cents: rentalFeeCents,
        deposit_cents: depositAmountCents,
        total_cents: rentalFeeCents + depositAmountCents,
      });

    } else {
      // ── BORROW: Manual capture (hold only) — existing behavior ────
      lineItems.push({
        price_data: {
          currency: "usd",
          unit_amount: depositAmountCents,
          product_data: {
            name: `Deposit hold: ${itemTitle}`,
            description:
              "Refundable deposit. Your card will only be charged if the item is damaged.",
          },
        },
        quantity: 1,
      });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_intent_data: {
          capture_method: "manual",
          metadata: {
            transaction_id: transactionId,
            item_id: transaction.item_id,
            borrower_id: user.id,
            owner_id: transaction.owner_id,
            transaction_type: "borrow",
          },
        },
        line_items: lineItems,
        success_url: `${origin}/api/transactions/${transactionId}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/inbox`,
        metadata: {
          transaction_id: transactionId,
          transaction_type: "borrow",
        },
      });

      return NextResponse.json({
        checkout_url: session.url,
        session_id: session.id,
        transaction_type: "borrow",
        deposit_cents: depositAmountCents,
      });
    }
  } catch (err: any) {
    console.error("Stripe Checkout creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session", detail: err.message },
      { status: 500 }
    );
  }
}
