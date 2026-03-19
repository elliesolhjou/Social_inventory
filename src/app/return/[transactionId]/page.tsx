"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReturnCapture, {
  type CapturedPhoto,
} from "@/components/upload/ReturnCapture";
import { createClient } from "@/lib/supabase/client";

type Step = "loading" | "capture" | "submitting" | "success" | "error";

interface TransactionInfo {
  id: string;
  item_id: string;
  owner_id: string;
  borrower_id: string;
  state: string;
  item: {
    title: string;
    ai_condition: string;
    category: string;
  };
}

export default function ReturnPage() {
  const params = useParams();
  const router = useRouter();
  const transactionId = params.transactionId as string;

  const [step, setStep] = useState<Step>("loading");
  const [transaction, setTransaction] = useState<TransactionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const supabase = createClient();

  // ── Load transaction details ──────────────────────────────────────────────

  useEffect(() => {
    async function loadTransaction() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/auth");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("transactions")
          .select(
            `
            id, item_id, owner_id, borrower_id, state,
            items:item_id ( title, ai_condition, category )
          `
          )
          .eq("id", transactionId)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Transaction not found.");

        // Must be the borrower
        if (data.borrower_id !== user.id) {
          setError("Only the borrower can submit return photos.");
          setStep("error");
          return;
        }

        // Must be in picked_up state
        if (data.state !== "picked_up") {
          setError(
            `This transaction is currently "${data.state}" and cannot accept return photos.`
          );
          setStep("error");
          return;
        }

        // Flatten the joined item data
        const item = Array.isArray(data.items) ? data.items[0] : data.items;
        setTransaction({
          id: data.id,
          item_id: data.item_id,
          owner_id: data.owner_id,
          borrower_id: data.borrower_id,
          state: data.state,
          item: {
            title: item?.title ?? "Unknown item",
            ai_condition: item?.ai_condition ?? "good",
            category: item?.category ?? "other",
          },
        });
        setStep("capture");
      } catch (err: any) {
        console.error("Failed to load transaction:", err);
        setError(err.message || "Failed to load transaction.");
        setStep("error");
      }
    }

    loadTransaction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  // ── Handle approved photos → upload to storage, then call API route ───────

  const handlePhotosApproved = useCallback(
    async (photos: CapturedPhoto[]) => {
      if (!transaction) return;
      setStep("submitting");
      setUploadProgress(0);
      setError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in.");

        // Step 1: Upload photos to Supabase Storage
        const photoUrls: string[] = [];

        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          setUploadProgress(((i + 1) / (photos.length + 1)) * 70);

          // Convert data URL to blob
          const response = await fetch(photo.dataUrl);
          const blob = await response.blob();

          const filePath = `${transaction.id}/${user.id}/return_${Date.now()}_${i}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("return-photos")
            .upload(filePath, blob, {
              contentType: "image/jpeg",
              cacheControl: "3600",
            });

          if (uploadError) throw uploadError;

          // Store the path (private bucket)
          photoUrls.push(filePath);
        }

        setUploadProgress(75);

        // Step 2: Call the submit-return API route
        // This handles: transaction_photos insert, damage_assessments creation,
        // state transition, state log, and owner notification
        const res = await fetch(
          `/api/transactions/${transaction.id}/submit-return`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo_urls: photoUrls, photo_metadata: photos.map((p) => p.deviceMetadata) }),
          }
        );

        setUploadProgress(90);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to submit return");
        }

        setUploadProgress(100);
        await new Promise((r) => setTimeout(r, 400));
        setStep("success");
      } catch (err: any) {
        console.error("Return submission failed:", err);
        setError(err.message || "Failed to submit return photos.");
        setStep("capture"); // let them retry
      }
    },
    [transaction, supabase]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-inventory-200/50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-inventory-500 hover:text-inventory-900 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </Link>
          <h1 className="font-display text-lg font-bold tracking-tight">
            Return Item
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 pt-6">
        {/* Error state */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
                />
              </svg>
            </div>
            <p className="text-inventory-600 text-sm mb-6">{error}</p>
            <Link
              href="/dashboard"
              className="py-3 px-8 bg-accent text-white rounded-2xl font-display font-semibold text-sm"
            >
              Back to Dashboard
            </Link>
          </div>
        )}

        {/* Loading */}
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-3 border-inventory-200 border-t-accent rounded-full animate-spin mb-4" />
            <p className="text-inventory-500 text-sm">
              Loading transaction...
            </p>
          </div>
        )}

        {/* Capture step */}
        {step === "capture" && transaction && (
          <div className="animate-slide-up">
            {/* Item context */}
            <div className="mb-6 p-4 rounded-2xl bg-inventory-50 border border-inventory-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <span className="text-lg">📦</span>
                </div>
                <div>
                  <p className="font-display font-bold text-sm">
                    {transaction.item.title}
                  </p>
                  <p className="text-inventory-400 text-xs">
                    Condition at listing:{" "}
                    <span className="font-medium text-inventory-600">
                      {transaction.item.ai_condition}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Camera-only notice */}
            <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-blue-50 border border-blue-100 mb-6">
              <span className="text-blue-500 text-sm mt-0.5">📸</span>
              <p className="text-blue-700 text-xs leading-relaxed">
                <span className="font-semibold">Camera only.</span> Return
                photos must be taken right now to verify the item&#39;s condition at
                time of return. Gallery uploads are not allowed.
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
                <span className="text-red-500 text-xs mt-0.5">⚠</span>
                <p className="text-red-600 text-xs leading-relaxed">{error}</p>
              </div>
            )}

            <ReturnCapture onPhotosApproved={handlePhotosApproved} />
          </div>
        )}

        {/* Submitting */}
        {step === "submitting" && (
          <div className="flex flex-col items-center justify-center py-20 animate-slide-up">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-inventory-100" />
              <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
              <div className="absolute inset-3 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-2xl">📤</span>
              </div>
            </div>
            <h2 className="font-display text-xl font-bold mb-2">
              Submitting return photos...
            </h2>
            <p className="text-inventory-500 text-sm mb-8 text-center max-w-xs">
              Uploading photos and notifying the owner to inspect the item.
            </p>
            <div className="w-full max-w-xs">
              <div className="h-2 rounded-full bg-inventory-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-inventory-400">
                <span>
                  {uploadProgress < 70
                    ? "Uploading photos..."
                    : uploadProgress < 90
                      ? "Processing return..."
                      : "Finalizing..."}
                </span>
                <span className="font-mono">
                  {Math.min(Math.round(uploadProgress), 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {step === "success" && transaction && (
          <div className="flex flex-col items-center justify-center py-20 animate-slide-up text-center">
            <div className="w-20 h-20 rounded-full bg-trust-high/10 flex items-center justify-center mb-6">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">
              Return submitted!
            </h2>
            <p className="text-inventory-500 mb-3 max-w-sm">
              Your return photos for{" "}
              <strong>{transaction.item.title}</strong> have been submitted.
            </p>
            <div className="px-4 py-3 rounded-2xl bg-inventory-50 border border-inventory-100 mb-8 max-w-sm">
              <p className="text-inventory-600 text-sm">
                The owner has{" "}
                <strong className="text-inventory-900">24 hours</strong> to
                inspect the item and submit their own photos. If they don&#39;t
                respond, your deposit will be automatically released.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              <Link
                href="/dashboard"
                className="flex-1 py-3.5 bg-inventory-950 text-white rounded-2xl font-display font-semibold text-sm text-center hover:bg-inventory-800 transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
