"use client";

import { useEffect, useState } from "react";

interface Dispute {
  id: string;
  state: string;
  reason: string;
  description?: string;
  resolution_notes?: string;
  deposit_captured_cents: number;
  created_at: string;
  resolved_at?: string;
}

interface DisputeStatusCardProps {
  transactionId: string;
  /** Current user's role in this transaction */
  role: "owner" | "borrower";
  depositCents: number;
}

const STATE_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  filed: {
    label: "Dispute Filed",
    color: "bg-amber-50 border-amber-200 text-amber-800",
    icon: "⚠️",
  },
  under_review: {
    label: "Under Review",
    color: "bg-blue-50 border-blue-200 text-blue-800",
    icon: "🔍",
  },
  resolved_owner: {
    label: "Resolved — Owner's Favor",
    color: "bg-red-50 border-red-200 text-red-800",
    icon: "🔴",
  },
  resolved_borrower: {
    label: "Resolved — Borrower's Favor",
    color: "bg-green-50 border-green-200 text-green-800",
    icon: "🟢",
  },
  dismissed: {
    label: "Dismissed",
    color: "bg-inventory-50 border-inventory-200 text-inventory-600",
    icon: "⊘",
  },
};

export default function DisputeStatusCard({
  transactionId,
  role,
  depositCents,
}: DisputeStatusCardProps) {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDispute() {
      try {
        const res = await fetch(`/api/disputes/transaction/${transactionId}`);
        const data = await res.json();
        setDispute(data.dispute ?? null);
      } catch {
        // No dispute exists or fetch failed
      } finally {
        setLoading(false);
      }
    }
    fetchDispute();
  }, [transactionId]);

  if (loading) {
    return (
      <div className="p-4 rounded-2xl bg-inventory-50 border border-inventory-200 animate-pulse">
        <div className="h-4 bg-inventory-200 rounded w-1/3" />
      </div>
    );
  }

  if (!dispute) return null;

  const config = STATE_CONFIG[dispute.state] ?? STATE_CONFIG.filed;
  const isResolved = ["resolved_owner", "resolved_borrower", "dismissed"].includes(
    dispute.state
  );

  return (
    <div className={`p-5 rounded-2xl border ${config.color}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xl">{config.icon}</span>
        <div>
          <h4 className="font-display font-bold text-sm">{config.label}</h4>
          <p className="text-xs opacity-70">
            Filed {new Date(dispute.created_at).toLocaleDateString()}
            {dispute.resolved_at &&
              ` · Resolved ${new Date(dispute.resolved_at).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {/* Reason */}
      <p className="text-sm mb-2">
        <span className="font-medium">Reason:</span> {dispute.reason}
      </p>
      {dispute.description && (
        <p className="text-sm opacity-80 mb-3">{dispute.description}</p>
      )}

      {/* Resolution details */}
      {isResolved && (
        <div className="pt-3 border-t border-current/10 space-y-2">
          {dispute.resolution_notes && (
            <p className="text-sm">
              <span className="font-medium">Resolution:</span>{" "}
              {dispute.resolution_notes}
            </p>
          )}
          <p className="text-sm font-medium">
            {dispute.deposit_captured_cents > 0
              ? `$${(dispute.deposit_captured_cents / 100).toFixed(2)} of $${(depositCents / 100).toFixed(2)} deposit captured`
              : "Deposit released in full"}
          </p>
        </div>
      )}

      {/* Pending state messages */}
      {!isResolved && (
        <div className="pt-3 border-t border-current/10">
          <p className="text-xs opacity-70">
            {role === "owner"
              ? "Your dispute is being reviewed. You'll be notified when a decision is made."
              : "A dispute has been filed. The deposit hold remains active until resolution."}
          </p>
        </div>
      )}
    </div>
  );
}
