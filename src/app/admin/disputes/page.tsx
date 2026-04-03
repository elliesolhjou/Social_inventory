"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

const FOUNDER_ID = "e7eb677b-a7a3-401c-a682-9775f1303a52";

type DisputeStatus = "filed" | "under_review" | "resolved" | "dismissed";
type FilterTab = "all" | DisputeStatus;
type Outcome = "release_to_borrower" | "capture_for_owner" | "dismiss";

interface Dispute {
  id: string;
  transaction_id: string;
  item_id: string;
  filed_by: string;
  filed_against: string;
  reason: string;
  description: string;
  dispute_photos: string[] | null;
  status: DisputeStatus;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  unit_number: string | null;
}

interface Item {
  id: string;
  title: string;
  thumbnail_url: string | null;
  deposit_cents: number;
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "filed", label: "Filed" },
  { key: "under_review", label: "Under Review" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];

const STATUS_STYLES: Record<DisputeStatus, string> = {
  filed: "bg-[#fef3c7] text-[#92400e]",
  under_review: "bg-[#dbeafe] text-[#1e40af]",
  resolved: "bg-[#d1fae5] text-[#065f46]",
  dismissed: "bg-[#f3f4f6] text-[#4b5563]",
};

const STATUS_LABELS: Record<DisputeStatus, string> = {
  filed: "Filed",
  under_review: "Under Review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const OUTCOME_OPTIONS: { value: Outcome; label: string }[] = [
  { value: "release_to_borrower", label: "Release deposit to borrower" },
  { value: "capture_for_owner", label: "Capture deposit for owner" },
  { value: "dismiss", label: "Dismiss dispute" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/* ─── SVG Icons (no emojis) ─── */

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
    </svg>
  );
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function ExclamationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
    </svg>
  );
}

/* ─── Avatar Component ─── */

function Avatar({ profile, size = 36 }: { profile?: Profile; size?: number }) {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.display_name}
        width={size}
        height={size}
        className="rounded-full object-cover border border-[#e6e2de]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-[#fdf0ea] flex items-center justify-center border border-[#e6e2de]"
      style={{ width: size, height: size }}
    >
      <UserIcon className="w-4 h-4 text-[#ae3200]" />
    </div>
  );
}

/* ─── Photo Viewer ─── */

