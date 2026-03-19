"use client";

import { useState } from "react";

interface BorrowRequestCardProps {
  transactionId: string;
  itemTitle: string;
  itemPhotoUrl?: string | null;
  borrowerName: string;
  borrowerAvatarUrl?: string | null;
  requestMessage?: string | null;
  depositAmountCents: number;
  condition?: string | null;
  currentState: string;
  isOwner: boolean;
}

export default function BorrowRequestCard({
  transactionId,
  itemTitle,
  itemPhotoUrl,
  borrowerName,
  requestMessage,
  depositAmountCents,
  condition,
  currentState,
  isOwner,
}: BorrowRequestCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [responded, setResponded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const depositDisplay = depositAmountCents
    ? `$${(depositAmountCents / 100).toFixed(2)}`
    : "No deposit";

  const conditionDisplay = condition
    ? condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  async function handleAction(action: "approve" | "decline" | "pending") {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/transactions/${transactionId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setResponded(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to respond");
    } finally {
      setLoading(null);
    }
  }

  // Already responded — show confirmation
  if (responded || !["requested", "pending"].includes(currentState)) {
    const finalAction = responded || currentState;
    return (
      <div className="rounded-xl border border-border/40 bg-card p-3 max-w-[300px]">
        <div className="flex items-center gap-2 mb-2">
          <ItemThumbnail url={itemPhotoUrl} />
          <div>
            <p className="text-sm font-medium leading-tight">{itemTitle}</p>
            <p className="text-xs text-muted-foreground">
              {conditionDisplay && `${conditionDisplay} · `}
              Deposit: {depositDisplay}
            </p>
          </div>
        </div>
        <StatusBadge action={finalAction} />
      </div>
    );
  }

  // Owner sees action buttons
  if (!isOwner) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-card p-3 max-w-[300px]">
      {/* Item info */}
      <div className="flex items-center gap-2 mb-2">
        <ItemThumbnail url={itemPhotoUrl} />
        <div>
          <p className="text-sm font-medium leading-tight">{itemTitle}</p>
          <p className="text-xs text-muted-foreground">
            {conditionDisplay && `${conditionDisplay} · `}
            Deposit: {depositDisplay}
          </p>
        </div>
      </div>

      {/* Request message */}
      {requestMessage && (
        <p className="text-xs text-muted-foreground pb-2 mb-2 border-b border-border/40">
          &ldquo;{requestMessage}&rdquo;
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={() => handleAction("approve")}
          disabled={loading !== null}
          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium
                     bg-green-50 text-green-800 border border-green-300
                     hover:bg-green-100 disabled:opacity-50 transition-colors"
        >
          {loading === "approve" ? "..." : "Lend it"}
        </button>
        <button
          onClick={() => handleAction("decline")}
          disabled={loading !== null}
          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium
                     bg-red-50 text-red-800 border border-red-300
                     hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          {loading === "decline" ? "..." : "Can't lend"}
        </button>

      </div>
    </div>
  );
}

function ItemThumbnail({ url }: { url?: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="w-12 h-12 rounded-lg object-cover bg-muted flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] text-muted-foreground">photo</span>
    </div>
  );
}

function StatusBadge({ action }: { action: string }) {
  const config: Record<string, { label: string; className: string }> = {
    approved: {
      label: "Approved",
      className: "bg-green-50 text-green-800 border-green-300",
    },
    declined: {
      label: "Declined",
      className: "bg-red-50 text-red-800 border-red-300",
    },
    pending: {
      label: "Pending (24hr)",
      className: "bg-amber-50 text-amber-800 border-amber-300",
    },
    expired: {
      label: "Expired",
      className: "bg-gray-50 text-gray-600 border-gray-300",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-gray-50 text-gray-600 border-gray-300",
    },
  };

  const { label, className } = config[action] ?? {
    label: action,
    className: "bg-gray-50 text-gray-600 border-gray-300",
  };

  return (
    <div
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${className}`}
    >
      {label}
    </div>
  );
}
