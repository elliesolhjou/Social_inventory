"use client";

import { useState } from "react";

interface ReturnConfirmCardProps {
  transactionId: string;
  itemTitle: string;
  returnPhotoCount: number;
  borrowerName: string;
  currentState: string;
  isOwner: boolean;
}

export default function ReturnConfirmCard({
  transactionId,
  itemTitle,
  returnPhotoCount,
  borrowerName,
  currentState,
  isOwner,
}: ReturnConfirmCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already confirmed or moved past this state
  if (currentState === "inspection_pending" || currentState === "completed") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-3 max-w-[300px]">
        <p className="text-xs font-medium text-green-800">
          Return confirmed. {currentState === "completed" ? "Transaction complete — deposit released." : "Inspection window is open."}
        </p>
      </div>
    );
  }

  if (currentState !== "return_submitted") {
    return null;
  }

  // Borrower sees waiting message
  if (!isOwner) {
    return (
      <div className="rounded-xl border border-border/40 bg-white p-3 max-w-[300px]">
        <p className="text-xs text-inventory-500">
          Waiting for the owner to confirm they received the item...
        </p>
      </div>
    );
  }

  async function handleConfirmReturn() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/transactions/${transactionId}/confirm-return`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm return");
      setLoading(false);
    }
  }

  // Owner sees confirm card
  return (
    <div className="rounded-xl border border-inventory-200 bg-white p-3 max-w-[300px]">
      {/* Item info */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">📦</span>
        </div>
        <div>
          <p className="text-sm font-medium leading-tight">{itemTitle}</p>
          <p className="text-xs text-inventory-400">
            {borrowerName} submitted {returnPhotoCount} return photo{returnPhotoCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-[11px] text-inventory-400 mb-3 leading-relaxed">
        Confirm you&#39;ve received the item back. You&#39;ll have 24 hours to inspect
        it and report any damage before the deposit is released.
      </p>

      {/* Error */}
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {/* Confirm button */}
      <button
        onClick={handleConfirmReturn}
        disabled={loading}
        className="w-full py-2 rounded-lg text-sm font-medium
                   bg-teal-800 text-teal-50
                   hover:bg-teal-700 disabled:opacity-50 transition-colors
                   flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-teal-300/30 border-t-teal-100 rounded-full animate-spin" />
            Confirming...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
            I received the item
          </>
        )}
      </button>
    </div>
  );
}
