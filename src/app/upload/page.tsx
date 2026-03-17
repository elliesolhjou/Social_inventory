"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import VideoCapture from "@/components/upload/VideoCapture";
import ItemReviewForm, {
  type ItemFormData,
} from "@/components/upload/ItemReviewForm";
import ProhibitedItemsModal from "@/components/ProhibitedItemsModal";
import { createClient } from "@/lib/supabase/client";

type Step = "capture" | "preview" | "analyzing" | "review" | "success";

// ── Prohibited item detection ─────────────────────────────────────────────────
const PROHIBITED_KEYWORDS = [
  // Sexual or pornographic materials — checked first
  "porn","pornographic","pornography","adult magazine","playboy","penthouse",
  "hustler","adult dvd","adult video","sex toy","vibrator","dildo",
  "nude magazine","nudity","explicit","erotic","xxx","adult content",
  // Child safety — absolute top priority
  "csam","child pornography","child exploitation","minor nude",
  // Weapons
  "gun","handgun","pistol","firearm","rifle","shotgun","revolver","glock",
  "weapon","ammunition","ammo","bullet","explosive","grenade","bomb",
  "dagger","sword","taser","stun gun","brass knuckles",
  // Drugs
  "drug","cocaine","heroin","meth","cannabis","marijuana","weed","bong",
  "paraphernalia",
  // Other prohibited
  "car seat","child seat","baby seat","biohazard",
  "firework","pyrotechnic","hazmat","fuel tank","gas tank",
];

function isProhibited(item: ItemFormData): string | null {
  const haystack = [
    item.title ?? "",
    item.subcategory ?? "",
    item.description ?? "",
    item.ai_description ?? "",
  ].join(" ").toLowerCase();
  for (const kw of PROHIBITED_KEYWORDS) {
    if (haystack.includes(kw)) return kw;
  }
  return null;
}

