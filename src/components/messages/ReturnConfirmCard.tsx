"use client";

import { useState, useEffect } from "react";
import VideoCapture from "@/components/transactions/VideoCapture";
import DisputeFileForm from "@/components/disputes/DisputeFileForm";

interface ReturnConfirmCardProps {
  transactionId: string;
  itemTitle: string;
  returnPhotoCount: number;
  borrowerName: string;
  currentState: string;
  isOwner: boolean;
  inspectionDeadline?: string | null;
}

function useCountdown(deadline: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    function update() {
      const ms = new Date(deadline!).getTime() - Date.now();
      if (ms <= 0) {
        setTimeLeft("0h 0m");
        setExpired(true);
        return;
      }
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      setTimeLeft(`${hours}h ${minutes}m`);
      setExpired(false);
    }

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  return { timeLeft, expired };
}

export default function ReturnConfirmCard({
  transactionId,
  itemTitle,
  returnPhotoCount,
  borrowerName,
  currentState,
  isOwner,
  inspectionDeadline: initialDeadline,
}: ReturnConfirmCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"receipt" | "inspect" | "v3_capture" | "dispute_form" | "done">("receipt");
  const [v3Uploaded, setV3Uploaded] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(initialDeadline ?? null);

  const { timeLeft, expired } = useCountdown(deadline);

  // Self-fetch inspection_deadline if not provided as prop
  // (MessageBubble doesn't pass it, so we fetch from the transaction)
  useEffect(() => {
    if (initialDeadline || currentState !== "return_submitted") return;

    async function fetchDeadline() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase
          .from("transactions")
          .select("inspection_deadline")
          .eq("id", transactionId)
          .single();
        if (data?.inspection_deadline) {
          setDeadline(data.inspection_deadline);
        }
      } catch {
        // Non-critical — countdown just won't show
      }
    }
    fetchDeadline();
  }, [transactionId, initialDeadline, currentState]);

  // Determine initial phase from state + deadline
  useEffect(() => {
    if (currentState === "completed" || currentState === "disputed") {
      setPhase("done");
    } else if (deadline) {
      setPhase("inspect");
    } else {
      setPhase("receipt");
    }
  }, [currentState, deadline]);

  // ── Phase: Done ──
  if (phase === "done" || currentState === "completed") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-3 max-w-[300px]">
        <p className="text-xs font-medium text-green-800">
          Transaction complete — deposit released.
        </p>
      </div>
    );
  }

  if (currentState === "disputed") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 max-w-[300px]">
        <p className="text-xs font-medium text-amber-800">
          Dispute filed — under review.
        </p>
      </div>
    );
  }

  if (currentState !== "return_submitted") {
    return null;
  }

  // ── Borrower view (all phases) ──
  if (!isOwner) {
    return (
      <div className="rounded-xl border border-border/40 bg-white p-3 max-w-[300px]">
        <p className="text-xs text-inventory-500">
          {deadline
            ? `Owner is inspecting the item. Deposit auto-releases in ${timeLeft}.`
            : "Waiting for the owner to confirm they received the item..."}
        </p>
      </div>
    );
  }

  // ── Owner: Phase 1 — Confirm receipt ──
  if (phase === "receipt") {
    const handleConfirmReceipt = async () => {
      setLoading("receipt");
      setError(null);
      try {
        const res = await fetch(
          `/api/transactions/${transactionId}/confirm-return`,
          { method: "POST" }
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Something went wrong");
        }
        const data = await res.json();
        if (data.inspection_deadline) {
          setDeadline(data.inspection_deadline);
        }
        setPhase("inspect");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to confirm return");
      } finally {
        setLoading(null);
      }
    };

    return (
      <div className="rounded-xl border border-inventory-200 bg-white p-3 max-w-[300px]">
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

        <p className="text-[11px] text-inventory-400 mb-3 leading-relaxed">
          Confirm you&#39;ve received the item back. You&#39;ll have 24 hours to inspect
          it and report any damage before the deposit is released.
        </p>

        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

        <button
          onClick={handleConfirmReceipt}
          disabled={loading === "receipt"}
          className="w-full py-2 rounded-lg text-sm font-medium
                     bg-teal-800 text-teal-50
                     hover:bg-teal-700 disabled:opacity-50 transition-colors
                     flex items-center justify-center gap-2"
        >
          {loading === "receipt" ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-teal-300/30 border-t-teal-100 rounded-full animate-spin" />
              Confirming...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" />
              </svg>
              I received the item
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Owner: Phase 2 — Inspect: two decision buttons + countdown ──
  if (phase === "inspect") {
    const handleItemGood = async () => {
      setLoading("good");
      setError(null);
      try {
        const res = await fetch(
          `/api/transactions/${transactionId}/complete`,
          { method: "POST" }
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Something went wrong");
        }
        setPhase("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to release deposit");
      } finally {
        setLoading(null);
      }
    };

    const handleReportDamage = () => {
      setPhase("v3_capture");
    };

    if (expired) {
      return (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 max-w-[300px]">
          <p className="text-xs font-medium text-green-800">
            Inspection window closed — deposit released.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-inventory-200 bg-white p-3 max-w-[300px]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🔍</span>
          </div>
          <div>
            <p className="text-sm font-medium leading-tight">{itemTitle}</p>
            <p className="text-xs text-inventory-400">Inspect your item</p>
          </div>
        </div>

        <p className="text-[11px] text-inventory-400 mb-3 leading-relaxed">
          You&#39;ve confirmed receiving the item. Inspect it and choose an option below.
        </p>

        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

        {/* Item looks good */}
        <button
          onClick={handleItemGood}
          disabled={loading === "good"}
          className="w-full py-2.5 rounded-lg text-sm font-medium mb-2
                     bg-green-700 text-green-50
                     hover:bg-green-600 disabled:opacity-50 transition-colors
                     flex items-center justify-center gap-2"
        >
          {loading === "good" ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-green-300/30 border-t-green-100 rounded-full animate-spin" />
              Releasing deposit...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" />
              </svg>
              Item looks good — release deposit
            </>
          )}
        </button>

        {/* Report damage */}
        <button
          onClick={handleReportDamage}
          disabled={!!loading}
          className="w-full py-2.5 rounded-lg text-sm font-medium
                     bg-red-50 text-red-700 border border-red-200
                     hover:bg-red-100 disabled:opacity-50 transition-colors
                     flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
          Report damage — hold deposit
        </button>

        {/* Countdown */}
        <p className="text-[10px] text-inventory-400 text-center mt-2">
          Deposit auto-releases in {timeLeft} if no action taken.
        </p>
      </div>
    );
  }

  // ── Owner: Phase 3 — V3 video capture ──
  if (phase === "v3_capture") {
    const handleV3Blob = async (blob: Blob) => {
      setLoading("v3");
      setError(null);
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = () => reject(new Error("Failed to read video"));
          reader.readAsDataURL(blob);
        });

        const res = await fetch(
          `/api/transactions/${transactionId}/evidence`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              evidence_type: "V3",
              video_base64: base64,
              duration_seconds: 10,
            }),
          }
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to upload inspection video");
        }

        setV3Uploaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setLoading(null);
      }
    };

    const handleFileDispute = () => {
      setPhase("dispute_form");
    };

    const handleBackToInspect = () => {
      setPhase("inspect");
      setV3Uploaded(false);
    };

    return (
      <div className="rounded-xl border border-inventory-200 bg-white p-3 max-w-[340px]">
        {!v3Uploaded ? (
          <>
            <p className="text-sm font-medium mb-1">Record inspection video</p>
            <p className="text-[11px] text-inventory-400 mb-3 leading-relaxed">
              Record a video showing the damage. This is your evidence.
            </p>

            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

            {loading === "v3" ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <span className="ml-2 text-sm text-inventory-500">Uploading...</span>
              </div>
            ) : (
              <VideoCapture
                mode="V3"
                onFramesCaptured={() => {}}
                onVideoBlob={handleV3Blob}
              />
            )}

            <button
              onClick={handleBackToInspect}
              className="w-full mt-2 text-xs text-inventory-500 hover:text-inventory-700 transition-colors"
            >
              ← Back to inspection options
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-green-800">Inspection video recorded</p>
            </div>

            <p className="text-[11px] text-inventory-400 mb-3 leading-relaxed">
              Your inspection video has been saved. You can now file a dispute.
            </p>

            <button
              onClick={handleFileDispute}
              className="w-full py-2.5 rounded-lg text-sm font-medium mb-2
                         bg-red-600 text-white
                         hover:bg-red-700 transition-colors
                         flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
              </svg>
              File a Dispute
            </button>

            <button
              onClick={handleBackToInspect}
              className="w-full py-2 text-xs text-inventory-500 hover:text-inventory-700 transition-colors"
            >
              Actually, item looks fine — go back
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Owner: Phase 4 — Inline dispute form ──
  if (phase === "dispute_form") {
    return (
      <div className="max-w-[340px]">
        <DisputeFileForm
          transactionId={transactionId}
          hasV3={true}
          onDisputeFiled={() => {
            setPhase("done");
            window.location.reload();
          }}
          onCancel={() => setPhase("inspect")}
        />
      </div>
    );
  }

  return null;
}
