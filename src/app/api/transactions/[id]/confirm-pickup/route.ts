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
    .select(
      "id, item_id, borrower_id, owner_id, state, pickup_confirmations, borrow_days"
    )
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  // 3. Must be participant
  const isBorrower = transaction.borrower_id === user.id;
  const isOwner = transaction.owner_id === user.id;

  if (!isBorrower && !isOwner) {
    return NextResponse.json(
      { error: "Only transaction participants can confirm pickup" },
      { status: 403 }
    );
  }

  // 4. Must be in deposit_held state
  if (transaction.state !== "deposit_held") {
    return NextResponse.json(
      {
        error: `Cannot confirm pickup for a transaction in state "${transaction.state}"`,
      },
      { status: 409 }
    );
  }

  // 5. Track confirmations
  let confirmations: { borrower_confirmed: boolean; owner_confirmed: boolean };

  try {
    const raw = transaction.pickup_confirmations;
    if (raw && typeof raw === "object") {
      confirmations = raw as any;
    } else if (raw && typeof raw === "string") {
      confirmations = JSON.parse(raw);
    } else {
      confirmations = { borrower_confirmed: false, owner_confirmed: false };
    }
  } catch {
    confirmations = { borrower_confirmed: false, owner_confirmed: false };
  }

  // 6. Mark this user's confirmation
  if (isBorrower) {
    if (confirmations.borrower_confirmed) {
      return NextResponse.json({
        success: true,
        already_confirmed: true,
        message: "You already confirmed pickup",
      });
    }
    confirmations.borrower_confirmed = true;
  } else {
    if (confirmations.owner_confirmed) {
      return NextResponse.json({
        success: true,
        already_confirmed: true,
        message: "You already confirmed handoff",
      });
    }
    confirmations.owner_confirmed = true;
  }

  const now = new Date().toISOString();
  const bothConfirmed =
    confirmations.borrower_confirmed && confirmations.owner_confirmed;

  // 7. Update transaction
  const updatePayload: Record<string, unknown> = {
    pickup_confirmations: confirmations,
    updated_at: now,
  };

  if (bothConfirmed) {
    updatePayload.state = "picked_up";
    updatePayload.picked_up_at = now;

    // Recalculate due_at from pickup date + borrow_days
    const borrowDays = transaction.borrow_days ?? 7;
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + borrowDays);
    updatePayload.due_at = dueAt.toISOString();
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update(updatePayload)
    .eq("id", transactionId);

  if (updateError) {
    console.error("Pickup confirmation failed:", updateError);
    return NextResponse.json(
      { error: "Failed to confirm pickup", detail: updateError.message },
      { status: 500 }
    );
  }

  // 8. Update item availability if both confirmed
  if (bothConfirmed) {
    await supabase
      .from("items")
      .update({ availability_status: "borrowed", updated_at: now })
      .eq("id", transaction.item_id);
  }

  // 9. Log state change
  await supabase.from("transaction_state_log").insert({
    transaction_id: transactionId,
    from_state: "deposit_held",
    to_state: bothConfirmed ? "picked_up" : "deposit_held",
    changed_by: user.id,
    change_reason: isBorrower
      ? "borrower_confirmed_pickup"
      : "owner_confirmed_handoff",
    metadata: confirmations,
  });

  // 10. Get profile names for messages
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const userName = profile?.display_name ?? "Someone";
  const partnerId = isBorrower ? transaction.owner_id : transaction.borrower_id;

  // 11. Send appropriate message
  if (bothConfirmed) {
    const { data: item } = await supabase
      .from("items")
      .select("title")
      .eq("id", transaction.item_id)
      .single();

    const itemTitle = item?.title ?? "the item";
    const borrowDays = transaction.borrow_days ?? 7;

    await supabase.from("messages").insert({
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
  } else {
    const waitingFor = isBorrower ? "owner" : "borrower";
    await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: partnerId,
      message_type: "pickup_partial",
      content: `${userName} confirmed the ${isBorrower ? "pickup" : "handoff"}. Waiting for the ${waitingFor} to confirm.`,
      topic: transaction.item_id,
      payload: {
        transaction_id: transactionId,
        confirmed_by: isBorrower ? "borrower" : "owner",
        confirmations,
      },
    });
  }

  return NextResponse.json({
    success: true,
    both_confirmed: bothConfirmed,
    new_state: bothConfirmed ? "picked_up" : "deposit_held",
    confirmations,
  });
}
