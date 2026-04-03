import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const FOUNDER_ID = "e7eb677b-a7a3-401c-a682-9775f1303a52";
const PROXIE_PROFILE_ID = "00000000-0000-0000-0000-000000000002";

type Outcome = "release_to_borrower" | "capture_for_owner" | "dismiss";

interface ResolveBody {
  dispute_id: string;
  outcome: Outcome;
  resolution_notes?: string;
}

export async function POST(request: NextRequest) {
  // 1. Auth — must be founder
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || user.id !== FOUNDER_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // 2. Parse body
  let body: ResolveBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { dispute_id, outcome, resolution_notes } = body;

  if (!dispute_id || !outcome) {
    return NextResponse.json(
      { error: "dispute_id and outcome are required" },
      { status: 400 }
    );
  }

  if (!["release_to_borrower", "capture_for_owner", "dismiss"].includes(outcome)) {
    return NextResponse.json(
      { error: "Invalid outcome" },
      { status: 400 }
    );
  }

  // 3. Admin client for bypassing RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 4. Fetch dispute
  const { data: dispute, error: disputeError } = await supabaseAdmin
    .from("disputes")
    .select("*")
    .eq("id", dispute_id)
    .single();

  if (disputeError || !dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (dispute.status === "resolved" || dispute.status === "dismissed") {
    return NextResponse.json(
      { error: "Dispute is already resolved" },
      { status: 409 }
    );
  }

  // 5. Fetch transaction
  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, item_id, borrower_id, owner_id, state, payment_intent_id, transaction_type, deposit_held, rent_captured_cents"
    )
    .eq("id", dispute.transaction_id)
    .single();

  if (txError || !transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  // 6. Fetch item for message context
  const { data: item } = await supabaseAdmin
    .from("items")
    .select("title, deposit_cents")
    .eq("id", transaction.item_id)
    .single();

  const itemTitle = item?.title ?? "the item";
  const depositCents = transaction.deposit_held ?? item?.deposit_cents ?? 0;
  const depositDisplay = `$${(depositCents / 100).toFixed(2)}`;

  const now = new Date().toISOString();
  let stripeAction = "none";

  // 7. Stripe operations
  if (outcome !== "dismiss" && transaction.payment_intent_id) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
    });

    try {
      if (outcome === "release_to_borrower") {
        if (transaction.transaction_type === "borrow") {
          // Borrow: deposit is held via manual capture — cancel to release
          await stripe.paymentIntents.cancel(transaction.payment_intent_id);
          stripeAction = "payment_intent_cancelled";
        } else if (transaction.transaction_type === "rent") {
          // Rent: deposit was already captured — refund the deposit portion
          if (depositCents > 0) {
            await stripe.refunds.create({
              payment_intent: transaction.payment_intent_id,
              amount: depositCents,
            });
            stripeAction = "deposit_refunded";
          }
        }
      } else if (outcome === "capture_for_owner") {
        if (transaction.transaction_type === "borrow") {
          // Borrow: deposit is held — capture it
          await stripe.paymentIntents.capture(transaction.payment_intent_id);
          stripeAction = "deposit_captured";
        } else if (transaction.transaction_type === "rent") {
          // Rent: deposit already charged — no action needed
          stripeAction = "deposit_already_captured";
        }
      }
    } catch (stripeErr: unknown) {
      const msg =
        stripeErr instanceof Error ? stripeErr.message : "Unknown Stripe error";
      console.error("Stripe operation failed:", msg);
      return NextResponse.json(
        {
          error: "Stripe operation failed",
          detail: msg,
        },
        { status: 500 }
      );
    }
  }

  // 8. Update dispute status
  const newStatus: DisputeStatus =
    outcome === "dismiss" ? "dismissed" : "resolved";

  type DisputeStatus = "filed" | "under_review" | "resolved" | "dismissed";

  const { error: disputeUpdateError } = await supabaseAdmin
    .from("disputes")
    .update({
      status: newStatus,
      resolution_notes: resolution_notes || null,
      resolved_at: now,
      resolved_by: FOUNDER_ID,
    })
    .eq("id", dispute_id);

  if (disputeUpdateError) {
    console.error("Failed to update dispute:", disputeUpdateError);
    return NextResponse.json(
      { error: "Failed to update dispute" },
      { status: 500 }
    );
  }

  // 9. Update transaction state to completed
  const { error: txUpdateError } = await supabaseAdmin
    .from("transactions")
    .update({
      state: "completed",
      resolved_at: now,
      updated_at: now,
    })
    .eq("id", dispute.transaction_id);

  if (txUpdateError) {
    console.error("Failed to update transaction:", txUpdateError);
    // Non-blocking — dispute is already resolved
  }

  // 10. Log state change
  await supabaseAdmin.from("transaction_state_log").insert({
    transaction_id: dispute.transaction_id,
    from_state: transaction.state,
    to_state: "completed",
    changed_by: FOUNDER_ID,
    change_reason: `dispute_${outcome}`,
    metadata: {
      dispute_id,
      outcome,
      stripe_action: stripeAction,
      resolution_notes: resolution_notes || null,
    },
  });

  // 11. Release item back to available
  await supabaseAdmin
    .from("items")
    .update({ availability_status: "available", updated_at: now })
    .eq("id", transaction.item_id);

  // 12. Build messages for both parties
  const filerMessage = buildFilerMessage(
    outcome,
    itemTitle,
    depositDisplay,
    dispute.filed_by === transaction.borrower_id
  );

  const targetMessage = buildTargetMessage(
    outcome,
    itemTitle,
    depositDisplay,
    dispute.filed_against === transaction.borrower_id
  );

  // Send to filer
  await supabaseAdmin.from("messages").insert({
    sender_id: PROXIE_PROFILE_ID,
    recipient_id: dispute.filed_by,
    message_type: "dispute_resolved",
    content: filerMessage,
    topic: transaction.item_id,
    payload: {
      dispute_id,
      transaction_id: dispute.transaction_id,
      outcome,
      stripe_action: stripeAction,
      role: "filer",
    },
  });

  // Send to filed-against
  await supabaseAdmin.from("messages").insert({
    sender_id: PROXIE_PROFILE_ID,
    recipient_id: dispute.filed_against,
    message_type: "dispute_resolved",
    content: targetMessage,
    topic: transaction.item_id,
    payload: {
      dispute_id,
      transaction_id: dispute.transaction_id,
      outcome,
      stripe_action: stripeAction,
      role: "filed_against",
    },
  });

  return NextResponse.json({
    success: true,
    dispute_id,
    new_status: newStatus,
    stripe_action: stripeAction,
  });
}

