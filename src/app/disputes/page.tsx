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

/* ── SVG Icons ── */
const ChevronLeft = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const PackageIcon = () => (
  <svg className="w-5 h-5 text-[#8f7067]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

/* ── State styling (no emojis) ── */
function getStateStyle(state: string) {
  switch (state) {
    case "filed":
      return {
        badge: "bg-amber-50 text-amber-700 border border-amber-200",
        card: "bg-white border border-[#e6e2de]/50",
        label: "Filed",
      };
    case "under_review":
      return {
        badge: "bg-blue-50 text-blue-700 border border-blue-200",
        card: "bg-white border border-[#e6e2de]/50",
        label: "Under Review",
      };
    case "resolved_owner":
      return {
        badge: "bg-[#d2e6bc] text-[#526442] border border-[#b9cda4]",
        card: "bg-white border border-[#e6e2de]/50",
        label: "Resolved \u2014 Owner",
      };
    case "resolved_borrower":
      return {
        badge: "bg-[#d2e6bc] text-[#526442] border border-[#b9cda4]",
        card: "bg-white border border-[#e6e2de]/50",
        label: "Resolved \u2014 Borrower",
      };
    case "dismissed":
      return {
        badge: "bg-[#ebe7e4] text-[#5b4038] border border-[#e6e2de]",
        card: "bg-white border border-[#e6e2de]/50",
        label: "Dismissed",
      };
    default:
      return {
        badge: "bg-[#ebe7e4] text-[#5b4038] border border-[#e6e2de]",
        card: "bg-white border border-[#e6e2de]/50",
        label: state,
      };
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: myDisputes } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });

      if (!myDisputes || myDisputes.length === 0) {
        setDisputes([]);
        setLoading(false);
        return;
      }

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

      const txMap = new Map(transactions.map((t: any) => [t.id, t]));
      const relevant = myDisputes.filter((d: any) => {
        const tx = txMap.get(d.transaction_id);
        return tx && (tx.owner_id === user.id || tx.borrower_id === user.id);
      });

      const itemIds = [
        ...new Set(transactions.map((t: any) => t.item_id)),
      ];
      const profileIds = [
        ...new Set(
          transactions.flatMap((t: any) => [t.owner_id, t.borrower_id])
        ),
      ];

      const [itemsRes, profilesRes] = await Promise.all([
        supabase
          .from("items")
          .select("id, title, thumbnail_url, category")
          .in("id", itemIds),
        supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", profileIds),
      ]);

      const itemMap = new Map(
        (itemsRes.data ?? []).map((i: any) => [i.id, i])
      );
      const profileMap = new Map(
        (profilesRes.data ?? []).map((p: any) => [p.id, p])
      );

      const enriched = relevant.map((d: any) => {
        const tx = txMap.get(d.transaction_id);
        const item = itemMap.get(tx?.item_id) ?? {
          title: "Unknown",
          thumbnail_url: null,
          category: "",
        };
        const owner = profileMap.get(tx?.owner_id) ?? {
          display_name: "Unknown",
        };
        const borrower = profileMap.get(tx?.borrower_id) ?? {
          display_name: "Unknown",
        };
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
    if (filter === "open")
      return ["filed", "under_review"].includes(d.state);
    if (filter === "resolved")
      return [
        "resolved_owner",
        "resolved_borrower",
        "dismissed",
      ].includes(d.state);
    return true;
  });

  const openCount = disputes.filter((d) =>
    ["filed", "under_review"].includes(d.state)
  ).length;
  const resolvedCount = disputes.filter((d) =>
    ["resolved_owner", "resolved_borrower", "dismissed"].includes(d.state)
  ).length;

  return (
    <main className="min-h-screen bg-[#fdf9f5] pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f7f3ef]/90 backdrop-blur-md border-b border-[#e6e2de]/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-[#8f7067] hover:text-[#1c1b1a] transition-colors"
          >
            <ChevronLeft />
          </Link>
          <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1c1b1a]">
            Disputes
          </h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Hero header */}
        <div className="pt-10 pb-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-[#ae3200] font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-widest uppercase mb-2 block">
                Resolution Center
              </span>
              <h2 className="text-4xl sm:text-5xl font-['Plus_Jakarta_Sans'] font-extrabold tracking-tight text-[#1c1b1a]">
                Dispute Center
              </h2>
            </div>
            <div className="bg-[#ae3200]/10 px-5 py-3 rounded-2xl flex items-center gap-2 flex-shrink-0">
              <span className="text-[#ae3200] font-['Plus_Jakarta_Sans'] font-bold text-3xl">
                {openCount}
              </span>
              <span className="text-[#ae3200]/70 font-['Plus_Jakarta_Sans'] font-semibold text-sm leading-tight">
                Active
                <br />
                Disputes
              </span>
            </div>
          </div>
        </div>

        {/* Segmented tabs */}
        <div className="bg-[#f7f3ef] p-1.5 rounded-full flex gap-1 mb-10 w-fit">
          {[
            {
              key: "all" as const,
              label: "All",
              count: disputes.length,
            },
            { key: "open" as const, label: "Open", count: openCount },
            {
              key: "resolved" as const,
              label: "Resolved",
              count: resolvedCount,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-8 py-2.5 rounded-full text-sm font-['Plus_Jakarta_Sans'] font-bold transition-all ${
                filter === tab.key
                  ? "bg-white text-[#ae3200] shadow-sm"
                  : "text-[#5b4038] hover:bg-[#ebe7e4]"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-[#e6e2de] border-t-[#ae3200] rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full bg-[#d2e6bc] flex items-center justify-center mx-auto mb-4">
              <ShieldCheckIcon />
            </div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1c1b1a] mb-1">
              {filter === "all"
                ? "No disputes"
                : filter === "open"
                ? "No open disputes"
                : "No resolved disputes"}
            </h3>
            <p className="text-sm text-[#8f7067] font-['Be_Vietnam_Pro']">
              {filter === "all"
                ? "All your transactions are dispute-free!"
                : "Nothing here right now."}
            </p>
          </div>
        )}

        {/* Dispute cards */}
        <div className="space-y-5">
          {filtered.map((dispute) => {
            const style = getStateStyle(dispute.state);
            const isOwner = dispute.filed_by === userId;
            const otherParty = isOwner
              ? dispute.transaction.borrower.display_name
              : dispute.transaction.owner.display_name;

            return (
              <div
                key={dispute.id}
                className={`${style.card} rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-xl hover:shadow-[#ae3200]/5 transition-all group`}
              >
                <div className="flex gap-5">
                  {/* Item thumbnail */}
                  <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-[#f7f3ef]">
                    {dispute.transaction.item.thumbnail_url ? (
                      <img
                        src={dispute.transaction.item.thumbnail_url}
                        alt={dispute.transaction.item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PackageIcon />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start mb-2 gap-3">
                      <div className="min-w-0">
                        <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl text-[#1c1b1a] truncate">
                          {dispute.transaction.item.title}
                        </h3>
                        <p className="text-sm text-[#5b4038] font-['Be_Vietnam_Pro'] font-medium">
                          {isOwner
                            ? `Borrower: ${otherParty}`
                            : `Owner: ${otherParty}`}
                        </p>
                      </div>
                      <span
                        className={`${style.badge} px-4 py-1.5 rounded-full text-xs font-['Plus_Jakarta_Sans'] font-bold uppercase tracking-wider flex-shrink-0 whitespace-nowrap`}
                      >
                        {style.label}
                      </span>
                    </div>

                    {/* Reason box */}
                    <div className="mt-3 p-4 bg-[#f7f3ef] rounded-xl">
                      <span className="text-[10px] font-['Plus_Jakarta_Sans'] font-bold text-[#ae3200] uppercase tracking-widest block mb-1">
                        Reason for dispute
                      </span>
                      <p className="text-sm text-[#1c1b1a] font-['Be_Vietnam_Pro'] italic">
                        &quot;{dispute.reason}&quot;
                      </p>
                    </div>

                    {/* Description */}
                    {dispute.description && (
                      <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro'] mt-2 line-clamp-2">
                        {dispute.description}
                      </p>
                    )}

                    {/* Resolution */}
                    {dispute.resolution_notes && (
                      <div className="mt-3 p-4 rounded-xl bg-white border border-[#e6e2de]/50">
                        <span className="text-[10px] font-['Plus_Jakarta_Sans'] font-bold text-[#526442] uppercase tracking-widest block mb-1">
                          Resolution
                        </span>
                        <p className="text-sm text-[#1c1b1a] font-['Be_Vietnam_Pro']">
                          {dispute.resolution_notes}
                        </p>
                        {dispute.deposit_captured_cents != null &&
                          dispute.deposit_captured_cents > 0 && (
                            <p className="text-xs text-[#ae3200] font-['Plus_Jakarta_Sans'] font-bold mt-1">
                              Deposit captured: $
                              {(
                                dispute.deposit_captured_cents / 100
                              ).toFixed(2)}
                            </p>
                          )}
                      </div>
                    )}

                    {/* Footer meta */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#e6e2de]/30">
                      <p className="text-[10px] text-[#8f7067] font-['Be_Vietnam_Pro']">
                        Filed {timeAgo(dispute.created_at)}
                        {dispute.resolved_at &&
                          ` · Resolved ${timeAgo(dispute.resolved_at)}`}
                      </p>
                      <span className="text-[10px] text-[#8f7067]/60 font-['Be_Vietnam_Pro']">
                        {isOwner ? "You filed" : "Filed against you"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Proxie mediation CTA */}
        <div className="mt-16 bg-[#f7f3ef] rounded-2xl p-8 border border-[#e6e2de]/30">
          <div className="flex gap-5 items-start">
            <div className="w-12 h-12 rounded-full bg-[#1c1b1a]/5 text-[#5b4038] flex items-center justify-center flex-shrink-0">
              <SparklesIcon />
            </div>
            <div>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1c1b1a] mb-1">
                Need help mediating?
              </h4>
              <p className="text-[#5b4038]/80 font-['Be_Vietnam_Pro'] text-sm leading-relaxed mb-6">
                Proxie can analyze your lending agreement and photos to suggest a
                fair resolution for both parties.
              </p>
              <Link
                href="/support"
                className="inline-block bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white font-['Plus_Jakarta_Sans'] font-bold px-8 py-3 rounded-full text-sm hover:shadow-lg hover:shadow-[#ae3200]/20 active:scale-95 transition-all"
              >
                Ask Proxie to Mediate
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex flex-col items-center gap-4 w-full mt-16 mb-8">
          <Link
            href="/support"
            className="group flex items-center gap-2 text-[#ae3200] font-['Be_Vietnam_Pro'] text-sm hover:text-[#ff5a1f] transition-colors"
          >
            Need help? Visit Support
            <ArrowRightIcon />
          </Link>
          <p className="text-[#8f7067] font-['Be_Vietnam_Pro'] text-sm">
            &copy; 2026 Proxe Neighborhood Sharing
          </p>
        </footer>
      </div>
    </main>
  );
}