function DisputePhotos({ photos }: { photos: string[] }) {
  const [viewingIdx, setViewingIdx] = useState<number | null>(null);

  return (
    <>
      <div className="flex gap-2 flex-wrap mt-2">
        {photos.map((url, i) => (
          <button
            key={i}
            onClick={() => setViewingIdx(i)}
            className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#e6e2de] hover:border-[#ae3200] transition-colors group"
          >
            <img src={url} alt={`Dispute photo ${i + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {viewingIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewingIdx(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={photos[viewingIdx]}
              alt={`Dispute photo ${viewingIdx + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setViewingIdx(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-[#1c1b1a] hover:bg-[#fdf9f5] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            {photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setViewingIdx(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === viewingIdx ? "bg-white" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Main Page ─── */

export default function AdminDisputesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [items, setItems] = useState<Record<string, Item>>({});
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome | "">>({}); 
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [successId, setSuccessId] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);

    const { data: disputeData } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });

    if (!disputeData || disputeData.length === 0) {
      setDisputes([]);
      setLoading(false);
      return;
    }

    const profileIds = new Set<string>();
    const itemIds = new Set<string>();

    disputeData.forEach((d) => {
      profileIds.add(d.filed_by);
      profileIds.add(d.filed_against);
      if (d.item_id) itemIds.add(d.item_id);
    });

    const [{ data: profileData }, { data: itemData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, unit_number")
        .in("id", Array.from(profileIds)),
      itemIds.size > 0
        ? supabase
            .from("items")
            .select("id, title, thumbnail_url, deposit_cents")
            .in("id", Array.from(itemIds))
        : Promise.resolve({ data: [] }),
    ]);

    const pMap: Record<string, Profile> = {};
    profileData?.forEach((p) => (pMap[p.id] = p));

    const iMap: Record<string, Item> = {};
    itemData?.forEach((i) => (iMap[i.id] = i));

    setDisputes(disputeData);
    setProfiles(pMap);
    setItems(iMap);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.id !== FOUNDER_ID) {
        router.replace("/dashboard");
        return;
      }
      setAuthed(true);
      fetchDisputes();
    };
    checkAuth();
  }, [router, supabase, fetchDisputes]);

  const handleResolve = async (disputeId: string) => {
    const outcome = outcomes[disputeId];
    if (!outcome) return;

    const confirmed = window.confirm(
      outcome === "capture_for_owner"
        ? "This will charge the borrower's deposit. Are you sure?"
        : outcome === "release_to_borrower"
        ? "This will release the deposit back to the borrower. Are you sure?"
        : "This will dismiss the dispute with no Stripe action. Are you sure?"
    );
    if (!confirmed) return;

    setResolving(true);
    try {
      const res = await fetch("/api/admin/disputes/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispute_id: disputeId,
          outcome,
          resolution_notes: notes[disputeId] || "",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to resolve: ${err.error || "Unknown error"}`);
        return;
      }

      setSuccessId(disputeId);
      setTimeout(() => setSuccessId(null), 3000);
      setExpandedId(null);
      await fetchDisputes();
    } catch {
      alert("Network error — could not resolve dispute");
    } finally {
      setResolving(false);
    }
  };

  if (!authed) return null;

  const filtered =
    activeTab === "all"
      ? disputes
      : disputes.filter((d) => d.status === activeTab);

  const counts: Record<FilterTab, number> = {
    all: disputes.length,
    filed: disputes.filter((d) => d.status === "filed").length,
    under_review: disputes.filter((d) => d.status === "under_review").length,
    resolved: disputes.filter((d) => d.status === "resolved").length,
    dismissed: disputes.filter((d) => d.status === "dismissed").length,
  };

  return (
    <div className="min-h-screen bg-[#fdf9f5]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-[#e6e2de]/50 transition-all"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[#5b4038]" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <ShieldIcon className="w-6 h-6 text-[#ae3200]" />
              <h1 className="text-2xl font-semibold font-['Plus_Jakarta_Sans'] text-[#1c1b1a]">
                Dispute Resolution
              </h1>
            </div>
            <p className="text-sm text-[#5b4038] font-['Be_Vietnam_Pro'] mt-1 ml-[34px]">
              Founder admin panel — review and resolve disputes
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 p-1 bg-white rounded-xl border border-[#e6e2de]/50 mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-fit px-4 py-2 rounded-lg text-sm font-medium font-['Be_Vietnam_Pro'] transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-[#ae3200] text-white shadow-sm"
                  : "text-[#5b4038] hover:bg-[#fdf9f5]"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 text-xs ${
                  activeTab === tab.key ? "text-white/70" : "text-[#5b4038]/50"
                }`}
              >
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#ae3200] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div className="bg-white border border-[#e6e2de]/50 rounded-2xl p-12 text-center">
            <ShieldIcon className="w-12 h-12 text-[#e6e2de] mx-auto mb-3" />
            <p className="text-[#5b4038] font-['Be_Vietnam_Pro']">
              {activeTab === "all"
                ? "No disputes filed yet"
                : `No ${STATUS_LABELS[activeTab as DisputeStatus].toLowerCase()} disputes`}
            </p>
          </div>
        )}

        {/* Dispute Cards */}
        <div className="space-y-4">
          {filtered.map((dispute) => {
            const filer = profiles[dispute.filed_by];
            const target = profiles[dispute.filed_against];
            const item = items[dispute.item_id];
            const isExpanded = expandedId === dispute.id;
            const isResolved =
              dispute.status === "resolved" || dispute.status === "dismissed";
            const isSuccess = successId === dispute.id;

            return (
              <div
                key={dispute.id}
                className={`bg-white border rounded-2xl overflow-hidden transition-all ${
                  isSuccess
                    ? "border-[#065f46] ring-1 ring-[#065f46]/20"
                    : "border-[#e6e2de]/50"
                }`}
              >
                {/* Card Header */}
                <div className="p-5">
                  <div className="flex gap-4">
                    {/* Item Thumbnail */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#fdf9f5] border border-[#e6e2de] flex-shrink-0">
                      {item?.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PhotoIcon className="w-6 h-6 text-[#e6e2de]" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-[#1c1b1a] font-['Plus_Jakarta_Sans'] truncate">
                            {item?.title ?? "Unknown Item"}
                          </h3>
                          <p className="text-xs text-[#5b4038]/60 font-['Be_Vietnam_Pro'] mt-0.5">
                            {formatDate(dispute.created_at)} · Deposit:{" "}
                            {formatCents(item?.deposit_cents ?? 0)}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium font-['Be_Vietnam_Pro'] ${
                            STATUS_STYLES[dispute.status]
                          }`}
                        >
                          {STATUS_LABELS[dispute.status]}
                        </span>
                      </div>

                      {/* Parties */}
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-2">
                          <Avatar profile={filer} size={24} />
                          <div className="text-xs font-['Be_Vietnam_Pro']">
                            <span className="text-[#5b4038]/60">Filed by </span>
                            <span className="font-medium text-[#1c1b1a]">
                              {filer?.display_name ?? "Unknown"}
                            </span>
                            {filer?.unit_number && (
                              <span className="text-[#5b4038]/40">
                                {" "}
                                · Unit {filer.unit_number}
                              </span>
                            )}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-[#e6e2de] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                        <div className="flex items-center gap-2">
                          <Avatar profile={target} size={24} />
                          <div className="text-xs font-['Be_Vietnam_Pro']">
                            <span className="text-[#5b4038]/60">Against </span>
                            <span className="font-medium text-[#1c1b1a]">
                              {target?.display_name ?? "Unknown"}
                            </span>
                            {target?.unit_number && (
                              <span className="text-[#5b4038]/40">
                                {" "}
                                · Unit {target.unit_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reason + Description */}
                  <div className="mt-4 pl-20">
                    <div className="inline-block px-2 py-0.5 rounded bg-[#fdf9f5] text-xs font-medium text-[#5b4038] font-['Be_Vietnam_Pro'] mb-2">
                      {dispute.reason}
                    </div>
                    <p className="text-sm text-[#1c1b1a] font-['Be_Vietnam_Pro'] leading-relaxed">
                      {dispute.description}
                    </p>

                    {/* Dispute Photos */}
                    {dispute.dispute_photos &&
                      dispute.dispute_photos.length > 0 && (
                        <DisputePhotos photos={dispute.dispute_photos} />
                      )}

                    {/* Transaction Link */}
                    <p className="text-xs text-[#5b4038]/50 font-['Be_Vietnam_Pro'] mt-3">
                      Transaction:{" "}
                      <span className="font-mono text-[#5b4038]/70">
                        {dispute.transaction_id.slice(0, 8)}...
                      </span>
                    </p>

                    {/* Resolution info for already-resolved */}
                    {isResolved && dispute.resolution_notes && (
                      <div className="mt-3 p-3 rounded-xl bg-[#fdf9f5] border border-[#e6e2de]/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CheckCircleIcon className="w-3.5 h-3.5 text-[#526442]" />
                          <span className="text-xs font-medium text-[#526442] font-['Be_Vietnam_Pro']">
                            Resolution Notes
                          </span>
                        </div>
                        <p className="text-xs text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed">
                          {dispute.resolution_notes}
                        </p>
                        {dispute.resolved_at && (
                          <p className="text-[10px] text-[#5b4038]/40 font-['Be_Vietnam_Pro'] mt-1">
                            Resolved {formatDate(dispute.resolved_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expand Button (only for unresolved) */}
                  {!isResolved && (
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : dispute.id)
                      }
                      className="mt-4 ml-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-['Be_Vietnam_Pro'] text-[#ae3200] hover:bg-[#fdf0ea] transition-colors"
                    >
                      <ExclamationIcon className="w-3.5 h-3.5" />
                      {isExpanded ? "Cancel" : "Resolve Dispute"}
                      <ChevronIcon open={isExpanded} className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Resolve Panel */}
                {isExpanded && !isResolved && (
                  <div className="border-t border-[#e6e2de]/50 bg-[#fdf9f5] p-5">
                    <div className="ml-20 space-y-4">
                      {/* Outcome */}
                      <div>
                        <label className="block text-xs font-medium text-[#5b4038] font-['Be_Vietnam_Pro'] mb-1.5">
                          Outcome
                        </label>
                        <select
                          value={outcomes[dispute.id] || ""}
                          onChange={(e) =>
                            setOutcomes((prev) => ({
                              ...prev,
                              [dispute.id]: e.target.value as Outcome,
                            }))
                          }
                          className="w-full max-w-md px-3 py-2 rounded-xl border border-[#e6e2de] bg-white text-sm text-[#1c1b1a] font-['Be_Vietnam_Pro'] focus:outline-none focus:ring-2 focus:ring-[#ae3200]/20 focus:border-[#ae3200]"
                        >
                          <option value="">Select outcome...</option>
                          {OUTCOME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-xs font-medium text-[#5b4038] font-['Be_Vietnam_Pro'] mb-1.5">
                          Resolution Notes
                        </label>
                        <textarea
                          value={notes[dispute.id] || ""}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [dispute.id]: e.target.value,
                            }))
                          }
                          placeholder="Explain the reasoning for this decision..."
                          rows={3}
                          className="w-full max-w-md px-3 py-2 rounded-xl border border-[#e6e2de] bg-white text-sm text-[#1c1b1a] font-['Be_Vietnam_Pro'] placeholder:text-[#5b4038]/30 focus:outline-none focus:ring-2 focus:ring-[#ae3200]/20 focus:border-[#ae3200] resize-none"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleResolve(dispute.id)}
                          disabled={!outcomes[dispute.id] || resolving}
                          className="px-5 py-2 rounded-xl bg-[#ae3200] text-white text-sm font-medium font-['Be_Vietnam_Pro'] hover:bg-[#8a2800] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                          {resolving ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <CheckCircleIcon className="w-4 h-4" />
                          )}
                          {resolving ? "Resolving..." : "Resolve"}
                        </button>
                        <button
                          onClick={() => setExpandedId(null)}
                          className="px-4 py-2 rounded-xl text-sm text-[#5b4038] font-['Be_Vietnam_Pro'] hover:bg-white border border-[#e6e2de] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Toast */}
                {isSuccess && (
                  <div className="border-t border-[#065f46]/20 bg-[#d1fae5] px-5 py-3 flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-[#065f46]" />
                    <span className="text-sm font-medium text-[#065f46] font-['Be_Vietnam_Pro']">
                      Dispute resolved successfully
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