export default function MagicUpload() {
  const [step, setStep] = useState<Step>("capture");
  const [frames, setFrames] = useState<string[]>([]);
  const [itemData, setItemData] = useState<ItemFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [liabilityChecked, setLiabilityChecked] = useState(false);
  const [showProhibited, setShowProhibited] = useState(false);
  const [prohibitedDetected, setProhibitedDetected] = useState(false);
  const [pendingFrames, setPendingFrames] = useState<string[]>([]);
  const [showAddMoreOptions, setShowAddMoreOptions] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const addMediaInputRef = useRef<HTMLInputElement>(null);
  const addCameraInputRef = useRef<HTMLInputElement>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleFramesCaptured = useCallback(async (capturedFrames: string[]) => {
    // Go to preview first so user can review/add more media
    setPendingFrames((prev) => {
      const combined = [...prev, ...capturedFrames].slice(0, 10);
      return combined;
    });
    setStep("preview");
  }, []);

  const runAnalysis = useCallback(async (framesToAnalyse: string[]) => {
    setFrames(framesToAnalyse);
    setStep("analyzing");
    setError(null);
    setAnalysisProgress(0);

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
        body: JSON.stringify({ frames: framesToAnalyse }),
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Vision analysis failed");
      }

      const result = await response.json();
      await new Promise((r) => setTimeout(r, 400));

      // ── Layer 1: VisionAgent server-side prohibited check (403 response) ──
      if (response.status === 403 || result.prohibited === true) {
        setProhibitedDetected(true);
        setError(result.prohibited_reason ?? "This item is not permitted on Proxe.");
        setStep("capture");
        return;
      }

      // ── Layer 2: Client-side keyword check (safety net) ───────────────────
      const flagged = isProhibited(result.item);
      if (flagged) {
        setProhibitedDetected(true);
        setError(`This item cannot be listed on Proxe. Our system detected it may be a prohibited item. Please review our prohibited items policy.`);
        setStep("capture");
        return;
      }

      setProhibitedDetected(false);
      setItemData(result.item);
      setStep("review");
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || "Failed to analyze item. Please try again.");
      setStep("capture");
    }
  }, []);

  const handlePublish = useCallback(
    async (formData: ItemFormData) => {
      if (!liabilityChecked) {
        setError("Please confirm the item policy before publishing.");
        return;
      }
      setIsSubmitting(true);
      setError(null);

      try {
        const supabase = createClient();

        // ── FIX: use real logged-in user ──────────────────────────────────────
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("You must be signed in to publish an item.");

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
            ai_category: formData.category,
            ai_condition: formData.condition,
            category: formData.category,
            subcategory: formData.subcategory,
            deposit_cents: formData.suggested_deposit_cents,
            max_borrow_days: formData.max_borrow_days,
            rules: formData.rules,
            status: "available",
            times_borrowed: 0,
            owner_id: user.id,
            building_id: building?.id,
            liability_acknowledged_at: new Date().toISOString(),
            metadata: {
              brand: formData.brand,
              model: formData.model,
              color: formData.color,
              year: formData.year,
              original_price_cents: formData.original_price_cents,
            },
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

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
          .then(() => {});

        setCreatedItemId(newItem?.id ?? null);
        setStep("success");
      } catch (err: any) {
        setError(err.message || "Failed to publish item. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [frames, liabilityChecked],
  );

  const handleRetake = useCallback(() => {
    setFrames([]);
    setPendingFrames([]);
    setItemData(null);
    setError(null);
    setLiabilityChecked(false);
    setProhibitedDetected(false);
    setStep("capture");
  }, []);

  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).slice(0, 10);
      e.target.value = "";
      const newFrames: string[] = [];
      for (const file of files) {
        const dataUri = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
        newFrames.push(dataUri);
      }
      if (newFrames.length > 0) {
        setPendingFrames((prev) => [...prev, ...newFrames].slice(0, 10));
        setStep("preview");
      }
    },
    [],
  );

  return (
    <main className="min-h-screen pb-20">
      <header className="sticky top-0 z-50 glass border-b border-inventory-200/50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => {
              if (step === "review") { setStep("capture"); setItemData(null); }
              else if (step === "preview") { setStep("capture"); /* keep pendingFrames so new captures append */ }
              else if (step === "analyzing") { /* can't go back mid-analysis */ }
              else { window.location.href = "/dashboard"; }
            }}
            className="flex items-center gap-2 text-inventory-500 hover:text-inventory-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="font-display text-lg font-bold tracking-tight">
            Magic Upload
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 pt-6">
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
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isActive ? "bg-accent text-white scale-110" : isDone ? "bg-accent/20 text-accent" : "bg-inventory-100 text-inventory-400"}`}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${isActive ? "text-accent" : isDone ? "text-accent/60" : "text-inventory-400"}`}
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

        {error && !prohibitedDetected && (
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

        {/* ── Prohibited item blocked screen ── */}
        {prohibitedDetected && (
          <div className="mb-6 rounded-3xl overflow-hidden border-2 border-red-200">
            <div className="bg-red-600 px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <p className="font-display font-bold text-white text-base">Item Not Permitted</p>
                <p className="text-red-100 text-xs mt-0.5">Proxe cannot list this item</p>
              </div>
            </div>
            <div className="bg-red-50 px-6 py-5 space-y-4">
              <p className="text-sm text-red-800 leading-relaxed font-medium">{error}</p>
              <p className="text-sm text-red-700 leading-relaxed">
                Proxe only allows items a neighbor could pick up and use safely without special training.
                Weapons, hazardous materials, and other prohibited items cannot be listed under any circumstances.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setShowProhibited(true)}
                  className="flex-1 py-3 rounded-2xl border-2 border-red-300 text-red-700 font-display font-semibold text-sm hover:bg-red-100 transition-colors"
                >
                  View Prohibited Items
                </button>
                <button
                  onClick={() => {
                    setProhibitedDetected(false);
                    setError(null);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-display font-semibold text-sm hover:bg-red-700 transition-colors"
                >
                  Upload a Different Item
                </button>
              </div>
            </div>
          </div>
        )}

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

            {/* ── Pre-upload acknowledgment ── */}
            <div className={"mb-5 rounded-2xl p-5 border-2 transition-colors " + (liabilityChecked ? "border-green-300 bg-green-50/40" : "border-inventory-200 bg-white")}>
              <p className="text-xs font-bold text-inventory-400 uppercase tracking-widest mb-3">
                Before you upload
              </p>
              <label className="flex items-start gap-3 cursor-pointer mb-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div
                    onClick={() => setLiabilityChecked(!liabilityChecked)}
                    className={"w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all " + (liabilityChecked ? "bg-accent border-accent" : "border-inventory-300 hover:border-accent")}
                  >
                    {liabilityChecked && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-sm text-inventory-700 leading-relaxed">
                  I confirm that the item I am about to upload is safe for a neighbor to use, is not a
                  prohibited item, and that I am solely responsible for its condition and safety.
                  Proxe does not inspect, guarantee, or assume liability for items shared through
                  the platform.{" "}
                  <button
                    onClick={(e) => { e.preventDefault(); setShowProhibited(true); }}
                    className="text-accent font-semibold underline hover:no-underline"
                  >
                    See Prohibited Items
                  </button>
                </p>
              </label>
              {!liabilityChecked && (
                <p className="text-xs text-inventory-400 ml-8">
                  You must confirm this before recording or uploading.
                </p>
              )}
            </div>

            <div className={liabilityChecked ? "" : "opacity-50 pointer-events-none"}>
              <VideoCapture onFramesCaptured={handleFramesCaptured} />

              {/* ── Take a photo with camera ── */}
              <div className="flex items-center gap-3 mt-4">
                <div className="flex-1 h-px bg-inventory-200" />
                <span className="text-xs text-inventory-400 font-medium">or take a photo</span>
                <div className="flex-1 h-px bg-inventory-200" />
              </div>
              {/* capture="environment" opens rear camera on mobile, file picker on desktop */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <button
                onClick={() => photoInputRef.current?.click()}
                className="mt-3 w-full py-3.5 rounded-2xl border-2 border-inventory-300 hover:border-accent text-inventory-600 hover:text-accent font-display font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {/* On mobile: opens camera. On desktop: opens file picker — both feed VisionAgent */}
                {typeof window !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
                  ? "Take a Photo"
                  : "Upload a Photo"}
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="animate-slide-up space-y-5">
            <div>
              <h2 className="font-display text-2xl font-bold mb-1">Review your media</h2>
              <p className="text-inventory-500 text-sm">
                {pendingFrames.length}/10 photos or videos captured. Add more or proceed to analysis.
              </p>
            </div>

            {/* Media grid */}
            <div className="grid grid-cols-3 gap-2">
              {pendingFrames.map((frame, i) => (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-inventory-100">
                  <img src={frame} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPendingFrames((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 text-xs bg-accent text-white px-1.5 py-0.5 rounded-full font-bold">Main</span>
                  )}
                </div>
              ))}

              {/* Add more button */}
              {pendingFrames.length < 10 && (
                <div className="relative">
                  {/* Hidden inputs */}
                  <input
                    ref={addMediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <input
                    ref={addCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />

                  {/* Add more tile */}
                  <button
                    onClick={() => setShowAddMenu((v) => !v)}
                    className="w-full aspect-square rounded-2xl border-2 border-dashed border-inventory-300 hover:border-accent flex flex-col items-center justify-center gap-1 text-inventory-400 hover:text-accent transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs font-medium">Add more</span>
                  </button>

                  {/* Mini action sheet */}
                  {showAddMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                      <div className="absolute bottom-full mb-2 left-0 z-50 w-44 bg-white rounded-2xl shadow-xl border border-inventory-100 overflow-hidden">
                        <button
                          onClick={() => { setShowAddMenu(false); addCameraInputRef.current?.click(); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-inventory-50 transition-colors text-sm font-medium text-inventory-800"
                        >
                          <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Take a Photo
                        </button>
                        <div className="h-px bg-inventory-100" />
                        <button
                          onClick={() => { setShowAddMenu(false); addMediaInputRef.current?.click(); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-inventory-50 transition-colors text-sm font-medium text-inventory-800"
                        >
                          <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Upload from Library
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setPendingFrames([]); setStep("capture"); }}
                className="flex-1 py-3.5 rounded-2xl border-2 border-inventory-200 text-inventory-600 font-display font-semibold text-sm hover:border-inventory-400 transition-colors"
              >
                Retake All
              </button>
              <button
                onClick={() => runAnalysis(pendingFrames)}
                disabled={pendingFrames.length === 0}
                className="flex-1 py-3.5 rounded-2xl bg-accent text-white font-display font-bold text-sm hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Analyse with VisionAgent
              </button>
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-20 animate-slide-up">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-inventory-100" />
              <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
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

            {/* ── 1A: Eligibility Banner ── */}
            <div className="bg-blue-50 border-l-4 border-blue-400 rounded-2xl px-5 py-4 mb-5">
              <p className="font-display font-bold text-blue-800 text-sm mb-1">
                What can I list?
              </p>
              <p className="text-sm text-blue-700 leading-relaxed">
                Only list items a neighbor could pick up and use safely without
                any special training. You are responsible for the condition and
                safety of items you list.{" "}
                <button
                  onClick={() => setShowProhibited(true)}
                  className="font-bold underline hover:no-underline transition-all"
                >
                  See Prohibited Items
                </button>
              </p>
            </div>

            {/* ── 1C: High-Value Warning (conditional — fires when AI detects value > $500) ── */}
            {(itemData.original_price_cents ?? 0) > 50000 && (
              <div className="bg-amber-50 border-l-4 border-amber-400 rounded-2xl px-5 py-4 mb-5">
                <p className="font-display font-bold text-amber-800 text-sm mb-1">
                  ⚠️ High-Value Item
                </p>
                <p className="text-sm text-amber-700 leading-relaxed">
                  Items estimated above $500 require a higher deposit hold. You
                  may set a custom deposit amount on the next screen. Proxe's
                  deposit hold system protects you, but does not guarantee full
                  replacement value.
                </p>
              </div>
            )}

            <ItemReviewForm
              data={itemData}
              onSubmit={handlePublish}
              onBack={handleRetake}
              isSubmitting={isSubmitting}
            />


          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-20 animate-slide-up text-center">
            <div className="w-20 h-20 rounded-full bg-trust-high/10 flex items-center justify-center mb-6">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">Published!</h2>
            <p className="text-inventory-500 mb-8 max-w-sm">
              Your item is now live in your building's inventory. Neighbors can
              start borrowing it right away.
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

      {/* Add More Options Sheet */}
      {showAddMoreOptions && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowAddMoreOptions(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-8">
            <div className="max-w-lg mx-auto bg-white rounded-3xl overflow-hidden shadow-2xl">
              <div className="px-6 pt-5 pb-3 border-b border-inventory-100">
                <p className="font-display font-bold text-base">Add more media</p>
                <p className="text-xs text-inventory-400 mt-0.5">{10 - pendingFrames.length} slots remaining</p>
              </div>
              <div className="p-4 space-y-3">
                {/* Use Camera option — goes back to capture step */}
                <button
                  onClick={() => {
                    setShowAddMoreOptions(false);
                    setStep("capture");
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-inventory-200 hover:border-accent transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-display font-semibold text-sm text-inventory-900">Use Camera</p>
                    <p className="text-xs text-inventory-400">Record video or take a photo</p>
                  </div>
                </button>
                {/* Upload from library */}
                <button
                  onClick={() => {
                    setShowAddMoreOptions(false);
                    addMediaInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-inventory-200 hover:border-accent transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-inventory-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-inventory-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-display font-semibold text-sm text-inventory-900">Upload from Library</p>
                    <p className="text-xs text-inventory-400">Choose photos or videos from your device</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowAddMoreOptions(false)}
                  className="w-full py-3 text-sm text-inventory-400 hover:text-inventory-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Prohibited Items Modal */}
      {showProhibited && (
        <ProhibitedItemsModal onClose={() => setShowProhibited(false)} />
      )}
    </main>
  );
}
