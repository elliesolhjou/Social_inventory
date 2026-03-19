import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ txId: string }> }
) {
  const supabase = await createServerSupabase();
  const { txId: transactionId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify participant
  const { data: transaction } = await supabase
    .from("transactions")
    .select("borrower_id, owner_id")
    .eq("id", transactionId)
    .single();

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.borrower_id !== user.id && transaction.owner_id !== user.id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const { data: dispute } = await supabase
    .from("disputes")
    .select("*")
    .eq("transaction_id", transactionId)
    .single();

  if (!dispute) {
    return NextResponse.json({ dispute: null });
  }

  return NextResponse.json({ dispute });
}
