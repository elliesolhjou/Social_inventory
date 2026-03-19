import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: transactionId } = await params;

  // 1. Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { location, date, time, note } = body;

  // 3. Fetch transaction
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select(
      "id, borrower_id, owner_id, item_id, state, logistics_confirmed_by"
    )
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // 4. Must be participant
  const isBorrower = transaction.borrower_id === user.id;
  const isOwner = transaction.owner_id === user.id;

  if (!isBorrower && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5. Must be in eligible state
  if (!["approved", "deposit_held"].includes(transaction.state)) {
    return NextResponse.json(
      { error: `Cannot set logistics in state "${transaction.state}"` },
      { status: 409 }
    );
  }

  // 6. Track confirmations
  let confirmations: { borrower: boolean; owner: boolean };
  try {
    const raw = transaction.logistics_confirmed_by;
    if (raw && typeof raw === "object") {
      confirmations = raw as { borrower: boolean; owner: boolean };
    } else {
      confirmations = { borrower: false, owner: false };
    }
  } catch {
    confirmations = { borrower: false, owner: false };
  }

  // Mark this user's confirmation
  if (isBorrower) {
    if (confirmations.borrower) {
      return NextResponse.json({
        success: true,
        already_confirmed: true,
        message: "You already confirmed logistics",
      });
    }
    confirmations.borrower = true;
  } else {
    if (confirmations.owner) {
      return NextResponse.json({
        success: true,
        already_confirmed: true,
        message: "You already confirmed logistics",
      });
    }
    confirmations.owner = true;
  }

  const now = new Date().toISOString();
  const bothConfirmed = confirmations.borrower && confirmations.owner;

  // 7. Update transaction
  const updatePayload: Record<string, unknown> = {
    pickup_location: location ?? null,
    pickup_date: date ?? null,
    pickup_time: time ?? null,
    pickup_note: note ?? null,
    logistics_confirmed_by: confirmations,
    updated_at: now,
  };

  if (bothConfirmed) {
    updatePayload.logistics_confirmed_at = now;
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update(updatePayload)
    .eq("id", transactionId);

  if (updateError) {
    console.error("Logistics confirm failed:", updateError);
    return NextResponse.json(
      { error: "Failed to confirm logistics", detail: updateError.message },
      { status: 500 }
    );
  }

  // 8. Log state change
  await supabase.from("transaction_state_log").insert({
    transaction_id: transactionId,
    from_state: transaction.state,
    to_state: transaction.state, // state doesn't change, just logistics
    changed_by: user.id,
    change_reason: isBorrower
      ? "borrower_confirmed_logistics"
      : "owner_confirmed_logistics",
    metadata: { location, date, time, confirmations },
  });

  // 9. Send confirmation message
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const userName = profile?.display_name ?? "Someone";
  const partnerId = isBorrower ? transaction.owner_id : transaction.borrower_id;
  const role = isBorrower ? "borrower" : "owner";

  if (bothConfirmed) {
    // Both confirmed — send a locked-in message
    const dateDisplay = date
      ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      : "";
    const timeDisplay = time
      ? new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

    let lockedMsg = `Pickup details locked in!`;
    if (location) lockedMsg += ` 📍 ${location}`;
    if (dateDisplay) lockedMsg += ` 📅 ${dateDisplay}`;
    if (timeDisplay) lockedMsg += ` 🕐 ${timeDisplay}`;

    await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: partnerId,
      message_type: "logistics_confirmed",
      content: lockedMsg,
      topic: transaction.item_id,
      payload: {
        transaction_id: transactionId,
        location,
        date,
        time,
        confirmed_at: now,
      },
    });
  } else {
    // Partial — notify the other party
    await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: partnerId,
      message_type: "logistics_partial",
      content: `${userName} confirmed the pickup details. Tap confirm to lock it in!`,
      topic: transaction.item_id,
      payload: {
        transaction_id: transactionId,
        confirmed_by: role,
        confirmations,
      },
    });
  }

  return NextResponse.json({
    success: true,
    both_confirmed: bothConfirmed,
    confirmations,
  });
}
