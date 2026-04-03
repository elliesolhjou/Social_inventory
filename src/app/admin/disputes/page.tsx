"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DisputeEvidenceViewer from "@/components/disputes/DisputeEvidenceViewer";
import DisputeResolveForm from "@/components/disputes/DisputeResolveForm";
import AIDamageResult from "@/components/disputes/AIDamageResult";

interface Dispute {
  id: string;
  transaction_id: string;
  filed_by: string;
  state: string;
  reason: string;
  description: string | null;
  resolution_notes: string | null;
  deposit_captured_cents: number;
  fraud_flags: string[];
  condition_checklist_snapshot: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
}

interface Evidence {
  id: string;
  evidence_type: "V1" | "V2" | "V3";
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  extracted_frames: unknown[] | null;
  ai_damage_report: Record<string, unknown> | null;
  captured_at: string;
}

interface Transaction {
  id: string;
  item_id: string;
  owner_id: string;
  borrower_id: string;
  state: string;
  payment_intent_id: string | null;
}

interface Item {
  id: string;
  title: string;
  deposit_cents: number;
  condition_checklist_json: Record<string, unknown> | null;
}

interface Profile {
  id: string;
  display_name: string;
  dispute_history_json: Record<string, unknown> | null;
}

interface Photo {
  id: string;
  photo_type: string;
  photo_url: string;
  full_url: string;
  submitted_by: string;
  display_order: number;
  captured_at: string;
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [disputeDetails, setDisputeDetails] = useState<{
    dispute: Dispute;
    transaction: Transaction;
    item: Item;
    evidence: Evidence[];
    photos: Photo[];
    profiles: Profile[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolved, setResolved] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function fetchDisputes() {
      const { data } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });

