import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
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

  // Fetch dispute
  const { data: dispute, error: disputeError } = await supabase
    .from("disputes")
    .select("*")
    .eq("id", disputeId)
    .single();

  if (disputeError || !dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  // Verify participant
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, borrower_id, owner_id, item_id, state, deposit_cents, payment_intent_id")
    .eq("id", dispute.transaction_id)
    .single();

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.borrower_id !== user.id && transaction.owner_id !== user.id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  // Fetch all evidence
  const { data: evidence } = await supabase
    .from("transaction_evidence")
    .select("id, evidence_type, video_url, thumbnail_url, duration_seconds, extracted_frames, captured_at")
    .eq("transaction_id", dispute.transaction_id)
    .order("captured_at", { ascending: true });

  // Fetch item info
  const { data: item } = await supabase
    .from("items")
    .select("id, title, condition_checklist_json")
    .eq("id", transaction.item_id)
    .single();

  // Fetch state log
  const { data: stateLog } = await supabase
    .from("dispute_state_log")
    .select("id, from_state, to_state, actor_id, reason, created_at")
    .eq("dispute_id", disputeId)
    .order("created_at", { ascending: true });

  // Fetch profiles for both parties (no-join pattern)
  const profileIds = [transaction.borrower_id, transaction.owner_id].filter(Boolean);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, dispute_history_json")
    .in("id", profileIds);

  return NextResponse.json({
    dispute,
    transaction,
    item,
    evidence: evidence ?? [],
    state_log: stateLog ?? [],
    profiles: profiles ?? [],
  });
}
