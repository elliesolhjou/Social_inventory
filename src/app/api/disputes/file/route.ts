import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const INSPECTION_WINDOW_HOURS = 48;
const OWNER_DISPUTE_RATE_THRESHOLD = 0.3; // 30%
const SAME_ITEM_DISPUTE_THRESHOLD = 2;
const SPEED_FLAG_MINUTES = 5;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { transaction_id, reason, description } = body;

  if (!transaction_id || !reason) {
    return NextResponse.json(
      { error: "transaction_id and reason are required" },
      { status: 400 }
    );
  }

  // Fetch transaction
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select(
      "id, owner_id, borrower_id, item_id, state, inspection_deadline, payment_intent_id, updated_at"
    )
    .eq("id", transaction_id)
    .single();

  if (txError || !transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Must be the owner
  if (transaction.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Only the item owner can file a dispute" },
      { status: 403 }
    );
  }

  // Transaction must be in return_submitted or completed
  if (!["return_submitted", "completed"].includes(transaction.state)) {
    return NextResponse.json(
      { error: `Cannot file dispute on transaction in state "${transaction.state}"` },
      { status: 409 }
    );
  }

  // Check inspection window (48hr from return confirmation)
  if (transaction.inspection_deadline) {
    const deadline = new Date(transaction.inspection_deadline);
    if (new Date() > deadline) {
      return NextResponse.json(
        { error: "Inspection window has expired. Deposit has been auto-released." },
        { status: 410 }
      );
    }
  }

  // HARD RULE: V3 is REQUIRED to file a dispute
  const { data: v3Evidence } = await supabase
    .from("transaction_evidence")
    .select("id")
    .eq("transaction_id", transaction_id)
    .eq("evidence_type", "V3")
    .single();

  if (!v3Evidence) {
    return NextResponse.json(
      {
        error: "You must record an inspection video (V3) before filing a dispute. Go back and record one first.",
      },
      { status: 400 }
    );
  }

  // Check no existing dispute
  const { data: existingDispute } = await supabase
    .from("disputes")
    .select("id")
    .eq("transaction_id", transaction_id)
    .single();

  if (existingDispute) {
    return NextResponse.json(
      { error: "A dispute has already been filed for this transaction" },
      { status: 409 }
    );
  }

  // ── Fraud detection ─────────────────────────────────────────────
  const fraudFlags: string[] = [];

  // 1. Owner dispute rate
  const { count: ownerTotalTx } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .in("state", ["completed", "disputed"]);

  const { count: ownerDisputeCount } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("filed_by", user.id);

  if (
    ownerTotalTx &&
    ownerTotalTx > 0 &&
    ownerDisputeCount &&
    ownerDisputeCount / ownerTotalTx > OWNER_DISPUTE_RATE_THRESHOLD
  ) {
    fraudFlags.push(
      `high_owner_dispute_rate:${ownerDisputeCount}/${ownerTotalTx}`
    );
  }

  // 2. Same-item repeat disputes
  const { count: itemDisputeCount } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .in(
      "transaction_id",
      // Get all transaction IDs for this item
      (
        await supabase
          .from("transactions")
          .select("id")
          .eq("item_id", transaction.item_id)
      ).data?.map((t) => t.id) ?? []
    );

  if (itemDisputeCount && itemDisputeCount >= SAME_ITEM_DISPUTE_THRESHOLD) {
    fraudFlags.push(
      `repeat_item_disputes:${itemDisputeCount + 1}`
    );
  }

  // 3. Dispute speed (< 5 min after return)
  const returnTime = new Date(transaction.updated_at).getTime();
  const nowTime = Date.now();
  const minutesSinceReturn = (nowTime - returnTime) / 1000 / 60;
  if (minutesSinceReturn < SPEED_FLAG_MINUTES) {
    fraudFlags.push(
      `fast_filing:${Math.round(minutesSinceReturn)}min`
    );
  }

  // ── Snapshot the condition checklist if it exists ────────────────
  let checklistSnapshot = null;
  const { data: item } = await supabase
    .from("items")
    .select("condition_checklist_json")
    .eq("id", transaction.item_id)
    .single();

  if (item?.condition_checklist_json) {
    checklistSnapshot = item.condition_checklist_json;
  }

  // ── Create dispute ──────────────────────────────────────────────
  const { data: dispute, error: disputeError } = await supabase
    .from("disputes")
    .insert({
      transaction_id,
      filed_by: user.id,
      reason,
      description: description || null,
      condition_checklist_snapshot: checklistSnapshot,
      fraud_flags: fraudFlags.length > 0 ? fraudFlags : [],
    })
    .select("id, state, reason, created_at, fraud_flags")
    .single();

  if (disputeError) {
    return NextResponse.json(
      { error: "Failed to file dispute", detail: disputeError.message },
      { status: 500 }
    );
  }

  // ── Transition transaction to 'disputed' ────────────────────────
  const { error: stateError } = await supabase
    .from("transactions")
    .update({ state: "disputed", updated_at: new Date().toISOString() })
    .eq("id", transaction_id);

  if (stateError) {
    return NextResponse.json(
      { error: "Dispute filed but transaction state update failed", detail: stateError.message },
      { status: 500 }
    );
  }

  // Log state change
  await supabase.from("transaction_state_log").insert({
    transaction_id,
    from_state: transaction.state,
    to_state: "disputed",
    changed_by: user.id,
    change_reason: "dispute_filed",
    metadata: { dispute_id: dispute.id, fraud_flags: fraudFlags },
  });

  // ── Notify borrower ────────────────────────────────────────────
  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: transaction.borrower_id,
    message_type: "dispute_filed",
    content: `A dispute has been filed regarding a returned item. Reason: ${reason}`,
    topic: transaction.item_id,
    payload: {
      transaction_id,
      dispute_id: dispute.id,
      reason,
    },
  });

  return NextResponse.json({
    success: true,
    dispute,
    fraud_flags: fraudFlags,
  });
}
