"use client";

import { useState } from "react";

interface PickupConfirmButtonProps {
  transactionId: string;
  currentUserId: string;
  ownerId: string;
  confirmations: {
    borrower_confirmed: boolean;
    owner_confirmed: boolean;
  };
  transactionState: string;
}

export default function PickupConfirmButton({
  transactionId,
  currentUserId,
  ownerId,
  confirmations,
  transactionState,
}: PickupConfirmButtonProps) {
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentUserId === ownerId;
  const isBorrower = !isOwner;

  const myConfirmation = isOwner
    ? confirmations.owner_confirmed
    : confirmations.borrower_confirmed;

  const theirConfirmation = isOwner
    ? confirmations.borrower_confirmed
    : confirmations.owner_confirmed;

  const bothDone =
    confirmations.borrower_confirmed && confirmations.owner_confirmed;

  // Already picked up
  if (transactionState === "picked_up" || bothDone) {
    return (
      <div className="flex items-center gap-1.5 mt-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Pickup confirmed by both
        </span>
      </div>
    );
  }

  // I already confirmed, waiting for the other
  if (myConfirmation || confirmed) {
    return (
      <div className="flex items-center gap-1.5 mt-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          You confirmed — waiting for {isOwner ? "borrower" : "lender"}
        </span>
      </div>
    );
  }

  // Not in the right state for pickup
  if (transactionState !== "deposit_held") {
    return null;
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/transactions/${transactionId}/confirm-pickup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      const data = await res.json();
      setConfirmed(true);

      if (data.both_confirmed) {
        // Both done — reload to show updated state
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      {theirConfirmation && (
        <p className="text-[11px] text-green-600 mb-1">
          {isOwner ? "Borrower" : "Lender"} already confirmed — your turn!
        </p>
      )}
      {error && <p className="text-[11px] text-red-600 mb-1">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                   bg-accent text-white hover:bg-accent-dark
                   disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <>
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Confirming...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {isOwner ? "Confirm handoff" : "Confirm pickup"}
          </>
        )}
      </button>
    </div>
  );
}
