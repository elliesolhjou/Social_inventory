import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { id: transactionId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("id, item_id, borrower_id, owner_id, state, borrow_days")
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const isBorrower = transaction.borrower_id === user.id;
  const isOwner = transaction.owner_id === user.id;

  if (!isBorrower && !isOwner) {
    return NextResponse.json(
      { error: "Only transaction participants can confirm pickup" },
      { status: 403 }
    );
  }

  if (transaction.state !== "deposit_held") {
    return NextResponse.json(
      { error: `Cannot confirm pickup for a transaction in state "${transaction.state}"` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const borrowDays = transaction.borrow_days ?? 7;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + borrowDays);

  // Single confirmation → immediately picked_up
  const { error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({
      state: "picked_up",
      picked_up_at: now,
      due_at: dueAt.toISOString(),
      updated_at: now,
    })
    .eq("id", transactionId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to confirm pickup", detail: updateError.message },
      { status: 500 }
    );
  }

  // Update item availability
  await supabaseAdmin
    .from("items")
    .update({ availability_status: "borrowed", updated_at: now })
    .eq("id", transaction.item_id);

  // Log state change
  await supabaseAdmin.from("transaction_state_log").insert({
    transaction_id: transactionId,
    from_state: "deposit_held",
    to_state: "picked_up",
    changed_by: user.id,
    change_reason: isBorrower ? "borrower_confirmed_pickup" : "owner_confirmed_handoff",
  });

  // Get names + item title
  const { data: confirmerProfile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const confirmerName = confirmerProfile?.display_name ?? "Someone";

  const { data: item } = await supabaseAdmin
    .from("items")
    .select("title")
    .eq("id", transaction.item_id)
    .single();

  const itemTitle = item?.title ?? "the item";
  const partnerId = isBorrower ? transaction.owner_id : transaction.borrower_id;

  // Notify both: pickup confirmed
  await supabaseAdmin.from("messages").insert({
    sender_id: user.id,
    recipient_id: partnerId,
    message_type: "pickup_confirmed",
    content: `Pickup confirmed! "${itemTitle}" is now with the borrower for ${borrowDays} day${borrowDays !== 1 ? "s" : ""}. The deposit hold is active until the item is returned.`,
    topic: transaction.item_id,
    payload: {
      transaction_id: transactionId,
      item_id: transaction.item_id,
      item_title: itemTitle,
      picked_up_at: now,
      borrow_days: borrowDays,
    },
  });

  // Also send to the confirmer so both see the message
  await supabaseAdmin.from("messages").insert({
    sender_id: user.id,
    recipient_id: user.id,
    message_type: "pickup_confirmed",
    content: `Pickup confirmed! "${itemTitle}" is now with the borrower for ${borrowDays} day${borrowDays !== 1 ? "s" : ""}. The deposit hold is active until the item is returned.`,
    topic: transaction.item_id,
    payload: {
      transaction_id: transactionId,
      item_id: transaction.item_id,
      item_title: itemTitle,
      picked_up_at: now,
      borrow_days: borrowDays,
    },
  });

  return NextResponse.json({
    success: true,
    new_state: "picked_up",
    picked_up_at: now,
    due_at: dueAt.toISOString(),
  });
}
