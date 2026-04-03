"use client";

import { useState } from "react";

interface DepositConfirmCardProps {
  transactionId: string;
  itemTitle: string;
  itemPhotoUrl?: string | null;
  ownerName: string;
  ownerAptNumber?: string | null;
  depositAmountCents: number;
  currentState: string;
  isBorrower: boolean;
  transactionType?: string | null;
  dailyRentCents?: number | null;
  borrowDays?: number | null;
}

export default function DepositConfirmCard({
  transactionId,
  itemTitle,
  itemPhotoUrl,
  ownerName,
  ownerAptNumber,
  depositAmountCents,
  currentState,
  isBorrower,
  transactionType,
  dailyRentCents,
  borrowDays,
}: DepositConfirmCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depositDisplay = depositAmountCents
    ? `$${(depositAmountCents / 100).toFixed(2)}`
    : "$0.00";

  const isRent = transactionType === "rent";
  const rentalFeeCents = isRent && dailyRentCents && borrowDays
    ? dailyRentCents * borrowDays : 0;
  const rentalFeeDisplay = rentalFeeCents ? `$${(rentalFeeCents / 100).toFixed(2)}` : null;
  const totalCents = depositAmountCents + rentalFeeCents;
  const totalDisplay = `$${(totalCents / 100).toFixed(2)}`;

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      // Call the API to create a Stripe Checkout Session
      const res = await fetch(
        `/api/transactions/${transactionId}/confirm-deposit`,
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

      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start checkout"
      );
      setLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/transactions/${transactionId}/cancel`,
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
      setError(err instanceof Error ? err.message : "Failed to cancel");
      setLoading(false);
    }
  }

  // Already confirmed or moved past this state
  if (!["approved"].includes(currentState)) {
    if (currentState === "deposit_held") {
      return (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 max-w-[300px]">
          <p className="text-xs font-medium text-green-800">
            Deposit confirmed ({depositDisplay}). Coordinate pickup!
          </p>
        </div>
      );
    }
    if (currentState === "cancelled") {
      return (
        <div className="rounded-xl border border-border/40 bg-muted/50 p-3 max-w-[300px]">
          <p className="text-xs text-muted-foreground">
            Request was cancelled.
          </p>
        </div>
      );
    }
    return null;
  }

  // Only borrower sees the confirm/cancel actions
  if (!isBorrower) {
    return (
      <div className="rounded-xl border border-border/40 bg-white p-3 max-w-[300px]">
        <p className="text-xs text-inventory-500">
          Waiting for borrower to confirm deposit...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-inventory-200 bg-white p-3 max-w-[300px]">
      {/* Item info */}
      <div className="flex items-center gap-2 mb-2">
        {itemPhotoUrl ? (
          <img
            src={itemPhotoUrl}
            alt=""
            className="w-12 h-12 rounded-lg object-cover bg-inventory-100 flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-inventory-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] text-inventory-400">photo</span>
          </div>
        )}
        <div>
          <p className="text-sm font-medium leading-tight">{itemTitle}</p>
          <p className="text-xs text-inventory-400">
            Lender: {ownerName}
            {ownerAptNumber && ` · ${ownerAptNumber}`}
          </p>
        </div>
      </div>

      {/* Deposit amount */}
      <div className="flex items-center justify-between py-1.5 border-t border-inventory-100 mb-1">
        <span className="text-xs text-inventory-400">
          Refundable deposit hold
        </span>
        <span className="text-sm font-medium">{depositDisplay}</span>
      </div>

      {/* Rental fee (rent transactions only) */}
      {isRent && rentalFeeDisplay && (
        <>
          <div className="flex items-center justify-between py-1.5 mb-1">
            <span className="text-xs text-inventory-400">
              Rental fee ({borrowDays} day{borrowDays !== 1 ? "s" : ""} × ${((dailyRentCents ?? 0) / 100).toFixed(2)})
            </span>
            <span className="text-sm font-medium">{rentalFeeDisplay}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-t border-inventory-100 mb-1.5">
            <span className="text-xs font-semibold text-inventory-600">
              Total charge
            </span>
            <span className="text-sm font-bold">{totalDisplay}</span>
          </div>
        </>
      )}

      {!isRent && <div className="mb-0.5" />}

      {/* Explanation */}
      <p className="text-[11px] text-inventory-400 mb-3 leading-relaxed">
        {isRent
          ? `You'll be redirected to Stripe. The rental fee (${rentalFeeDisplay}) will be charged immediately. The deposit (${depositDisplay}) will only be charged if the item is damaged — it releases automatically when you return it.`
          : "You'll be redirected to Stripe to authorize the hold. Your card will only be charged if the item is damaged. The hold releases automatically when you return it."}
      </p>

      {/* Error */}
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full py-2 rounded-lg text-sm font-medium
                   bg-teal-800 text-teal-50
                   hover:bg-teal-700 disabled:opacity-50 transition-colors
                   flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-teal-300/30 border-t-teal-100 rounded-full animate-spin" />
            Redirecting to Stripe...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            Confirm &amp; {isRent ? "pay" : "place deposit"}
          </>
        )}
      </button>

      {/* Cancel link */}
      <button
        onClick={handleCancel}
        disabled={loading}
        className="w-full mt-1.5 text-xs text-inventory-400 underline
                   hover:text-inventory-700 disabled:opacity-50 transition-colors"
      >
        Cancel request
      </button>
    </div>
  );
}
