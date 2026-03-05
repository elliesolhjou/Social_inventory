"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import VideoCapture from "@/components/upload/VideoCapture";
import ItemReviewForm, {
  type ItemFormData,
} from "@/components/upload/ItemReviewForm";
import { createClient } from "@/lib/supabase/client";

type Step = "capture" | "analyzing" | "review" | "success";

export default function MagicUpload() {
  const [step, setStep] = useState<Step>("capture");
  const [frames, setFrames] = useState<string[]>([]);
  const [itemData, setItemData] = useState<ItemFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // Step 1 → 2: Frames captured, send to VisionAgent
  const handleFramesCaptured = useCallback(async (capturedFrames: string[]) => {
    setFrames(capturedFrames);
    setStep("analyzing");
    setError(null);
    setAnalysisProgress(0);

    // Simulate progress while waiting for API
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const response = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: capturedFrames }),
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Vision analysis failed");
      }

      const result = await response.json();

      // Small delay so 100% progress is visible
      await new Promise((r) => setTimeout(r, 400));

      setItemData(result.item);
      setStep("review");
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error("Vision analysis error:", err);
      setError(err.message || "Failed to analyze item. Please try again.");
      setStep("capture");
    }
  }, []);

  // Step 3: Publish item to Supabase
  const handlePublish = useCallback(
    async (formData: ItemFormData) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const supabase = createClient();

        // TODO: In production, get owner_id from auth session
        // For dev, pick a random profile
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .limit(20);

        const randomOwner =
          profiles?.[Math.floor(Math.random() * (profiles?.length ?? 1))];

        if (!randomOwner) {
          throw new Error("No profiles found. Run the seed script first.");
        }

        // Get building ID
        const { data: building } = await supabase
          .from("buildings")
          .select("id")
          .single();

        const { data: newItem, error: insertError } = await supabase
          .from("items")
          .insert({
            title: formData.title,
            description: formData.description,
            ai_description: formData.ai_description,
            category: formData.category,
            subcategory: formData.subcategory,
            condition: formData.condition,
            deposit_cents: formData.suggested_deposit_cents,
            max_borrow_days: formData.max_borrow_days,
            rules: formData.rules,
            status: "available",
            times_borrowed: 0,
            owner_id: randomOwner.id,
            building_id: building?.id,
            metadata: {
              brand: formData.brand,
              model: formData.model,
              color: formData.color,
              year: formData.year,
              original_price_cents: formData.original_price_cents,
            },
            // vision_signature would be stored here as an embedding in production
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        // Log agent action
        await supabase
          .from("agent_logs")
          .insert({
            agent: "VisionAgent",
            action: "magic_upload",
            payload: {
              item_id: newItem?.id,
              confidence: formData.confidence,
              frames_analyzed: frames.length,
            },
            building_id: building?.id,
          })
          .then(() => {}); // fire and forget

        setCreatedItemId(newItem?.id ?? null);
        setStep("success");
      } catch (err: any) {
        console.error("Publish error:", err);
        setError(err.message || "Failed to publish item. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [frames],
  );

  // Go back to capture
  const handleRetake = useCallback(() => {
    setFrames([]);
    setItemData(null);
    setError(null);
    setStep("capture");
  }, []);

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
            Magic Upload
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 pt-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {["Capture", "Analyze", "Review"].map((label, i) => {
            const stepIndex =
              step === "capture"
                ? 0
                : step === "analyzing"
                  ? 1
                  : step === "review" || step === "success"
                    ? 2
                    : 0;
            const isActive = i === stepIndex;
            const isDone = i < stepIndex;

            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isActive
                      ? "bg-accent text-white scale-110"
                      : isDone
                        ? "bg-accent/20 text-accent"
                        : "bg-inventory-100 text-inventory-400"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    isActive
                      ? "text-accent"
                      : isDone
                        ? "text-accent/60"
                        : "text-inventory-400"
                  }`}
                >
                  {label}
                </span>
                {i < 2 && (
                  <div
                    className={`flex-1 h-0.5 rounded-full ${isDone ? "bg-accent/30" : "bg-inventory-100"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
            <svg
              className="w-5 h-5 mt-0.5 flex-shrink-0"
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
            <p>{error}</p>
          </div>
        )}

        {/* STEP 1: Capture */}
        {step === "capture" && (
          <div className="animate-slide-up">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-bold mb-1">
                Record your item
              </h2>
              <p className="text-inventory-500 text-sm">
                Hold your camera steady and slowly rotate the item. 5 seconds is
                all we need.
              </p>
            </div>
            <VideoCapture onFramesCaptured={handleFramesCaptured} />
          </div>
        )}

        {/* STEP 2: Analyzing */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-20 animate-slide-up">
            <div className="relative w-24 h-24 mb-8">
              {/* Spinning ring */}
              <div className="absolute inset-0 rounded-full border-4 border-inventory-100" />
              <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
              {/* Center icon */}
              <div className="absolute inset-3 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-2xl">🔍</span>
              </div>
            </div>

            <h2 className="font-display text-xl font-bold mb-2">
              VisionAgent analyzing...
            </h2>
            <p className="text-inventory-500 text-sm mb-8 text-center max-w-xs">
              Identifying item, assessing condition, writing description, and
              suggesting pricing
            </p>

            {/* Progress bar */}
            <div className="w-full max-w-xs">
              <div className="h-2 rounded-full bg-inventory-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(analysisProgress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-inventory-400">
                <span>
                  {analysisProgress < 30
                    ? "Extracting frames..."
                    : analysisProgress < 60
                      ? "Identifying item..."
                      : analysisProgress < 90
                        ? "Assessing condition..."
                        : "Finalizing..."}
                </span>
                <span className="font-mono">
                  {Math.min(Math.round(analysisProgress), 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Review */}
        {step === "review" && itemData && (
          <div className="animate-slide-up">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-bold mb-1">
                Review & publish
              </h2>
              <p className="text-inventory-500 text-sm">
                Our AI filled everything in. Edit anything that needs tweaking,
                then publish to your building.
              </p>
            </div>
            <ItemReviewForm
              data={itemData}
              onSubmit={handlePublish}
              onBack={handleRetake}
              isSubmitting={isSubmitting}
            />
          </div>
        )}

        {/* SUCCESS */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-20 animate-slide-up text-center">
            <div className="w-20 h-20 rounded-full bg-trust-high/10 flex items-center justify-center mb-6">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">Published!</h2>
            <p className="text-inventory-500 mb-8 max-w-sm">
              Your item is now live in your building&apos;s inventory. Neighbors
              can start borrowing it right away.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              {createdItemId && (
                <Link
                  href={`/item/${createdItemId}`}
                  className="flex-1 py-3.5 bg-inventory-950 text-white rounded-2xl font-display font-semibold text-sm text-center hover:bg-inventory-800 transition-colors"
                >
                  View Item →
                </Link>
              )}
              <button
                onClick={handleRetake}
                className="flex-1 py-3.5 border-2 border-inventory-200 text-inventory-600 rounded-2xl font-display font-semibold text-sm hover:border-inventory-400 transition-colors"
              >
                Upload Another
              </button>
              <Link
                href="/dashboard"
                className="flex-1 py-3.5 border-2 border-inventory-200 text-inventory-600 rounded-2xl font-display font-semibold text-sm text-center hover:border-inventory-400 transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
