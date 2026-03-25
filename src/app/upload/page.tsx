"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import VideoCapture from "@/components/upload/VideoCapture";
import ItemReviewForm, {
  type ItemFormData,
} from "@/components/upload/ItemReviewForm";
import UserMenu from "@/components/UserMenu";
import { createClient } from "@/lib/supabase/client";

type Step = "capture" | "preview" | "analyzing" | "review" | "success";

export default function MagicUpload() {
  const [step, setStep] = useState<Step>("capture");
  const [frames, setFrames] = useState<string[]>([]);
  const [userPhotos, setUserPhotos] = useState<string[]>([]); // Only user-taken/uploaded photos, not video frames
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [itemData, setItemData] = useState<ItemFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [buildingName, setBuildingName] = useState("your building");

  // Fetch building name on mount
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("building_id").eq("id", user.id).single();
        if (profile?.building_id) {
          const { data: building } = await supabase.from("buildings").select("name").eq("id", profile.building_id).single();
          if (building) setBuildingName(building.name);
        }
      }
    })();
  }, []);

  // Step 1 → 2: Frames captured, go to PREVIEW
  const handleFramesCaptured = useCallback((capturedFrames: string[], capturedVideoUrl?: string) => {
    if (capturedVideoUrl) {
      setVideoUrl(capturedVideoUrl);
      setVideoFrames(capturedFrames); // internal only — for AI analysis
    } else {
      // These are user photos — visible to user
      setFrames((prev) => [...prev, ...capturedFrames]);
      setUserPhotos((prev) => [...prev, ...capturedFrames]);
    }
    setError(null);
    setStep("preview");
  }, []);

  // Preview: remove a photo
  const removeFrame = useCallback((index: number) => {
    setFrames((prev) => prev.filter((_, i) => i !== index));
    setUserPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Preview: add more photos via file input
  const handleAddMorePhotos = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newVideoFrames: string[] = [];
    const newUserPhotos: string[] = [];
    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      if (file.type.startsWith("video/")) {
        // Video uploads: extract frames for AI only, create object URL for preview
        const videoEl = document.createElement("video");
        videoEl.src = URL.createObjectURL(file);
        videoEl.muted = true;
        await new Promise<void>((resolve) => {
          videoEl.onloadedmetadata = () => { videoEl.currentTime = 0; resolve(); };
        });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const duration = Math.min(videoEl.duration, 10);
        const frameCount = 3;
        const interval = duration / frameCount;
        for (let i = 0; i < frameCount; i++) {
          videoEl.currentTime = i * interval;
          await new Promise<void>((resolve) => {
            videoEl.onseeked = () => {
              canvas.width = videoEl.videoWidth;
              canvas.height = videoEl.videoHeight;
              ctx.drawImage(videoEl, 0, 0);
              newVideoFrames.push(canvas.toDataURL("image/jpeg", 0.85));
              resolve();
            };
          });
        }
        // Set as video URL for preview
        setVideoUrl(videoEl.src);
      } else {
        // Image uploads: visible to user AND used by AI
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newUserPhotos.push(dataUrl);
      }
    }
    e.target.value = "";
    if (newVideoFrames.length > 0) {
      setVideoFrames((prev) => [...prev, ...newVideoFrames]);
    }
    if (newUserPhotos.length > 0) {
      setFrames((prev) => [...prev, ...newUserPhotos]);
      setUserPhotos((prev) => [...prev, ...newUserPhotos]);
    }
  }, []);

  // Step 2 → 3: User confirms photos, send to VisionAgent
  const handleAnalyze = useCallback(async () => {
    const allFrames = [...frames, ...videoFrames]; // combine user photos + video frames for AI
    if (allFrames.length === 0) return;
    setStep("analyzing");
    setError(null);
    setAnalysisProgress(0);

    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) { clearInterval(progressInterval); return 90; }
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const response = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: allFrames }),
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (!response.ok) {
        const err = await response.json();
        if (response.status === 403 && err.prohibited) {
          throw new Error(err.prohibited_reason || "This item is not permitted on Proxe.");
        }
        throw new Error(err.error || "Vision analysis failed");
      }

      const result = await response.json();
      await new Promise((r) => setTimeout(r, 400));
      setItemData(result.item);
      setStep("review");
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error("Vision analysis error:", err);
      setError(err.message || "Failed to analyze item. Please try again.");
      setStep("preview");
    }
  }, [frames, videoFrames]);

  // ── Helper: upload base64 frame to Supabase Storage ─────────────────────
  async function uploadFrameToStorage(
    supabase: ReturnType<typeof createClient>,
    itemId: string,
    frame: string,
    index: number,
  ): Promise<string | null> {
    try {
      const base64Data = frame.replace(/^data:image\/\w+;base64,/, "");
      const byteArray = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const blob = new Blob([byteArray], { type: "image/jpeg" });
      const filePath = `${itemId}/${index}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(filePath, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) { console.error(`Failed to upload frame ${index}:`, uploadError); return null; }
      const { data } = supabase.storage.from("item-images").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error(`Frame ${index} upload error:`, err);
      return null;
    }
  }

  // Step 4: Publish item to Supabase
  const handlePublish = useCallback(
    async (formData: ItemFormData) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("You must be signed in to list an item.");
        const { data: profile } = await supabase.from("profiles").select("building_id").eq("id", user.id).single();
        if (!profile?.building_id) throw new Error("No building associated with your profile.");

        const { data: newItem, error: insertError } = await supabase
          .from("items")
          .insert({
            owner_id: user.id,
            building_id: profile.building_id,
            title: formData.title,
            description: formData.description || null,
            ai_description: formData.ai_description || null,
            category: formData.category,
            subcategory: formData.subcategory || null,
            ai_condition: formData.ai_condition,
            deposit_cents: formData.deposit_cents,
            max_borrow_days: formData.max_borrow_days,
            rules: formData.rules || null,
            metadata: formData.metadata || {},
            status: "available",
            borrow_available: formData.borrow_available ?? true,
            rent_available: formData.rent_available ?? false,
            sell_available: formData.sell_available ?? false,
            rent_price_day_cents: formData.rent_price_day_cents || null,
            rent_price_month_cents: formData.rent_price_month_cents || null,
            sell_price_cents: formData.sell_price_cents || null,
            estimated_market_value_cents: formData.estimated_market_value_cents || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Upload user photos, or first video frame as fallback for thumbnail
        const imagesToUpload = frames.length > 0 ? frames : videoFrames.slice(0, 1);
        if (newItem?.id && imagesToUpload.length > 0) {
          const uploadPromises = imagesToUpload.slice(0, 5).map((frame, i) => uploadFrameToStorage(supabase, newItem.id, frame, i));
          const uploadedUrls = await Promise.all(uploadPromises);
          const urls = uploadedUrls.filter(Boolean) as string[];
          if (urls.length > 0) {
            const { error: updateError } = await supabase.from("items").update({ thumbnail_url: urls[0], media_urls: urls }).eq("id", newItem.id);
            if (updateError) console.error("Failed to save image URLs:", updateError);
          }
        }

        const embedFrame = frames[0] || videoFrames[0];
        if (newItem?.id && embedFrame) {
          fetch(`/api/items/${newItem.id}/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ frame: embedFrame }),
          }).catch((err) => console.error("Embedding generation failed (non-blocking):", err));
        }

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

  const handleRetake = useCallback(() => {
    setFrames([]);
    setUserPhotos([]);
    setVideoFrames([]);
    setItemData(null);
    setError(null);
    setVideoUrl(null);
    setStep("capture");
  }, []);

  return (
    <main className="min-h-screen pb-20 bg-[#fdf9f5] text-[#1c1b1a] font-['Be_Vietnam_Pro']">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#f7f3ef]">
        <nav className="flex justify-between items-center w-full px-4 sm:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-6 sm:gap-8">
            <Link href="/" className="text-2xl font-black text-[#ae3200] font-['Plus_Jakarta_Sans'] tracking-tight hidden sm:block">Proxe</Link>
            <div className="hidden md:flex gap-6 items-center">
              <Link href="/dashboard" className="text-[#5b4038] font-medium hover:text-[#ff5a1f] transition-colors font-['Plus_Jakarta_Sans']">Dashboard</Link>
              <Link href="/profile/me" className="text-[#ae3200] border-b-2 border-[#ae3200] pb-1 font-bold font-['Plus_Jakarta_Sans']">My Items</Link>
              <Link href="/inbox" className="text-[#5b4038] font-medium hover:text-[#ff5a1f] transition-colors font-['Plus_Jakarta_Sans']">Inbox</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/notifications" className="p-2 rounded-full hover:bg-[#ebe7e4] transition-colors">
              <svg className="w-5 h-5 text-[#5b4038]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </Link>
            <UserMenu />
          </div>
        </nav>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        {/* ── Editorial Header ── */}
        <div className="mb-10">
          <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#ae3200] tracking-[0.2em] uppercase text-xs mb-2">Magic Upload</p>
          <h1 className="font-['Plus_Jakarta_Sans'] font-extrabold text-4xl sm:text-5xl text-[#1c1b1a] tracking-tight leading-tight">
            Share something <br /><span className="text-[#ff5a1f]">with the building.</span>
          </h1>
        </div>

        {/* ── 4-Step Indicator ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-8">
          {["Capture", "Preview", "Analyze", "Review"].map((label, i) => {
            const stepIndex =
              step === "capture" ? 0
                : step === "preview" ? 1
                  : step === "analyzing" ? 2
                    : step === "review" || step === "success" ? 3
                      : 0;
            const isActive = i === stepIndex;
            const isDone = i < stepIndex;

            return (
              <div key={label} className="flex items-center gap-1.5 sm:gap-2 flex-1">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all font-['Plus_Jakarta_Sans'] flex-shrink-0 ${
                    isActive
                      ? "bg-[#ae3200] text-white scale-110"
                      : isDone
                        ? "bg-[#ae3200]/20 text-[#ae3200]"
                        : "bg-[#ebe7e4] text-[#8f7067]"
                  }`}
                >
                  {isDone ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`text-[10px] sm:text-xs font-medium hidden sm:block font-['Plus_Jakarta_Sans'] ${
                  isActive ? "text-[#ae3200]" : isDone ? "text-[#ae3200]/60" : "text-[#8f7067]"
                }`}>
                  {label}
                </span>
                {i < 3 && (
                  <div className={`flex-1 h-0.5 rounded-full ${isDone ? "bg-[#ae3200]/30" : "bg-[#ebe7e4]"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Error display ── */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-start gap-3 font-['Be_Vietnam_Pro']">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
            <p>{error}</p>
          </div>
        )}

        {/* ── STEP 1: Capture ── */}
        {step === "capture" && (
          <div className="animate-slide-up">
            <div className="mb-6">
              <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold mb-1 text-[#1c1b1a]">
                Capture your item
              </h2>
              <p className="text-[#5b4038] text-sm font-['Be_Vietnam_Pro']">
                Take photos or record a short video. You can review and edit before submitting.
              </p>
            </div>
            <VideoCapture onFramesCaptured={handleFramesCaptured} />
          </div>
        )}

        {/* ── STEP 2: Preview Photos ── */}
        {step === "preview" && (
          <div className="animate-slide-up">
            <div className="mb-6">
              <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold mb-1 text-[#1c1b1a]">
                Review your {videoUrl && userPhotos.length > 0 ? "video & photos" : videoUrl ? "video" : "photos"}
              </h2>
              <p className="text-[#5b4038] text-sm font-['Be_Vietnam_Pro']">
                {videoUrl && userPhotos.length > 0
                  ? "Your video and photos are ready. You can add more or remove any you don't want."
                  : videoUrl
                    ? "Your recorded video is ready. You can also add photos."
                    : "Make sure the photos are clear. Remove any you don't want, or add more."}
              </p>
            </div>

            {userPhotos.length === 0 && !videoUrl ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-[#ebe7e4] flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-[#8f7067]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                </div>
                <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] mb-1">No photos yet</p>
                <p className="text-sm text-[#8f7067] mb-4 font-['Be_Vietnam_Pro']">Go back and capture some photos first.</p>
                <button onClick={handleRetake}
                  className="px-6 py-3 bg-[#ae3200] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:brightness-110 transition-all">
                  Back to Capture
                </button>
              </div>
            ) : (
              <>
                {/* Video player if exists */}
                {videoUrl && (
                  <div className="mb-4 rounded-2xl overflow-hidden border border-[#e6e2de]/50 shadow-sm">
                    <video src={videoUrl} controls playsInline className="w-full" style={{ maxHeight: "450px" }} />
                  </div>
                )}

                {/* Photo grid — only user-uploaded photos, not video frames */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  {userPhotos.map((frame, i) => (
                    <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden border border-[#e6e2de]/50 shadow-sm">
                      <img src={frame} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeFrame(i)}
                        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                        title="Remove photo"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <span className="absolute bottom-2.5 left-2.5 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-['Plus_Jakarta_Sans']">
                        {i + 1}
                      </span>
                    </div>
                  ))}
                  {/* Camera tile */}
                  <button
                    onClick={() => setStep("capture")}
                    className="aspect-square rounded-2xl border-2 border-dashed border-[#8f7067]/30 flex flex-col items-center justify-center gap-2 hover:border-[#ae3200]/50 hover:bg-[#ae3200]/5 transition-all"
                  >
                    <svg className="w-8 h-8 text-[#8f7067]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                    </svg>
                    <span className="text-xs text-[#8f7067] font-['Plus_Jakarta_Sans'] font-bold">Camera</span>
                  </button>
                  {/* Upload tile */}
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-[#8f7067]/30 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#ae3200]/50 hover:bg-[#ae3200]/5 transition-all">
                    <svg className="w-8 h-8 text-[#8f7067]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="text-xs text-[#8f7067] font-['Plus_Jakarta_Sans'] font-bold">Upload</span>
                    <input type="file" accept="image/*,video/*" multiple onChange={handleAddMorePhotos} className="hidden" />
                  </label>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button onClick={handleRetake}
                    className="flex-1 py-3.5 border border-[#e6e2de] text-[#5b4038] rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:border-[#ae3200]/30 transition-colors flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                    Start Over
                  </button>
                  <button onClick={handleAnalyze}
                    className="flex-[2] py-3.5 bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2">
                    {videoUrl && userPhotos.length > 0
                      ? `Analyze Video + ${userPhotos.length} Photo${userPhotos.length !== 1 ? "s" : ""} with Proxie`
                      : videoUrl
                        ? "Analyze Video with Proxie"
                        : `Analyze ${userPhotos.length} Photo${userPhotos.length !== 1 ? "s" : ""} with Proxie`}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Analyzing ── */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-20 animate-slide-up">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-[#ebe7e4]" />
              <div className="absolute inset-0 rounded-full border-4 border-[#526442] border-t-transparent animate-spin" />
              <div className="absolute inset-3 rounded-full bg-[#d2e6bc]/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#526442]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
              </div>
            </div>
            <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold mb-2 text-[#1c1b1a]">
              Proxie is identifying your item...
            </h2>
            <p className="text-[#5b4038] text-sm mb-8 text-center max-w-xs font-['Be_Vietnam_Pro']">
              Analyzing brand and condition, writing description, and suggesting pricing
            </p>
            <div className="w-full max-w-xs">
              <div className="h-2 rounded-full bg-[#ebe7e4] overflow-hidden">
                <div className="h-full rounded-full bg-[#526442] transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(analysisProgress, 100)}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">
                <span>
                  {analysisProgress < 30 ? "Extracting frames..." : analysisProgress < 60 ? "Identifying item..." : analysisProgress < 90 ? "Assessing condition..." : "Finalizing..."}
                </span>
                <span className="font-mono">{Math.min(Math.round(analysisProgress), 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Review Form ── */}
        {step === "review" && itemData && (
          <div className="animate-slide-up">
            <div className="mb-6">
              <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold mb-1 text-[#1c1b1a]">
                Review & publish
              </h2>
              <p className="text-[#5b4038] text-sm font-['Be_Vietnam_Pro']">
                Proxie filled everything in. Edit anything that needs tweaking, then publish to your building.
              </p>
            </div>
            <ItemReviewForm
              data={itemData}
              onSubmit={handlePublish}
              onBack={handleRetake}
              onBackToPreview={() => setStep("preview")}
              isSubmitting={isSubmitting}
              frames={userPhotos}
              buildingName={buildingName}
              videoUrl={videoUrl ?? undefined}
            />
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-20 animate-slide-up text-center">
            <div className="w-20 h-20 rounded-full bg-[#d2e6bc]/30 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-[#526442]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold mb-2 text-[#1c1b1a]">Published!</h2>
            <p className="text-[#5b4038] mb-8 max-w-sm font-['Be_Vietnam_Pro']">
              Your item is now live in <strong>{buildingName}</strong>. Neighbors can start borrowing it right away.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              {createdItemId && (
                <Link href={`/item/${createdItemId}`}
                  className="flex-1 py-3.5 bg-[#1c1b1a] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm text-center hover:bg-[#31302e] transition-colors">
                  View Item
                </Link>
              )}
              <button onClick={handleRetake}
                className="flex-1 py-3.5 border border-[#e6e2de] text-[#5b4038] rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:border-[#ae3200]/30 transition-colors">
                Upload Another
              </button>
              <Link href="/dashboard"
                className="flex-1 py-3.5 border border-[#e6e2de] text-[#5b4038] rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm text-center hover:border-[#ae3200]/30 transition-colors">
                Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
