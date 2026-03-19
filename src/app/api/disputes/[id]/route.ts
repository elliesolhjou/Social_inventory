import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { id: disputeId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: dispute, error: disputeError } = await supabaseAdmin
    .from("disputes")
    .select("*")
    .eq("id", disputeId)
    .single();

  if (disputeError || !dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("id, borrower_id, owner_id, item_id, state, payment_intent_id")
    .eq("id", dispute.transaction_id)
    .single();

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const { data: evidence } = await supabaseAdmin
    .from("transaction_evidence")
    .select("id, evidence_type, video_url, thumbnail_url, duration_seconds, extracted_frames, ai_damage_report, captured_at")
    .eq("transaction_id", dispute.transaction_id)
    .order("captured_at", { ascending: true });

  const { data: item } = await supabaseAdmin
    .from("items")
    .select("id, title, deposit_cents, condition_checklist_json")
    .eq("id", transaction.item_id)
    .single();

  const { data: stateLog } = await supabaseAdmin
    .from("dispute_state_log")
    .select("id, from_state, to_state, actor_id, reason, created_at")
    .eq("dispute_id", disputeId)
    .order("created_at", { ascending: true });

  const profileIds = [transaction.borrower_id, transaction.owner_id].filter(Boolean);
  const { data: profiles } = await supabaseAdmin
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
