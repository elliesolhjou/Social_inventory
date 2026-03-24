"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Dispute = {
  id: string;
  transaction_id: string;
  filed_by: string;
  state: string;
  reason: string;
  description: string | null;
  resolution_notes: string | null;
  deposit_captured_cents: number | null;
  created_at: string;
  resolved_at: string | null;
  transaction: {
    id: string;
    item_id: string;
    owner_id: string;
    borrower_id: string;
    item: {
      title: string;
      thumbnail_url: string | null;
      category: string;
    };
    owner: { display_name: string };
    borrower: { display_name: string };
  };
};

function getStateStyle(state: string) {
  switch (state) {
    case "filed":
      return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", label: "Filed", icon: "📋" };
    case "under_review":
      return { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", label: "Under Review", icon: "🔍" };
    case "resolved_owner":
      return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "Resolved — Owner", icon: "✅" };
    case "resolved_borrower":
      return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "Resolved — Borrower", icon: "✅" };
    case "dismissed":
      return { bg: "bg-inventory-50", border: "border-inventory-200", text: "text-inventory-500", label: "Dismissed", icon: "🚫" };
    default:
      return { bg: "bg-inventory-50", border: "border-inventory-200", text: "text-inventory-500", label: state, icon: "📄" };
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fetch disputes where user is either the filer or the borrower on the transaction
      const { data: myDisputes } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });

      if (!myDisputes || myDisputes.length === 0) {
        setDisputes([]);
        setLoading(false);
        return;
      }

      // Get transaction details
      const txIds = myDisputes.map((d: any) => d.transaction_id);
      const { data: transactions } = await supabase
        .from("transactions")
        .select("id, item_id, owner_id, borrower_id")
        .in("id", txIds);

      if (!transactions) {
        setDisputes([]);
        setLoading(false);
        return;
      }

      // Filter to only disputes where user is owner or borrower
      const txMap = new Map(transactions.map((t: any) => [t.id, t]));
      const relevant = myDisputes.filter((d: any) => {
        const tx = txMap.get(d.transaction_id);
        return tx && (tx.owner_id === user.id || tx.borrower_id === user.id);
      });

      // Get item and profile details
      const itemIds = [...new Set(transactions.map((t: any) => t.item_id))];
      const profileIds = [...new Set(transactions.flatMap((t: any) => [t.owner_id, t.borrower_id]))];

      const [itemsRes, profilesRes] = await Promise.all([
        supabase.from("items").select("id, title, thumbnail_url, category").in("id", itemIds),
        supabase.from("profiles").select("id, display_name").in("id", profileIds),
      ]);

      const itemMap = new Map((itemsRes.data ?? []).map((i: any) => [i.id, i]));
      const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));

      const enriched = relevant.map((d: any) => {
        const tx = txMap.get(d.transaction_id);
        const item = itemMap.get(tx?.item_id) ?? { title: "Unknown", thumbnail_url: null, category: "" };
        const owner = profileMap.get(tx?.owner_id) ?? { display_name: "Unknown" };
        const borrower = profileMap.get(tx?.borrower_id) ?? { display_name: "Unknown" };
        return {
          ...d,
          transaction: { ...tx, item, owner, borrower },
        };
      });

      setDisputes(enriched);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = disputes.filter((d) => {
    if (filter === "open") return ["filed", "under_review"].includes(d.state);
    if (filter === "resolved") return ["resolved_owner", "resolved_borrower", "dismissed"].includes(d.state);
    return true;
  });

  const openCount = disputes.filter((d) => ["filed", "under_review"].includes(d.state)).length;
  const resolvedCount = disputes.filter((d) => ["resolved_owner", "resolved_borrower", "dismissed"].includes(d.state)).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-inventory-50/30 pt-6 pb-20 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="w-9 h-9 rounded-full bg-inventory-100 flex items-center justify-center hover:bg-inventory-200 transition-colors">
            <svg className="w-4 h-4 text-inventory-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-display font-bold text-xl">Dispute Center</h1>
            <p className="text-xs text-inventory-400">{disputes.length} dispute{disputes.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex rounded-2xl bg-inventory-100 p-1 mb-6">
          {[
            { key: "all" as const, label: "All", count: disputes.length },
            { key: "open" as const, label: "Open", count: openCount },
            { key: "resolved" as const, label: "Resolved", count: resolvedCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-display font-semibold transition-all flex items-center justify-center gap-1.5 ${
                filter === tab.key
                  ? "bg-white shadow-sm text-inventory-900"
                  : "text-inventory-500 hover:text-inventory-700"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  filter === tab.key ? "bg-accent/10 text-accent" : "bg-inventory-200 text-inventory-400"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-inventory-200 border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <span className="text-4xl block mb-3">🎉</span>
            <h3 className="font-display font-bold text-lg mb-1">
              {filter === "all" ? "No disputes" : filter === "open" ? "No open disputes" : "No resolved disputes"}
            </h3>
            <p className="text-sm text-inventory-400">
              {filter === "all"
                ? "All your transactions are dispute-free!"
                : "Nothing here right now."}
            </p>
          </div>
        )}

        {/* Dispute cards */}
        <div className="space-y-3">
          {filtered.map((dispute) => {
            const style = getStateStyle(dispute.state);
            const isOwner = dispute.filed_by === userId;
            const otherParty = isOwner
              ? dispute.transaction.borrower.display_name
              : dispute.transaction.owner.display_name;

            return (
              <div
                key={dispute.id}
                className={`rounded-2xl border ${style.border} ${style.bg} p-4 transition-all`}
              >
                {/* Top row: item + status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                      {dispute.transaction.item.thumbnail_url ? (
                        <img
                          src={dispute.transaction.item.thumbnail_url}
                          alt={dispute.transaction.item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg">📦</span>
                      )}
                    </div>
                    <div>
                      <p className="font-display font-bold text-sm line-clamp-1">
                        {dispute.transaction.item.title}
                      </p>
                      <p className="text-[10px] text-inventory-400">
                        {isOwner ? `Borrower: ${otherParty}` : `Owner: ${otherParty}`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                    {style.icon} {style.label}
                  </span>
                </div>

                {/* Reason */}
                <div className="mb-2">
                  <p className="text-xs font-bold text-inventory-600 mb-0.5">Reason</p>
                  <p className="text-sm text-inventory-700">{dispute.reason}</p>
                </div>

                {/* Description */}
                {dispute.description && (
                  <p className="text-xs text-inventory-500 mb-2 line-clamp-2">
                    {dispute.description}
                  </p>
                )}

                {/* Resolution */}
                {dispute.resolution_notes && (
                  <div className="mt-2 p-3 rounded-xl bg-white border border-inventory-100">
                    <p className="text-xs font-bold text-inventory-600 mb-0.5">Resolution</p>
                    <p className="text-sm text-inventory-700">{dispute.resolution_notes}</p>
                    {dispute.deposit_captured_cents != null && dispute.deposit_captured_cents > 0 && (
                      <p className="text-xs text-accent font-bold mt-1">
                        Deposit captured: ${(dispute.deposit_captured_cents / 100).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-inventory-100/50">
                  <p className="text-[10px] text-inventory-400">
                    Filed {timeAgo(dispute.created_at)}
                    {dispute.resolved_at && ` · Resolved ${timeAgo(dispute.resolved_at)}`}
                  </p>
                  <span className="text-[10px] text-inventory-300">
                    {isOwner ? "You filed" : "Filed against you"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Help link */}
        <div className="mt-8 text-center">
          <Link href="/support" className="text-xs text-accent font-medium hover:underline">
            Need help? Visit Support →
          </Link>
        </div>
      </div>
    </main>
  );
}
