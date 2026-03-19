"use client";

import { useState } from "react";
import VideoCapture from "@/components/transactions/VideoCapture";
import { createClient } from "@/lib/supabase/client";

interface PickupCardProps {
  transactionId: string;
  itemTitle: string;
  currentState: string;
  currentUserId: string;
  ownerId: string;
  borrowerId: string;
}

type CaptureMode = "none" | "photo" | "video";

export default function PickupCard({
  transactionId,
  itemTitle,
  currentState,
  currentUserId,
  ownerId,
  borrowerId,
}: PickupCardProps) {
  const [captureMode, setCaptureMode] = useState<CaptureMode>("none");
  const [photosCaptured, setPhotosCaptured] = useState(0);
  const [videoRecorded, setVideoRecorded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const isBorrower = currentUserId === borrowerId;
  const isOwner = currentUserId === ownerId;
  const role = isBorrower ? "borrower" : "owner";

  // Already picked up or past this state
  if (confirmed || !["deposit_held", "approved"].includes(currentState)) {
    if (currentState === "deposit_held" || currentState === "approved") {
      return null; // Still waiting
    }
    return null; // Past this state, PickupConfirmedCard handles picked_up
  }

  const handleTakePhoto = () => {
    setCaptureMode("photo");
  };

  const handleRecordVideo = () => {
    setCaptureMode("video");
  };

  const handlePhotoFrames = async (frames: string[]) => {
    if (frames.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const photoType = isBorrower ? "pickup_borrower" : "pickup_owner";

      for (let i = 0; i < frames.length; i++) {
        const response = await fetch(frames[i]);
        const blob = await response.blob();
        const filePath = `${transactionId}/${user.id}/pickup_${Date.now()}_${i}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("return-photos")
          .upload(filePath, blob, {
            contentType: "image/jpeg",
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;

        // Insert into transaction_photos
        const supabaseAdmin = createClient();
        await supabaseAdmin.from("transaction_photos").insert({
          transaction_id: transactionId,
          submitted_by: user.id,
          photo_url: filePath,
          photo_type: photoType,
          display_order: i,
          capture_method: "camera",
          captured_at: new Date().toISOString(),
          device_metadata: {
            captured_at: new Date().toISOString(),
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            camera_facing: "environment",
          },
        });
      }

      setPhotosCaptured((prev) => prev + frames.length);
      setCaptureMode("none");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photos");
    } finally {
      setUploading(false);
    }
  };

  const handleVideoBlob = async (blob: Blob) => {
    setUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Failed to read video"));
        reader.readAsDataURL(blob);
      });

      const res = await fetch(`/api/transactions/${transactionId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidence_type: "V1",
          video_base64: base64,
          duration_seconds: 10,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload video");
      }

      setVideoRecorded(true);
      setCaptureMode("none");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload video");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmPickup = async () => {
    setConfirming(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/transactions/${transactionId}/confirm-pickup`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to confirm pickup");
      }

      setConfirmed(true);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm pickup");
    } finally {
      setConfirming(false);
    }
  };

  // Capture mode: photo
  if (captureMode === "photo") {
    return (
      <div className="rounded-xl border border-inventory-200 bg-white p-3 max-w-[340px]">
        <p className="text-sm font-medium mb-2">Take pickup photos</p>
        {uploading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="ml-2 text-sm text-inventory-500">Uploading...</span>
          </div>
        ) : (
          <VideoCapture
            mode="upload"
            onFramesCaptured={handlePhotoFrames}
          />
        )}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <button
          onClick={() => setCaptureMode("none")}
          className="w-full mt-2 text-xs text-inventory-500 hover:text-inventory-700 transition-colors"
        >
          ← Back
        </button>
      </div>
    );
  }

  // Capture mode: video
  if (captureMode === "video") {
    return (
      <div className="rounded-xl border border-inventory-200 bg-white p-3 max-w-[340px]">
        <p className="text-sm font-medium mb-2">Record pickup video</p>
        {uploading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="ml-2 text-sm text-inventory-500">Uploading...</span>
          </div>
        ) : (
          <VideoCapture
            mode="V1"
            onFramesCaptured={() => {}}
            onVideoBlob={handleVideoBlob}
          />
        )}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <button
          onClick={() => setCaptureMode("none")}
          className="w-full mt-2 text-xs text-inventory-500 hover:text-inventory-700 transition-colors"
        >
          ← Back
        </button>
      </div>
    );
  }

  // Default: pickup card with options
  return (
    <div className="rounded-xl border border-inventory-200 bg-white p-3 max-w-[300px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">📦</span>
        </div>
        <div>
          <p className="text-sm font-medium leading-tight">{itemTitle}</p>
          <p className="text-xs text-inventory-400">
            {isBorrower ? "Picking up from owner" : "Handing off to borrower"}
          </p>
        </div>
      </div>

      <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 mb-3">
        <p className="text-[11px] text-blue-700 leading-relaxed">
          <span className="font-semibold">Protect yourself.</span> Take photos or video
          of the item now. This is your evidence if there&apos;s a dispute later.
        </p>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {/* Evidence status */}
      {(photosCaptured > 0 || videoRecorded) && (
        <div className="flex gap-2 mb-3">
          {photosCaptured > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 text-[10px] font-medium">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {photosCaptured} photo{photosCaptured !== 1 ? "s" : ""}
            </span>
          )}
          {videoRecorded && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 text-[10px] font-medium">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Video recorded
            </span>
          )}
        </div>
      )}

      {/* Capture buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleTakePhoto}
          className="flex-1 py-2 rounded-lg text-xs font-medium
                     bg-inventory-50 text-inventory-700 border border-inventory-200
                     hover:bg-inventory-100 transition-colors
                     flex items-center justify-center gap-1.5"
        >
          <span>📸</span> Take Photos
        </button>
        <button
          onClick={handleRecordVideo}
          className="flex-1 py-2 rounded-lg text-xs font-medium
                     bg-inventory-50 text-inventory-700 border border-inventory-200
                     hover:bg-inventory-100 transition-colors
                     flex items-center justify-center gap-1.5"
        >
          <span>🎥</span> Record Video
        </button>
      </div>

      {/* Confirm pickup */}
      <button
        onClick={handleConfirmPickup}
        disabled={confirming}
        className="w-full py-2.5 rounded-lg text-sm font-medium
                   bg-green-700 text-white
                   hover:bg-green-600 disabled:opacity-50 transition-colors
                   flex items-center justify-center gap-2"
      >
        {confirming ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-green-300/30 border-t-green-100 rounded-full animate-spin" />
            Confirming...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Confirm Item Picked Up
          </>
        )}
      </button>

      <p className="text-[10px] text-inventory-400 text-center mt-2">
        Photos and video are optional but strongly recommended.
      </p>
    </div>
  );
}
