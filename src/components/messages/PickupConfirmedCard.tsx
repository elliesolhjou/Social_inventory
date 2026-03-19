"use client";

import { useState } from "react";
import VideoCapture from "@/components/transactions/VideoCapture";

interface PickupConfirmedCardProps {
  message: string;
  transactionId: string;
  isBorrower: boolean;
}

export default function PickupConfirmedCard({
  message,
  transactionId,
  isBorrower,
}: PickupConfirmedCardProps) {
  const [showCapture, setShowCapture] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error(data.error || "Failed to upload");
      }

      setUploaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Owner sees success + video prompt
  if (!isBorrower) {
    if (uploaded) {
      return (
        <div className="flex flex-col items-center mb-2 gap-2">
          <div className="max-w-[90%] px-3 py-1.5 rounded-lg text-xs text-center border bg-green-50 text-green-700 border-green-200">
            {message}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-green-50 text-green-700 border border-green-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Handoff video recorded
          </div>
        </div>
      );
    }

    if (skipped) {
      return (
        <div className="flex justify-center mb-2">
          <div className="max-w-[90%] px-3 py-1.5 rounded-lg text-xs text-center border bg-green-50 text-green-700 border-green-200">
            {message}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center mb-2 gap-2">
        <div className="max-w-[90%] px-3 py-1.5 rounded-lg text-xs text-center border bg-green-50 text-green-700 border-green-200">
          {message}
        </div>
        {!showCapture ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 max-w-[300px]">
            <p className="text-[11px] text-amber-700 mb-3 leading-relaxed">
              Record a quick video of the item you just handed off — this is your proof of its condition at handoff.
            </p>
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <button
              onClick={() => setShowCapture(true)}
              className="w-full py-2 rounded-lg text-sm font-medium
                         bg-amber-600 text-white hover:bg-amber-700 transition-colors
                         flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Record Handoff Video
            </button>
            <button
              onClick={() => setSkipped(true)}
              className="w-full mt-1.5 text-[11px] text-amber-500 hover:text-amber-700 transition-colors"
            >
              Skip
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-white p-3 max-w-[340px]">
            {uploading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                <span className="ml-2 text-sm text-inventory-500">Uploading...</span>
              </div>
            ) : (
              <VideoCapture
                mode="V1"
                onFramesCaptured={() => {}}
                onVideoBlob={handleVideoBlob}
                onSkip={() => setSkipped(true)}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // Borrower already uploaded or skipped
  if (uploaded) {
    return (
      <div className="flex flex-col items-center mb-2 gap-2">
        <div className="max-w-[90%] px-3 py-1.5 rounded-lg text-xs text-center border bg-green-50 text-green-700 border-green-200">
          {message}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-green-50 text-green-700 border border-green-200">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Pickup scan recorded
        </div>
      </div>
    );
  }

  if (skipped) {
    return (
      <div className="flex justify-center mb-2">
        <div className="max-w-[90%] px-3 py-1.5 rounded-lg text-xs text-center border bg-green-50 text-green-700 border-green-200">
          {message}
        </div>
      </div>
    );
  }

  // Borrower sees V1 prompt
  return (
    <div className="flex flex-col items-center mb-2 gap-2">
      <div className="max-w-[90%] px-3 py-1.5 rounded-lg text-xs text-center border bg-green-50 text-green-700 border-green-200">
        {message}
      </div>

      {!showCapture ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 max-w-[300px]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🛡️</span>
            <p className="text-sm font-medium text-blue-900">Protect yourself</p>
          </div>
          <p className="text-[11px] text-blue-700 mb-3 leading-relaxed">
            Record a quick video of the item before you take it. If there's a dispute later, this is your proof.
          </p>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <button
            onClick={() => setShowCapture(true)}
            className="w-full py-2 rounded-lg text-sm font-medium
                       bg-blue-600 text-white hover:bg-blue-700 transition-colors
                       flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Record Quick Scan
          </button>
          <button
            onClick={() => setSkipped(true)}
            className="w-full mt-1.5 text-[11px] text-blue-500 hover:text-blue-700 transition-colors"
          >
            Skip for now
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-200 bg-white p-3 max-w-[340px]">
          {uploading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              <span className="ml-2 text-sm text-inventory-500">Uploading...</span>
            </div>
          ) : (
            <VideoCapture
              mode="V1"
              onFramesCaptured={() => {}}
              onVideoBlob={handleVideoBlob}
              onSkip={() => setSkipped(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
