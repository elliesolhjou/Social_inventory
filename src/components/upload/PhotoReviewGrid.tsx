"use client";

import { useState, useRef, useCallback } from "react";

const MAX_PHOTOS = 10;

interface PhotoReviewGridProps {
  /** Current frames (base64 data URLs) */
  frames: string[];
  /** Updated frames array after add/delete */
  onFramesChange: (frames: string[]) => void;
  /** User approved the photos — send to vision agent */
  onContinue: () => void;
  /** Go back to capture step (preserves frames) */
  onAddFromCamera: () => void;
  /** Go all the way back / discard */
  onBack: () => void;
}

export default function PhotoReviewGrid({
  frames,
  onFramesChange,
  onContinue,
  onAddFromCamera,
  onBack,
}: PhotoReviewGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const remainingSlots = MAX_PHOTOS - frames.length;

  // ── Remove a single photo ──────────────────────────────────────
  const removePhoto = useCallback(
    (index: number) => {
      setDeletingId(index);
      // Small delay for exit animation
      setTimeout(() => {
        onFramesChange(frames.filter((_, i) => i !== index));
        setDeletingId(null);
      }, 200);
    },
    [frames, onFramesChange],
  );

  // ── Add photos from file upload ────────────────────────────────
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newFrames: string[] = [];

      for (const file of Array.from(files).slice(0, remainingSlots)) {
        if (file.type.startsWith("image/")) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newFrames.push(dataUrl);
        } else if (file.type.startsWith("video/")) {
          // Extract first frame from video
          const video = document.createElement("video");
          video.src = URL.createObjectURL(file);
          video.muted = true;

          await new Promise<void>((resolve) => {
            video.onloadedmetadata = () => {
              video.currentTime = 0;
              resolve();
            };
          });

          await new Promise<void>((resolve) => {
            video.onseeked = () => {
              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d")!;
              ctx.drawImage(video, 0, 0);
              newFrames.push(canvas.toDataURL("image/jpeg", 0.85));
              URL.revokeObjectURL(video.src);
              resolve();
            };
          });
        }
      }

      if (newFrames.length > 0) {
        onFramesChange([...frames, ...newFrames].slice(0, MAX_PHOTOS));
      }

      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [frames, remainingSlots, onFramesChange],
  );

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-bold mb-1">
          Review your photos
        </h2>
        <p className="text-inventory-500 text-sm">
          {frames.length === 0
            ? "Add up to 10 photos of your item. More angles = better AI results."
            : `${frames.length} of ${MAX_PHOTOS} photos. Add more angles or remove any you don't like.`}
        </p>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Filled slots */}
        {frames.map((frame, index) => (
          <div
            key={`frame-${index}-${frame.slice(-20)}`}
            className={`relative aspect-square rounded-2xl overflow-hidden bg-inventory-100 group transition-all duration-200 ${
              deletingId === index ? "opacity-0 scale-90" : "opacity-100 scale-100"
            }`}
          >
            <img
              src={frame}
              alt={`Photo ${index + 1}`}
              className="w-full h-full object-cover"
            />

            {/* Photo number badge */}
            <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs font-mono font-bold flex items-center justify-center">
              {index + 1}
            </span>

            {/* Delete button */}
            <button
              onClick={() => removePhoto(index)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full 
                         bg-black/60 text-white flex items-center justify-center
                         opacity-0 group-hover:opacity-100 transition-opacity
                         active:opacity-100 sm:hover:bg-red-500/80"
              aria-label={`Remove photo ${index + 1}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          </div>
        ))}

        {/* Empty placeholder slots */}
        {Array.from({ length: remainingSlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="aspect-square rounded-2xl border-2 border-dashed border-inventory-200 
                       flex items-center justify-center text-inventory-300"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        ))}
      </div>

      {/* Add More Buttons */}
      {remainingSlots > 0 && (
        <div className="flex gap-3">
          {/* Camera */}
          <button
            onClick={onAddFromCamera}
            className="flex-1 py-3 flex items-center justify-center gap-2 
                       border-2 border-inventory-200 text-inventory-600 rounded-2xl 
                       font-display font-semibold text-sm hover:border-inventory-400 
                       transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Camera
          </button>

          {/* Upload */}
          <label className="flex-1 py-3 flex items-center justify-center gap-2 
                            border-2 border-inventory-200 text-inventory-600 rounded-2xl 
                            font-display font-semibold text-sm hover:border-inventory-400 
                            transition-colors cursor-pointer">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Upload
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3.5 border-2 border-inventory-200 text-inventory-600 rounded-2xl 
                     font-display font-semibold text-sm hover:border-inventory-400 transition-colors"
        >
          ← Start Over
        </button>
        <button
          onClick={onContinue}
          disabled={frames.length === 0}
          className={`flex-[2] py-3.5 rounded-2xl font-display font-semibold text-lg transition-all ${
            frames.length === 0
              ? "bg-inventory-200 text-inventory-400 cursor-not-allowed"
              : "bg-inventory-950 text-white hover:bg-inventory-800 active:scale-[0.98]"
          }`}
        >
          Continue with {frames.length} photo{frames.length !== 1 ? "s" : ""} →
        </button>
      </div>
    </div>
  );
}
