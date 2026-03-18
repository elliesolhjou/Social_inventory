"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface BorrowRequest {
  id: string;
  transaction_id: string;
  item_id: string;
  borrower_id: string;
  item_title: string;
  item_photo_url: string | null;
  borrower_display_name: string | null;
  borrower_avatar_url: string | null;
  status: string;
  request_message: string | null;
  requested_at: string;
  pending_expires_at: string | null;
}

type FilterStatus = "active" | "resolved";

export default function RequestsDashboard() {
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("active");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function fetchRequests() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const activeStatuses = ["requested", "pending"];
    const resolvedStatuses = ["approved", "declined", "expired", "cancelled"];

    const { data, error } = await supabase
      .from("borrow_requests")
      .select("*")
      .eq("owner_id", user.id)
      .in("status", filter === "active" ? activeStatuses : resolvedStatuses)
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch requests:", error);
    } else {
      setRequests(data ?? []);
    }
    setLoading(false);
  }

  async function handleAction(
    transactionId: string,
    action: "approve" | "decline" | "pending"
  ) {
    setActionLoading(transactionId);

    try {
      const res = await fetch(`/api/transactions/${transactionId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Action failed:", data.error);
        return;
      }

      // Refresh the list
      await fetchRequests();
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function expiresIn(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hrs > 0) return `${hrs}h ${mins}m left`;
    return `${mins}m left`;
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-muted/50 rounded-lg">
        <button
          onClick={() => setFilter("active")}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors
            ${
              filter === "active"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
        >
          Active requests
        </button>
        <button
          onClick={() => setFilter("resolved")}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors
            ${
              filter === "resolved"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
        >
          Past requests
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Loading...
        </div>
      )}

      {/* Empty state */}
      {!loading && requests.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            {filter === "active"
              ? "No pending requests right now."
              : "No past requests yet."}
          </p>
        </div>
      )}

      {/* Request cards */}
      <div className="space-y-2">
        {requests.map((req) => (
          <div
            key={req.id}
            className="rounded-xl border border-border/40 bg-card p-3"
          >
            {/* Header: borrower + timing */}
            <div className="flex items-center gap-2 mb-2">
              {req.borrower_avatar_url ? (
                <img
                  src={req.borrower_avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-medium text-blue-800">
                    {(req.borrower_display_name ?? "?")[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {req.borrower_display_name ?? "Someone"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {timeAgo(req.requested_at)}
                  {req.status === "pending" &&
                    req.pending_expires_at &&
                    ` · ${expiresIn(req.pending_expires_at)}`}
                </p>
              </div>
              <StatusPill status={req.status} />
            </div>

            {/* Item info */}
            <div className="flex items-center gap-2 mb-2">
              {req.item_photo_url ? (
                <img
                  src={req.item_photo_url}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover bg-muted"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">
                    photo
                  </span>
                </div>
              )}
              <p className="text-sm text-foreground">{req.item_title}</p>
            </div>

            {/* Message */}
            {req.request_message && (
              <p className="text-xs text-muted-foreground mb-2 italic">
                &ldquo;{req.request_message}&rdquo;
              </p>
            )}

            {/* Action buttons (only for active requests) */}
            {["requested", "pending"].includes(req.status) && (
              <div className="flex gap-1.5 pt-2 border-t border-border/40">
                <button
                  onClick={() => handleAction(req.transaction_id, "approve")}
                  disabled={actionLoading === req.transaction_id}
                  className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium
                             bg-green-50 text-green-800 border border-green-300
                             hover:bg-green-100 disabled:opacity-50 transition-colors"
                >
                  Lend it
                </button>
                <button
                  onClick={() => handleAction(req.transaction_id, "decline")}
                  disabled={actionLoading === req.transaction_id}
                  className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium
                             bg-red-50 text-red-800 border border-red-300
                             hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  Can't lend
                </button>
                {req.status === "requested" && (
                  <button
                    onClick={() => handleAction(req.transaction_id, "pending")}
                    disabled={actionLoading === req.transaction_id}
                    className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium
                               bg-amber-50 text-amber-800 border border-amber-300
                               hover:bg-amber-100 disabled:opacity-50 transition-colors"
                  >
                    Thinking...
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    requested: {
      label: "New",
      className: "bg-blue-50 text-blue-700",
    },
    pending: {
      label: "Pending",
      className: "bg-amber-50 text-amber-700",
    },
    approved: {
      label: "Approved",
      className: "bg-green-50 text-green-700",
    },
    declined: {
      label: "Declined",
      className: "bg-red-50 text-red-700",
    },
    expired: {
      label: "Expired",
      className: "bg-gray-100 text-gray-500",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-gray-100 text-gray-500",
    },
  };

  const { label, className } = config[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-500",
  };

  return (
    <span
      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${className}`}
    >
      {label}
    </span>
  );
}
