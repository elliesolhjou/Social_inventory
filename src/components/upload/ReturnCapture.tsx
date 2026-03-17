"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface ReturnCaptureProps {
  /** Called only after user approves all photos */
  onPhotosApproved: (photos: CapturedPhoto[]) => void;
  maxPhotos?: number;
  minPhotos?: number;
}

export interface CapturedPhoto {
  dataUrl: string;
  capturedAt: string; // ISO timestamp from device
  deviceMetadata: {
    user_agent: string;
    capture_timestamp: string;
    camera_facing: "environment" | "user";
    resolution: { width: number; height: number };
    mime_type: string;
  };
}

export default function ReturnCapture({
  onPhotosApproved,
  maxPhotos = 10,
  minPhotos = 2,
}: ReturnCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [flashEffect, setFlashEffect] = useState(false);
  const [step, setStep] = useState<"capture" | "preview">("capture");

  // ── Camera management ──────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError") {
        setCameraError("Camera access denied. Please allow camera permissions to submit return photos.");
      } else if (err.name === "NotFoundError") {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError("Could not access camera. Please try again.");
      }
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Attach stream to video element after mount
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraActive || !video || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => {
      setTimeout(() => video.play().catch(() => {}), 300);
    });
  }, [cameraActive]);

  // Flip camera
  const flipCamera = useCallback(() => {
    stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, [stopCamera]);

  useEffect(() => {
    if (cameraActive) startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Photo capture ──────────────────────────────────────────────────────────

  const captureFrame = useCallback((): CapturedPhoto | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const w = video.videoWidth || video.offsetWidth || 1280;
    const h = video.videoHeight || video.offsetHeight || 720;
    if (w === 0 || h === 0) return null;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const now = new Date().toISOString();

    return {
      dataUrl,
      capturedAt: now,
      deviceMetadata: {
        user_agent: navigator.userAgent,
        capture_timestamp: now,
        camera_facing: facingMode,
        resolution: { width: w, height: h },
        mime_type: "image/jpeg",
      },
    };
  }, [facingMode]);

  const takePhoto = useCallback(() => {
    if (photos.length >= maxPhotos) return;

    let attempts = 0;
    const tryCapture = () => {
      const photo = captureFrame();
      if (photo) {
        // Flash effect
        setFlashEffect(true);
        setTimeout(() => setFlashEffect(false), 150);

        setPhotos((prev) => [...prev, photo]);
      } else if (attempts++ < 20) {
        requestAnimationFrame(tryCapture);
      }
    };
    requestAnimationFrame(tryCapture);
  }, [captureFrame, photos.length, maxPhotos]);

  // ── Photo management ──────────────────────────────────────────────────────

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const retakeAll = useCallback(() => {
    setPhotos([]);
    setStep("capture");
    startCamera();
  }, [startCamera]);

  const goToPreview = useCallback(() => {
    stopCamera();
    setStep("preview");
  }, [stopCamera]);

  const backToCapture = useCallback(() => {
    setStep("capture");
    startCamera();
  }, [startCamera]);

  const handleApprove = useCallback(() => {
    onPhotosApproved(photos);
  }, [photos, onPhotosApproved]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Preview step — review photos before submitting
  if (step === "preview") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">
            Review photos ({photos.length})
          </h3>
          <button
            onClick={backToCapture}
            className="text-sm text-accent font-medium hover:underline"
          >
            + Take more
          </button>
        </div>

        <p className="text-inventory-500 text-sm">
          Make sure all photos are clear and show the item's current condition. Remove any blurry ones.
        </p>

        {/* Photo grid */}
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group">
              <img
                src={photo.dataUrl}
                alt={`Return photo ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity active:opacity-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                {i + 1}
              </div>
            </div>
          ))}
        </div>

        {photos.length < minPhotos && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-amber-500 text-xs mt-0.5">⚠</span>
            <p className="text-amber-700 text-xs leading-relaxed">
              Please take at least {minPhotos} photos for accurate condition verification.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={retakeAll}
            className="flex-1 py-3.5 border-2 border-inventory-200 text-inventory-600 rounded-2xl font-display font-semibold text-sm hover:border-inventory-400 transition-colors"
          >
            Retake All
          </button>
          <button
            onClick={handleApprove}
            disabled={photos.length < minPhotos}
            className="flex-1 py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Approve & Submit
          </button>
        </div>
      </div>
    );
  }

  // Capture step — camera viewfinder
  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />

      {/* Viewfinder */}
      <div className="relative aspect-[3/4] bg-inventory-950 rounded-3xl overflow-hidden">
        {/* Flash overlay */}
        {flashEffect && (
          <div className="absolute inset-0 bg-white z-50 animate-pulse" />
        )}

        {cameraActive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
              className="w-full h-full object-cover"
            />

            {/* Photo count badge */}
            {photos.length > 0 && (
              <div className="absolute top-4 right-4 bg-accent text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg">
                {photos.length}/{maxPhotos}
              </div>
            )}

            {/* Mini thumbnail strip of taken photos */}
            {photos.length > 0 && (
              <div className="absolute top-4 left-4 flex gap-1.5">
                {photos.slice(-3).map((photo, i) => (
                  <div key={i} className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white/50 shadow-sm">
                    <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {photos.length > 3 && (
                  <div className="w-10 h-10 rounded-lg bg-black/50 border-2 border-white/50 flex items-center justify-center text-white text-xs font-bold">
                    +{photos.length - 3}
                  </div>
                )}
              </div>
            )}

            {/* Camera controls */}
            <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
              <div className="flex items-center justify-center gap-6">
                {/* Flip camera */}
                <button
                  onClick={flipCamera}
                  className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                {/* Shutter button */}
                <button
                  onClick={takePhoto}
                  disabled={photos.length >= maxPhotos}
                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
                >
                  <div className="w-16 h-16 rounded-full border-4 border-inventory-300 flex items-center justify-center">
                    <svg className="w-7 h-7 text-inventory-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </button>

                {/* Done / Preview button */}
                {photos.length >= minPhotos ? (
                  <button
                    onClick={goToPreview}
                    className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white hover:bg-accent-dark transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-white/40 text-xs font-bold">
                      {photos.length}/{minPhotos}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Camera not started */
          <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8">
            {cameraError ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                  </svg>
                </div>
                <p className="text-red-300 text-sm max-w-xs">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-4 text-sm text-accent font-medium hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-white font-display font-bold text-lg mb-1">
                    Photo the item before returning
                  </p>
                  <p className="text-inventory-400 text-sm">
                    Take at least {minPhotos} clear photos showing the item's current condition.
                  </p>
                </div>

                <button
                  onClick={startCamera}
                  className="py-3 px-8 bg-accent text-white rounded-2xl font-display font-semibold text-sm hover:bg-accent-dark transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  Open Camera
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      {cameraActive && photos.length === 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-accent/5 border border-accent/10">
          <span className="text-lg">💡</span>
          <div className="text-sm text-inventory-600">
            <p className="font-semibold mb-0.5">Tips for good return photos:</p>
            <p>Show all sides of the item. Capture any existing wear or marks. Make sure lighting is clear — no dark or blurry shots.</p>
          </div>
        </div>
      )}
    </div>
  );
}
