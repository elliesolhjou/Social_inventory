"use client";

import BorrowRequestCard from "./BorrowRequestCard";
import DepositConfirmCard from "./DepositConfirmCard";
import PickupConfirmedCard from "./PickupConfirmedCard";
import ReturnConfirmCard from "./ReturnConfirmCard";
import PickupSuggestionCard from "./PickupSuggestionCard";
import PickupCard from "./PickupCard";

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  /** The transaction state at time of render (fetched from parent) */
  transactionState?: string;
  /** The owner_id of the relevant transaction */
  transactionOwnerId?: string;
  /** The borrower_id of the relevant transaction */
  transactionBorrowerId?: string;
}

export default function MessageBubble({
  message,
  currentUserId,
  transactionState,
  transactionOwnerId,
  transactionBorrowerId,
}: MessageBubbleProps) {
  const isMine = message.sender_id === currentUserId;
  const payload = message.payload ?? {};

  // Route by message_type
  switch (message.message_type) {
    // ─── Borrow request (lender sees action buttons) ───
    case "borrow_request":
      return (
        <div
          className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2`}
        >
          <div>
            {!isMine && (
              <p className="text-[11px] text-muted-foreground mb-1">
                Borrow request
              </p>
            )}
            <BorrowRequestCard
              transactionId={payload.transaction_id as string}
              itemTitle={payload.item_title as string}
              itemPhotoUrl={payload.item_photo_url as string | null}
              borrowerName={payload.borrower_name as string}
              borrowerAvatarUrl={payload.borrower_avatar_url as string | null}
              requestMessage={message.content}
              depositAmountCents={(payload.deposit_amount_cents as number) ?? 0}
              condition={payload.condition as string | null}
              currentState={transactionState ?? "requested"}
              isOwner={currentUserId === transactionOwnerId}
            />
          </div>
        </div>
      );

    // ─── Owner accepted → borrower sees deposit card ───
    case "request_accepted":
      return (
        <div className="flex flex-col items-center mb-2 gap-1">
          <SystemBadge text={message.content} variant="success" />
          <DepositConfirmCard
            transactionId={payload.transaction_id as string}
            itemTitle={(payload.item_title as string) ?? "Item"}
            itemPhotoUrl={payload.item_photo_url as string | null}
            ownerName={(payload.owner_name as string) ?? "Owner"}
            ownerAptNumber={payload.owner_apt as string | null}
            depositAmountCents={(payload.deposit_amount_cents as number) ?? 0}
            currentState={transactionState ?? "approved"}
            isBorrower={currentUserId !== transactionOwnerId}
          />
        </div>
      );

    // ─── Borrower submitted return → owner sees confirm card ───
    case "return_submitted":
      return (
        <div className="flex flex-col items-center mb-2 gap-1">
          <SystemBadge text={message.content} variant="info" />
          <ReturnConfirmCard
            transactionId={payload.transaction_id as string}
            itemTitle={(payload.item_title as string) ?? "Item"}
            returnPhotoCount={
              (payload.return_photo_ids as string[])?.length ?? 0
            }
            borrowerName={
              message.content.split(" has submitted")[0] ?? "Borrower"
            }
            currentState={transactionState ?? "return_submitted"}
            isOwner={currentUserId === transactionOwnerId}
          />
        </div>
      );

    // ─── Miles detected logistics → both parties see confirm card ───
    case "pickup_suggestion":
      return (
        <div className="flex flex-col items-center mb-2 gap-1">
          <PickupSuggestionCard
            transactionId={payload.transaction_id as string}
            currentUserId={currentUserId}
            ownerId={transactionOwnerId ?? ""}
            borrowerId={transactionBorrowerId ?? ""}
            suggestedLocation={(payload.suggested_location as string) ?? null}
            suggestedDate={(payload.suggested_date as string) ?? null}
            suggestedTime={(payload.suggested_time as string) ?? null}
            suggestedNote={(payload.suggested_note as string) ?? null}
            dateDisplay={(payload.date_display as string) ?? null}
            timeDisplay={(payload.time_display as string) ?? null}
            confidence={(payload.confidence as number) ?? 0.7}
            transactionState={transactionState ?? "deposit_held"}
          />
        </div>
      );

    // ─── Logistics fully confirmed ───
    case "logistics_confirmed":
      return <SystemBadge text={message.content} variant="success" />;

    // ─── Logistics partially confirmed (one party) ───
    case "logistics_partial":
      return <SystemBadge text={message.content} variant="warning" />;

    // ─── System messages (no action needed) ───
    case "request_declined":
      return <SystemBadge text={message.content} variant="error" />;

    case "request_pending":
      return <SystemBadge text={message.content} variant="warning" />;

    case "request_expired":
      return <SystemBadge text={message.content} variant="muted" />;

    case "deposit_confirmed": {
      const txId = (payload.transaction_id as string) ?? "";
      const itemName = (payload.item_title as string) ?? "Item";
      return (
        <div className="flex flex-col items-center mb-2 gap-2">
          <div className="max-w-[90%] px-3 py-1.5 rounded-lg text-xs text-center border bg-green-50 text-green-700 border-green-200">
            {message.content}
          </div>
          <PickupCard
            transactionId={txId}
            itemTitle={itemName}
            currentState={transactionState ?? "deposit_held"}
            currentUserId={currentUserId}
            ownerId={transactionOwnerId ?? ""}
            borrowerId={transactionBorrowerId ?? ""}
          />
        </div>
      );
    }
    case "pickup_confirmed": {
      const txId = (payload.transaction_id as string) ?? "";
      return (
        <PickupConfirmedCard
          message={message.content}
          transactionId={txId}
          isBorrower={currentUserId === transactionBorrowerId}
        />
      );
    }

    case "return_initiated":
      return <SystemBadge text={message.content} variant="info" />;

    case "transaction_complete":
      return <SystemBadge text={message.content} variant="success" />;

    case "request_cancelled":
      return <SystemBadge text={message.content} variant="muted" />;

    // ─── Pickup proposal (from PickupCoordinationCard — still supported) ───
    case "pickup_proposal":
      return (
        <div
          className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1.5`}
        >
          <div
            className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed
              ${
                isMine
                  ? "bg-blue-100 text-blue-900 rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
          >
            <p className="whitespace-pre-line">{message.content}</p>
          </div>
        </div>
      );

    // ─── Regular chat message ───
    case "chat":
    default:
      return (
        <div
          className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1.5`}
        >
          <div
            className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed
              ${
                isMine
                  ? "bg-blue-100 text-blue-900 rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
          >
            {message.content}
          </div>
        </div>
      );
  }
}

// ─── System message badge (centered, muted) ───

type Variant = "success" | "error" | "warning" | "info" | "muted";

function SystemBadge({ text, variant }: { text: string; variant: Variant }) {
  const variantStyles: Record<Variant, string> = {
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
    muted: "bg-muted/50 text-muted-foreground border-border/40",
  };

  return (
    <div className="flex justify-center mb-2">
      <div
        className={`max-w-[90%] px-3 py-1.5 rounded-lg text-xs text-center border ${variantStyles[variant]}`}
      >
        {text}
      </div>
    </div>
  );
}
