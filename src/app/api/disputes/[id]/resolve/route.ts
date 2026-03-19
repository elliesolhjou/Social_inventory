import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
});

type Resolution = "resolved_owner" | "resolved_borrower" | "dismissed";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: disputeId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: In production, restrict to admin/founder role.
  // For now, any authenticated user with the dispute ID can resolve (founder-only).

  const body = await request.json();
  const { resolution, resolution_notes, capture_cents } = body as {
    resolution: Resolution;
    resolution_notes?: string;
    capture_cents?: number;
  };

  if (!["resolved_owner", "resolved_borrower", "dismissed"].includes(resolution)) {
    return NextResponse.json(
      { error: "resolution must be resolved_owner, resolved_borrower, or dismissed" },
      { status: 400 }
    );
  }

  // Fetch dispute
  const { data: dispute, error: disputeError } = await supabase
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

  // Fetch transaction for Stripe + participant info
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, owner_id, borrower_id, deposit_cents, payment_intent_id, state")
    .eq("id", dispute.transaction_id)
    .single();

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // ── Stripe settlement ──────────────────────────────────────────
  let depositCapturedCents = 0;

  if (transaction.payment_intent_id) {
    try {
      if (resolution === "resolved_owner") {
        // Capture deposit (full or partial)
        const amountToCapture =
          capture_cents && capture_cents > 0
            ? Math.min(capture_cents, transaction.deposit_cents ?? 0)
            : transaction.deposit_cents ?? 0;

        // Check if PaymentIntent is still capturable (7-day window)
        const pi = await stripe.paymentIntents.retrieve(transaction.payment_intent_id);
        if (pi.status === "requires_capture") {
          await stripe.paymentIntents.capture(transaction.payment_intent_id, {
            amount_to_capture: amountToCapture,
          });
          depositCapturedCents = amountToCapture;
        } else {
          // Past 7-day capture window — already expired or captured
          return NextResponse.json(
            {
              error: `PaymentIntent status is "${pi.status}". Manual capture window may have expired. Handle via Stripe dashboard.`,
            },
            { status: 409 }
          );
        }
      } else {
        // resolved_borrower or dismissed → release deposit
        const pi = await stripe.paymentIntents.retrieve(transaction.payment_intent_id);
        if (pi.status === "requires_capture") {
          await stripe.paymentIntents.cancel(transaction.payment_intent_id);
        }
        depositCapturedCents = 0;
      }
    } catch (stripeErr: unknown) {
      const message =
        stripeErr instanceof Error ? stripeErr.message : "Stripe operation failed";
      return NextResponse.json(
        { error: "Stripe settlement failed", detail: message },
        { status: 500 }
      );
    }
  }

  // ── Move dispute through states: filed → under_review → resolution ──
  // If still 'filed', transition to under_review first
  if (dispute.state === "filed") {
    const { error: reviewError } = await supabase
      .from("disputes")
      .update({ state: "under_review" })
      .eq("id", disputeId);

    if (reviewError) {
      return NextResponse.json(
        { error: "Failed to transition to under_review", detail: reviewError.message },
        { status: 500 }
      );
    }
  }

  // Now resolve
  const { error: resolveError } = await supabase
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

  // ── Transition transaction to completed ─────────────────────────
  const { error: txStateError } = await supabase
    .from("transactions")
    .update({ state: "completed", updated_at: new Date().toISOString() })
    .eq("id", dispute.transaction_id);

  if (txStateError) {
    return NextResponse.json(
      { error: "Dispute resolved but transaction state update failed" },
      { status: 500 }
    );
  }

  await supabase.from("transaction_state_log").insert({
    transaction_id: dispute.transaction_id,
    from_state: "disputed",
    to_state: "completed",
    changed_by: user.id,
    change_reason: `dispute_${resolution}`,
    metadata: { dispute_id: disputeId, deposit_captured_cents: depositCapturedCents },
  });

  // ── Update fraud counters ──────────────────────────────────────
  if (resolution === "resolved_owner") {
    // Borrower caused damage → increment borrower counter
    const { data: borrowerProfile } = await supabase
      .from("profiles")
      .select("dispute_history_json")
      .eq("id", transaction.borrower_id)
      .single();

    if (borrowerProfile) {
      const history = borrowerProfile.dispute_history_json ?? {};
      const count = (history.confirmed_damages_as_borrower ?? 0) + 1;
      await supabase
        .from("profiles")
        .update({
          dispute_history_json: {
            ...history,
            confirmed_damages_as_borrower: count,
            last_reset_at: history.last_reset_at ?? null,
          },
        })
        .eq("id", transaction.borrower_id);
    }
  } else if (resolution === "resolved_borrower" || resolution === "dismissed") {
    // Owner's claim denied → increment owner counter
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("dispute_history_json")
      .eq("id", transaction.owner_id)
      .single();

    if (ownerProfile) {
      const history = ownerProfile.dispute_history_json ?? {};
      const count = (history.denied_disputes_as_owner ?? 0) + 1;
      await supabase
        .from("profiles")
        .update({
          dispute_history_json: {
            ...history,
            denied_disputes_as_owner: count,
            last_reset_at: history.last_reset_at ?? null,
          },
        })
        .eq("id", transaction.owner_id);
    }
  }

  // ── Notify both parties ────────────────────────────────────────
  const resolutionLabel =
    resolution === "resolved_owner"
      ? "in the owner's favor"
      : resolution === "resolved_borrower"
        ? "in the borrower's favor"
        : "dismissed";

  const notifyIds = [transaction.owner_id, transaction.borrower_id];
  for (const recipientId of notifyIds) {
    await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: recipientId,
      message_type: "dispute_resolved",
      content: `Dispute resolved ${resolutionLabel}.${
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
