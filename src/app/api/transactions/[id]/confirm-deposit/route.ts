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
    .select("id, item_id, borrower_id, owner_id, state, deposit_held")
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
    .select("title, deposit_cents")
    .eq("id", transaction.item_id)
    .single();

  const depositAmountCents =
    item?.deposit_cents ?? transaction.deposit_held ?? 5000;
  const itemTitle = item?.title ?? "Item deposit";

  // 6. Get origin for redirects
  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  // 7. Create Stripe Checkout Session
  // capture_method: 'manual' = card is authorized (held) but NOT charged.
  // We capture only if damage is confirmed. Otherwise we cancel the PI to release.
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_intent_data: {
        capture_method: "manual",
        metadata: {
          transaction_id: transactionId,
          item_id: transaction.item_id,
          borrower_id: user.id,
          owner_id: transaction.owner_id,
        },
      },
      line_items: [
        {
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
        },
      ],
      success_url: `${origin}/api/transactions/${transactionId}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/inbox`,
      metadata: {
        transaction_id: transactionId,
      },
    });

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (err: any) {
    console.error("Stripe Checkout creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session", detail: err.message },
      { status: 500 }
    );
  }
}
