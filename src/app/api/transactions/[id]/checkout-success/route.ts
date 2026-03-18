import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
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

    // 3. Check payment status
    const pi = typeof session.payment_intent === "string"
    ? await stripe.paymentIntents.retrieve(session.payment_intent)
    : session.payment_intent;

    if (pi?.status !== "requires_capture") {
      console.error("PaymentIntent not authorized:", pi?.status);
      return NextResponse.redirect(new URL("/inbox", request.url));
    }

    // 4. Get the PaymentIntent ID
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntent) {
      console.error("No payment intent found");
      return NextResponse.redirect(new URL("/inbox", request.url));
    }

    // 5. Fetch transaction to verify state
    const { data: transaction } = await supabase
      .from("transactions")
      .select("id, item_id, borrower_id, owner_id, state")
      .eq("id", transactionId)
      .single();

    if (!transaction || transaction.state !== "approved") {
      return NextResponse.redirect(new URL("/inbox", request.url));
    }

    // 6. Get item details
    const { data: item } = await supabase
      .from("items")
      .select("title, deposit_cents")
      .eq("id", transaction.item_id)
      .single();

    const depositAmountCents = item?.deposit_cents ?? 0;
    const itemTitle = item?.title ?? "the item";
    const depositDisplay = `$${(depositAmountCents / 100).toFixed(2)}`;

    // 7. Update transaction to deposit_held
    const now = new Date().toISOString();
    await supabase
      .from("transactions")
      .update({
        state: "deposit_held",
        deposit_confirmed_at: now,
        payment_intent_id: paymentIntent,
        deposit_held: depositAmountCents,
        updated_at: now,
      })
      .eq("id", transactionId);

    // 8. Update item availability
    await supabase
      .from("items")
      .update({ availability_status: "borrowed", updated_at: now })
      .eq("id", transaction.item_id);

    // 9. Log state change
    await supabase.from("transaction_state_log").insert({
      transaction_id: transactionId,
      from_state: "approved",
      to_state: "deposit_held",
      changed_by: transaction.borrower_id,
      change_reason: "borrower_confirmed_deposit",
      metadata: {
        payment_intent_id: paymentIntent,
        stripe_session_id: sessionId,
        deposit_amount_cents: depositAmountCents,
      },
    });

    // 10. Get borrower name
    const { data: borrowerProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", transaction.borrower_id)
      .single();

    const borrowerName = borrowerProfile?.display_name ?? "The borrower";

    // 11. Send system message to owner
    await supabase.from("messages").insert({
      sender_id: transaction.borrower_id,
      recipient_id: transaction.owner_id,
      message_type: "deposit_confirmed",
      content: `${borrowerName} confirmed the deposit (${depositDisplay}) for "${itemTitle}". Coordinate pickup!`,
      topic: transaction.item_id,
      payload: {
        transaction_id: transactionId,
        item_id: transaction.item_id,
        deposit_amount_cents: depositAmountCents,
        item_title: itemTitle,
        payment_intent_id: paymentIntent,
      },
    });

    // 12. Redirect back to inbox
    return NextResponse.redirect(new URL("/inbox", request.url));
  } catch (err: any) {
    console.error("Checkout success handler failed:", err);
    return NextResponse.redirect(new URL("/inbox", request.url));
  }
}
