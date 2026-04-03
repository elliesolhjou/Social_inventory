import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type LenderAction = "approve" | "decline" | "pending";

interface RespondBody {
  action: LenderAction;
  message?: string;
}

// System message templates
const SYSTEM_MESSAGES: Record<
  LenderAction,
  {
    message_type: string;
    content: (ownerName: string, itemTitle: string) => string;
  }
> = {
  approve: {
    message_type: "request_accepted",
    content: (owner, item) =>
      `${owner} accepted your request for "${item}". Confirm and place your deposit to lock it in.`,
  },
  decline: {
    message_type: "request_declined",
    content: (owner, item) =>
      `${owner} isn't able to lend "${item}" right now.`,
  },
  pending: {
    message_type: "request_pending",
    content: (owner, item) =>
      `${owner} is considering your request for "${item}". You'll hear back within 24 hours.`,
  },
};

// Valid state transitions from the lender's perspective
const VALID_SOURCE_STATES: Record<LenderAction, string[]> = {
  approve: ["requested", "pending"],
  decline: ["requested", "pending"],
  pending: ["requested"],
};

// Map action to new transaction state
const ACTION_TO_STATE: Record<LenderAction, string> = {
  approve: "approved",
  decline: "declined",
  pending: "pending",
};

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

  // 2. Parse + validate body
  let body: RespondBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, message } = body;
  if (!action || !["approve", "decline", "pending"].includes(action)) {
    return NextResponse.json(
      { error: "action must be approve, decline, or pending" },
      { status: 400 }
    );
  }

  // 3. Fetch transaction + verify ownership
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("id, item_id, borrower_id, owner_id, state, building_id")
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  if (transaction.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Only the item owner can respond to requests" },
      { status: 403 }
    );
  }

  // 4. Validate current state allows this action
  if (!VALID_SOURCE_STATES[action].includes(transaction.state)) {
    return NextResponse.json(
      {
        error: `Cannot ${action} a request in state "${transaction.state}"`,
      },
      { status: 409 }
    );
  }

  // 5. Fetch item + owner profile for system message
  const [{ data: item }, { data: ownerProfile }] = await Promise.all([
    supabase
      .from("items")
      .select("title, deposit_cents")
      .eq("id", transaction.item_id)
      .single(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single(),
  ]);

  const itemTitle = item?.title ?? "this item";
  const ownerName = ownerProfile?.display_name ?? "The owner";
  const depositAmountCents = item?.deposit_cents ?? 0;

  // 6. Build the update payload
  const now = new Date().toISOString();
  const newState = ACTION_TO_STATE[action];

  const updatePayload: Record<string, unknown> = {
    state: newState,
    updated_at: now,
  };

  if (action === "approve") {
    updatePayload.approved_at = now;
  } else if (action === "decline") {
    updatePayload.declined_at = now;
    updatePayload.resolution_type = "declined_by_owner";
    if (message) updatePayload.decline_reason = message;
  } else if (action === "pending") {
    updatePayload.pending_at = now;
    // 24-hour expiry window
    updatePayload.pending_expires_at = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();
  }

  // 7. Update transaction
  const { error: updateError } = await supabase
    .from("transactions")
    .update(updatePayload)
    .eq("id", transactionId);

  if (updateError) {
    console.error("Transaction update failed:", updateError);
    return NextResponse.json(
      { error: "Failed to update transaction", detail: updateError.message },
      { status: 500 }
    );
  }

  // 8. Sync borrow_requests table
  await supabase
    .from("borrow_requests")
    .update({
      status: action === "approve" ? "approved" : action === "decline" ? "declined" : "pending",
      responded_at: action !== "pending" ? now : undefined,
      pending_at: action === "pending" ? now : undefined,
      pending_expires_at:
        action === "pending"
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : undefined,
      response_message: message || null,
      updated_at: now,
    })
    .eq("transaction_id", transactionId);

  // 9. Log state change
  await supabase.from("transaction_state_log").insert({
    transaction_id: transactionId,
    from_state: transaction.state,
    to_state: newState,
    changed_by: user.id,
    change_reason: `owner_${action}`,
    metadata: message ? { message } : {},
  });

  // 10. Update item availability
  if (action === "approve") {
    await supabase
      .from("items")
      .update({ availability_status: "reserved", updated_at: now })
      .eq("id", transaction.item_id);
  } else if (action === "decline") {
    // Release item back to available (in case it was somehow reserved)
    await supabase
      .from("items")
      .update({ availability_status: "available", updated_at: now })
      .eq("id", transaction.item_id)
      .eq("availability_status", "reserved");
  }

  // 11. Send system message into the conversation
  const systemMsg = SYSTEM_MESSAGES[action];
  const msgPayload: Record<string, unknown> = {
    transaction_id: transactionId,
    item_id: transaction.item_id,
    action,
  };

  // Include deposit info for the borrower's confirmation card
  if (action === "approve") {
    msgPayload.deposit_amount_cents = depositAmountCents;
    msgPayload.item_title = itemTitle;
  }

  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: transaction.borrower_id,
    message_type: systemMsg.message_type,
    content: systemMsg.content(ownerName, itemTitle),
    payload: msgPayload,
    topic: transaction.item_id,
  });

  return NextResponse.json({
    success: true,
    transaction_id: transactionId,
    new_state: newState,
  });
}