/* ─── Message Builders ─── */

function buildFilerMessage(
  outcome: Outcome,
  itemTitle: string,
  depositDisplay: string,
  filerIsBorrower: boolean
): string {
  if (outcome === "dismiss") {
    return `Your dispute for "${itemTitle}" has been reviewed and dismissed. If you have further concerns, please reach out to support.`;
  }

  if (outcome === "release_to_borrower") {
    if (filerIsBorrower) {
      return `Good news — your dispute for "${itemTitle}" has been reviewed. Your full deposit of ${depositDisplay} has been released back to you. Thank you for following the return process.`;
    }
    return `Your dispute for "${itemTitle}" has been reviewed. Based on the evidence available, the damage could not be confirmed during the borrowing period, so the deposit of ${depositDisplay} has been released to the borrower. We appreciate you reporting this and value you as a member of the Proxe community.`;
  }

  // capture_for_owner
  if (filerIsBorrower) {
    return `Your dispute for "${itemTitle}" has been reviewed. The evidence shows damage occurred during the borrowing period. The deposit of ${depositDisplay} has been captured for the owner.`;
  }
  return `Your dispute for "${itemTitle}" has been reviewed. The deposit of ${depositDisplay} has been captured in your favor based on the evidence provided. Thank you for documenting the issue.`;
}

function buildTargetMessage(
  outcome: Outcome,
  itemTitle: string,
  depositDisplay: string,
  targetIsBorrower: boolean
): string {
  if (outcome === "dismiss") {
    return `A dispute filed regarding "${itemTitle}" has been reviewed and dismissed. No action was taken on your deposit.`;
  }

  if (outcome === "release_to_borrower") {
    if (targetIsBorrower) {
      return `A condition report was submitted for "${itemTitle}" you recently returned. After review, no evidence of damage was found. Your full deposit of ${depositDisplay} has been released back to you.`;
    }
    return `The dispute for "${itemTitle}" has been resolved. The deposit of ${depositDisplay} was released to the borrower based on the available evidence.`;
  }

  // capture_for_owner
  if (targetIsBorrower) {
    return `A dispute regarding "${itemTitle}" has been resolved. The evidence shows damage during the borrowing period, and the deposit of ${depositDisplay} has been captured for the owner.`;
  }
  return `The dispute for "${itemTitle}" has been resolved in the owner's favor. The deposit of ${depositDisplay} has been captured.`;
}
