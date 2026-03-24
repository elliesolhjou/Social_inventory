import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get earnings balance
  const { data: earnings } = await supabase
    .from("earnings_ledger")
    .select("amount_cents, type")
    .eq("user_id", user.id);

  const totalEarned = (earnings ?? [])
    .filter((e: any) => ["rental", "sale"].includes(e.type))
    .reduce((sum: number, e: any) => sum + e.amount_cents, 0);

  const totalPaidOut = (earnings ?? [])
    .filter((e: any) => e.type === "payout")
    .reduce((sum: number, e: any) => sum + Math.abs(e.amount_cents), 0);

  const balance = totalEarned - totalPaidOut;

  // Get payout methods
  const { data: methods } = await supabase
    .from("payout_methods")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false });

  // Get pending payout requests
  const { data: pendingPayouts } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending");

  const pendingAmount = (pendingPayouts ?? [])
    .reduce((sum: number, p: any) => sum + p.amount_cents, 0);

  return NextResponse.json({
    balance_cents: balance,
    total_earned_cents: totalEarned,
    total_paid_out_cents: totalPaidOut,
    pending_payout_cents: pendingAmount,
    available_cents: balance - pendingAmount,
    methods: methods ?? [],
    pending_payouts: pendingPayouts ?? [],
  });
}