      setDisputes(data ?? []);
      setLoading(false);
    }
    fetchDisputes();
  }, [resolved]);

  async function loadDisputeDetail(disputeId: string) {
    setDetailLoading(true);
    setSelectedDispute(disputeId);
    setResolved(false);

    try {
      const res = await fetch(`/api/disputes/${disputeId}`);
      const data = await res.json();
      if (res.ok) {
        setDisputeDetails(data);
      }
    } catch {
      // Handle error
    } finally {
      setDetailLoading(false);
    }
  }

  function handleResolved() {
    setResolved(true);
    setSelectedDispute(null);
    setDisputeDetails(null);
  }

  const stateColors: Record<string, string> = {
    filed: "bg-amber-100 text-amber-800",
    under_review: "bg-blue-100 text-blue-800",
    resolved_owner: "bg-red-100 text-red-800",
    resolved_borrower: "bg-green-100 text-green-800",
    dismissed: "bg-gray-100 text-gray-600",
  };

  if (loading) {
    return (
      <main className="min-h-screen p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dispute Center</h1>
        <p className="text-inventory-500">Loading disputes...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Dispute Center</h1>
      <p className="text-inventory-500 text-sm mb-6">
        Review disputes, watch evidence videos, and resolve.
      </p>

      {disputes.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl">🎉</span>
          <p className="text-inventory-500 mt-4">No disputes filed. Everything's good!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {disputes.map((d) => (
            <div
              key={d.id}
              className={`rounded-xl border p-4 cursor-pointer transition-colors hover:border-accent/50 ${
                selectedDispute === d.id ? "border-accent bg-accent/5" : "border-inventory-200"
              }`}
              onClick={() => loadDisputeDetail(d.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${stateColors[d.state] ?? "bg-gray-100 text-gray-600"}`}>
                  {d.state.replace(/_/g, " ").toUpperCase()}
                </span>
                <span className="text-xs text-inventory-400">
                  {new Date(d.created_at).toLocaleString()}
                </span>
              </div>

              <p className="text-sm font-medium">{d.reason}</p>
              {d.description && (
                <p className="text-xs text-inventory-500 mt-1">{d.description}</p>
              )}

              {d.fraud_flags && d.fraud_flags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {d.fraud_flags.map((flag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-medium">
                      ⚠ {flag}
                    </span>
                  ))}
                </div>
              )}

              {d.resolved_at && (
                <p className="text-xs text-inventory-400 mt-2">
                  Resolved {new Date(d.resolved_at).toLocaleString()}
                  {d.deposit_captured_cents > 0 && ` — $${(d.deposit_captured_cents / 100).toFixed(2)} captured`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedDispute && (
        <div className="mt-8 space-y-6">
          <hr className="border-inventory-200" />

          {detailLoading ? (
            <p className="text-inventory-500">Loading dispute details...</p>
          ) : disputeDetails ? (
            <>
              {/* Parties */}
              <div className="grid grid-cols-2 gap-4">
                {disputeDetails.profiles.map((p) => {
                  const isOwner = p.id === disputeDetails.transaction.owner_id;
                  return (
                    <div key={p.id} className="rounded-xl border border-inventory-200 p-3">
                      <p className="text-xs text-inventory-400">{isOwner ? "Owner (filed dispute)" : "Borrower"}</p>
                      <p className="text-sm font-medium">{p.display_name}</p>
                      {p.dispute_history_json && (
                        <p className="text-[10px] text-inventory-400 mt-1">
                          {isOwner
                            ? `Denied disputes: ${(p.dispute_history_json as Record<string, number>).denied_disputes_as_owner ?? 0}`
                            : `Confirmed damages: ${(p.dispute_history_json as Record<string, number>).confirmed_damages_as_borrower ?? 0}`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Item info */}
              <div className="rounded-xl border border-inventory-200 p-4">
                <p className="text-xs text-inventory-400">Item</p>
                <p className="text-sm font-medium">{disputeDetails.item?.title ?? "Unknown"}</p>
                <p className="text-xs text-inventory-500 mt-1">
                  Deposit: ${((disputeDetails.item?.deposit_cents ?? 0) / 100).toFixed(2)}
                </p>
              </div>

              {/* Evidence viewer (videos) */}
              <DisputeEvidenceViewer
                evidence={disputeDetails.evidence}
                conditionChecklist={disputeDetails.dispute.condition_checklist_snapshot as any}
              />

              {/* Transaction Photos (return + baseline) */}
              {disputeDetails.photos && disputeDetails.photos.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-display font-bold text-lg text-inventory-900">
                    Photos
                  </h3>

                  {/* Return photos (borrower) */}
                  {(() => {
                    const returnPhotos = disputeDetails.photos.filter((p) => p.photo_type === "return");
                    const baselinePhotos = disputeDetails.photos.filter((p) => p.photo_type === "listing_baseline");
                    const borrowerName = disputeDetails.profiles.find((p) => p.id === disputeDetails.transaction.borrower_id)?.display_name ?? "Borrower";
                    const ownerName = disputeDetails.profiles.find((p) => p.id === disputeDetails.transaction.owner_id)?.display_name ?? "Owner";

                    return (
                      <>
                        {returnPhotos.length > 0 && (
                          <div className="rounded-2xl border border-inventory-200 overflow-hidden">
                            <div className="px-4 py-3 bg-blue-50 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-blue-900">Return Photos</p>
                                <p className="text-xs text-blue-600">Submitted by {borrowerName} at return</p>
                              </div>
                              <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium">
                                {returnPhotos.length} photo{returnPhotos.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="p-3 grid grid-cols-2 gap-2">
                              {returnPhotos.map((photo) => (
                                <a key={photo.id} href={photo.full_url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={photo.full_url}
                                    alt={`Return photo ${photo.display_order + 1}`}
                                    className="w-full aspect-square object-cover rounded-xl hover:opacity-80 transition-opacity cursor-zoom-in"
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {baselinePhotos.length > 0 && (
                          <div className="rounded-2xl border border-inventory-200 overflow-hidden">
                            <div className="px-4 py-3 bg-amber-50 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-amber-900">Listing Baseline Photos</p>
                                <p className="text-xs text-amber-600">Item condition at time of listing by {ownerName}</p>
                              </div>
                              <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-medium">
                                {baselinePhotos.length} photo{baselinePhotos.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="p-3 grid grid-cols-2 gap-2">
                              {baselinePhotos.map((photo) => (
                                <a key={photo.id} href={photo.full_url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={photo.full_url}
                                    alt={`Baseline photo ${photo.display_order + 1}`}
                                    className="w-full aspect-square object-cover rounded-xl hover:opacity-80 transition-opacity cursor-zoom-in"
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* AI Damage Analysis */}
              {["filed", "under_review"].includes(disputeDetails.dispute.state) && (
                <AIDamageResult
                  transactionId={disputeDetails.transaction.id}
                  existingAssessment={
                    disputeDetails.evidence.find((e) => e.evidence_type === "V3")
                      ? ((disputeDetails.evidence.find((e) => e.evidence_type === "V3") as any)?.ai_damage_report ?? null)
                      : null
                  }
                />
              )}

              {/* Resolve form (only for unresolved disputes) */}
              {["filed", "under_review"].includes(disputeDetails.dispute.state) && (
                <DisputeResolveForm
                  disputeId={disputeDetails.dispute.id}
                  depositCents={disputeDetails.item?.deposit_cents ?? 0}
                  onResolved={handleResolved}
                />
              )}
            </>
          ) : (
            <p className="text-red-600 text-sm">Failed to load dispute details.</p>
          )}
        </div>
      )}
    </main>
  );
}
