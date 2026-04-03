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
  const { id: disputeId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { resolution, resolution_notes, capture_cents } = body as {
    resolution: "resolved_owner" | "resolved_borrower" | "dismissed";
    resolution_notes?: string;
    capture_cents?: number;
  };

  if (!["resolved_owner", "resolved_borrower", "dismissed"].includes(resolution)) {
    return NextResponse.json(
      { error: "resolution must be resolved_owner, resolved_borrower, or dismissed" },
      { status: 400 }
    );
  }

  const { data: dispute, error: disputeError } = await supabaseAdmin
    .from("disputes")
    .select("*")
    .eq("id", disputeId)
    .single();

  if (disputeError || !dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (!["filed", "under_review"].includes(dispute.state)) {
    return NextResponse.json(
      { error: `Cannot resolve dispute in state "${dispute.state}"` },
      { status: 409 }
    );
  }

  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("id, owner_id, borrower_id, state, payment_intent_id")
    .eq("id", dispute.transaction_id)
    .single();

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Get deposit from items table
  const { data: txWithItem } = await supabaseAdmin
    .from("transactions")
    .select("item_id")
    .eq("id", dispute.transaction_id)
    .single();

  const { data: item } = await supabaseAdmin
    .from("items")
    .select("deposit_cents, title")
    .eq("id", txWithItem?.item_id)
    .single();

  const depositCents = item?.deposit_cents ?? 0;

  // Stripe settlement
  let depositCapturedCents = 0;

  if (transaction.payment_intent_id) {
    try {
      if (resolution === "resolved_owner") {
        const amountToCapture =
          capture_cents && capture_cents > 0
            ? Math.min(capture_cents, depositCents)
            : depositCents;

        const pi = await stripe.paymentIntents.retrieve(transaction.payment_intent_id);
        if (pi.status === "requires_capture") {
          await stripe.paymentIntents.capture(transaction.payment_intent_id, {
            amount_to_capture: amountToCapture,
          });
          depositCapturedCents = amountToCapture;
        } else {
          return NextResponse.json(
            { error: `PaymentIntent status is "${pi.status}". Manual capture window may have expired.` },
            { status: 409 }
          );
        }
      } else {
        const pi = await stripe.paymentIntents.retrieve(transaction.payment_intent_id);
        if (pi.status === "requires_capture") {
          await stripe.paymentIntents.cancel(transaction.payment_intent_id);
        }
        depositCapturedCents = 0;
      }
    } catch (stripeErr: unknown) {
      const message = stripeErr instanceof Error ? stripeErr.message : "Stripe operation failed";
      return NextResponse.json(
        { error: "Stripe settlement failed", detail: message },
        { status: 500 }
      );
    }
  }

  // Transition: filed → under_review → resolution
  if (dispute.state === "filed") {
    await supabaseAdmin
      .from("disputes")
      .update({ state: "under_review" })
      .eq("id", disputeId);
  }

  const { error: resolveError } = await supabaseAdmin
    .from("disputes")
    .update({
      state: resolution,
      resolution_notes: resolution_notes || null,
      resolved_by: user.id,
      deposit_captured_cents: depositCapturedCents,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId);

  if (resolveError) {
    return NextResponse.json(
      { error: "Failed to resolve dispute", detail: resolveError.message },
      { status: 500 }
    );
  }

  // Complete the transaction
  const { error: txStateError } = await supabaseAdmin
    .from("transactions")
    .update({ state: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", dispute.transaction_id);

  if (txStateError) {
    return NextResponse.json(
      { error: "Dispute resolved but transaction state update failed" },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("transaction_state_log").insert({
    transaction_id: dispute.transaction_id,
    from_state: "disputed",
    to_state: "completed",
    changed_by: user.id,
    change_reason: `dispute_${resolution}`,
    metadata: { dispute_id: disputeId, deposit_captured_cents: depositCapturedCents },
  });

  // Set item back to available after dispute resolution
  await supabaseAdmin
    .from("items")
    .update({ availability_status: "available", updated_at: new Date().toISOString() })
    .eq("id", txWithItem?.item_id);
  // Update fraud counters
  if (resolution === "resolved_owner") {
    const { data: borrowerProfile } = await supabaseAdmin
      .from("profiles")
      .select("dispute_history_json")
      .eq("id", transaction.borrower_id)
      .single();

    if (borrowerProfile) {
      const history = borrowerProfile.dispute_history_json ?? {};
      await supabaseAdmin
        .from("profiles")
        .update({
          dispute_history_json: {
            ...history,
            confirmed_damages_as_borrower: ((history as Record<string, number>).confirmed_damages_as_borrower ?? 0) + 1,
          },
        })
        .eq("id", transaction.borrower_id);
    }
  } else if (resolution === "resolved_borrower" || resolution === "dismissed") {
    const { data: ownerProfile } = await supabaseAdmin
      .from("profiles")
      .select("dispute_history_json")
      .eq("id", transaction.owner_id)
      .single();

    if (ownerProfile) {
      const history = ownerProfile.dispute_history_json ?? {};
      await supabaseAdmin
        .from("profiles")
        .update({
          dispute_history_json: {
            ...history,
            denied_disputes_as_owner: ((history as Record<string, number>).denied_disputes_as_owner ?? 0) + 1,
          },
        })
        .eq("id", transaction.owner_id);
    }
  }

  // Notify both parties
  const resolutionLabel =
    resolution === "resolved_owner"
      ? "in the owner's favor"
      : resolution === "resolved_borrower"
        ? "in the borrower's favor"
        : "dismissed";

  const itemTitle = item?.title ?? "the item";

  for (const recipientId of [transaction.owner_id, transaction.borrower_id]) {
    await supabaseAdmin.from("messages").insert({
      sender_id: user.id,
      recipient_id: recipientId,
      message_type: "dispute_resolved",
      content: `Dispute for "${itemTitle}" resolved ${resolutionLabel}.${
        depositCapturedCents > 0
          ? ` $${(depositCapturedCents / 100).toFixed(2)} of the deposit was captured.`
          : " The deposit has been released."
      }`,
      topic: null,
      payload: {
        transaction_id: dispute.transaction_id,
        dispute_id: disputeId,
        resolution,
        deposit_captured_cents: depositCapturedCents,
      },
    });
  }

  return NextResponse.json({
    success: true,
    resolution,
    deposit_captured_cents: depositCapturedCents,
  });
}
