import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
    .select("id, item_id, borrower_id, owner_id, state")
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  // 3. Must be owner
  if (transaction.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Only the owner can confirm return" },
      { status: 403 }
    );
  }

  // 4. Must be in return_submitted state
  if (transaction.state !== "return_submitted") {
    return NextResponse.json(
      {
        error: `Cannot confirm return for a transaction in state "${transaction.state}"`,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const inspectionHours = 24;
  const inspectionDeadline = new Date(
    Date.now() + inspectionHours * 60 * 60 * 1000
  ).toISOString();

  // 5. Update transaction state to inspection_pending
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      state: "inspection_pending",
      return_confirmed_at: now,
      inspection_deadline: inspectionDeadline,
      updated_at: now,
    })
    .eq("id", transactionId);

  if (updateError) {
    console.error("Failed to confirm return:", updateError);
    return NextResponse.json(
      { error: "Failed to confirm return", detail: updateError.message },
      { status: 500 }
    );
  }

  // 6. Log state change
  await supabase.from("transaction_state_log").insert({
    transaction_id: transactionId,
    from_state: "return_submitted",
    to_state: "inspection_pending",
    changed_by: user.id,
    change_reason: "owner_confirmed_return",
    metadata: {
      inspection_deadline: inspectionDeadline,
      inspection_hours: inspectionHours,
    },
  });

  // 7. Get owner name and item title for message
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const ownerName = ownerProfile?.display_name ?? "The owner";

  const { data: item } = await supabase
    .from("items")
    .select("title")
    .eq("id", transaction.item_id)
    .single();

  const itemTitle = item?.title ?? "the item";

  // 8. Send message to borrower
  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: transaction.borrower_id,
    message_type: "inspection_pending",
    content: `${ownerName} confirmed receiving "${itemTitle}" back. Inspecting for ${inspectionHours} hours — your deposit will be released if no damage is reported.`,
    topic: transaction.item_id,
    payload: {
      transaction_id: transactionId,
      item_id: transaction.item_id,
      item_title: itemTitle,
      inspection_deadline: inspectionDeadline,
      inspection_hours: inspectionHours,
    },
  });

  return NextResponse.json({
    success: true,
    new_state: "inspection_pending",
    inspection_deadline: inspectionDeadline,
  });
}
