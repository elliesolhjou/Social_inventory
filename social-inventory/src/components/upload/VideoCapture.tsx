"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface VideoCaptureProps {
  onFramesCaptured: (frames: string[]) => void;
  onRecordingStateChange?: (recording: boolean) => void;
}

const RECORD_DURATION = 5;
const FRAME_INTERVAL = 1250;

export default function VideoCapture({
  onFramesCaptured,
  onRecordingStateChange,
}: VideoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const frameTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(RECORD_DURATION);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [isFlipping, setIsFlipping] = useState(false);

  // ── KEY FIX: Attach stream AFTER video element renders ────────────────────
  // cameraActive=true renders <video>. This effect runs post-render so
  // videoRef.current is guaranteed to exist when we assign srcObject.
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch((err) => console.error("Play error:", err));
    }
  }, [cameraActive]);

  const startCamera = useCallback(
    async (mode?: "environment" | "user") => {
      try {
        setCameraError(null);
        const facing = mode ?? facingMode;

        // Stop any existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facing,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback — no facingMode constraint, works on most laptops
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        }

        streamRef.current = stream;
        setCameraActive(true); // triggers useEffect above to attach stream
      } catch (err: any) {
        console.error("Camera error:", err);
        setCameraError(
          err.name === "NotAllowedError"
            ? "Camera access denied. Please allow camera permissions and try again."
            : err.name === "NotFoundError"
              ? "No camera found. Try uploading a photo instead."
              : "Could not access camera. Try uploading a photo instead.",
        );
      }
    },
    [facingMode],
  );

  const stopCamera = useCallback((keepFrames = false) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    if (!keepFrames) setCapturedFrames([]);
  }, []);

  // ── FIX: Flip — pass new mode directly, don't rely on state ──────────────
  const flipCamera = useCallback(async () => {
    if (isFlipping) return;
    setIsFlipping(true);
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);

    await new Promise((r) => setTimeout(r, 150));
    await startCamera(newMode);
    setIsFlipping(false);
  }, [facingMode, isFlipping, startCamera]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    if (video.readyState < 2 || video.videoWidth === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const startRecording = useCallback(() => {
    const frames: string[] = [];
    setRecording(true);
    setCountdown(RECORD_DURATION);
    setCapturedFrames([]);
    onRecordingStateChange?.(true);

    const firstFrame = captureFrame();
    if (firstFrame) frames.push(firstFrame);

    frameTimerRef.current = setInterval(() => {
      const frame = captureFrame();
      if (frame) frames.push(frame);
    }, FRAME_INTERVAL);

    let remaining = RECORD_DURATION;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (frameTimerRef.current) clearInterval(frameTimerRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        onRecordingStateChange?.(false);

        const lastFrame = captureFrame();
        if (lastFrame) frames.push(lastFrame);

        const finalFrames = frames.filter(Boolean);
        setCapturedFrames(finalFrames);
        stopCamera(true);
        onFramesCaptured(finalFrames);
      }
    }, 1000);
  }, [captureFrame, stopCamera, onFramesCaptured, onRecordingStateChange]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const frames: string[] = [];

      if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.muted = true;
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.currentTime = 0;
            resolve();
          };
        });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const duration = Math.min(video.duration, 10);
        for (let i = 0; i < 4; i++) {
          video.currentTime = i * (duration / 4);
          await new Promise<void>((resolve) => {
            video.onseeked = () => {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0);
              frames.push(canvas.toDataURL("image/jpeg", 0.85));
              resolve();
            };
          });
        }
        URL.revokeObjectURL(video.src);
      } else if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        frames.push(dataUrl);
      }

      if (frames.length > 0) {
        setCapturedFrames(frames);
        onFramesCaptured(frames);
      }
    },
    [onFramesCaptured],
  );

  useEffect(() => {
    return () => {
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-inventory-950">
        {cameraActive ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {recording && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-4 border-red-500 rounded-3xl animate-pulse" />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/90 text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  <span className="font-mono font-bold text-sm">
                    {countdown}s
                  </span>
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="white"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (countdown / RECORD_DURATION)}`}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                </div>
              </div>
            )}

            {!recording && (
              <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={flipCamera}
                    disabled={isFlipping}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors disabled:opacity-50"
                  >
                    {isFlipping ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={startRecording}
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                  >
                    <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                      <span className="font-display font-bold text-white text-xs">
                        REC
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => stopCamera(false)}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : capturedFrames.length > 0 ? (
          <div className="w-full h-full grid grid-cols-2 gap-1 p-1">
            {capturedFrames.slice(0, 4).map((frame, i) => (
              <img
                key={i}
                src={frame}
                alt={`Frame ${i + 1}`}
                className="w-full h-full object-cover rounded-xl"
              />
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8">
            {cameraError ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
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
                <p className="text-red-300 text-sm max-w-xs">{cameraError}</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-white font-display font-bold text-lg mb-1">
                    Record your item
                  </p>
                  <p className="text-inventory-400 text-sm">
                    5 seconds is all it takes. Our AI does the rest.
                  </p>
                </div>
              </>
            )}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
              <button
                onClick={() => startCamera()}
                className="flex-1 py-3 px-6 bg-accent text-white rounded-2xl font-display font-semibold text-sm hover:bg-accent-dark transition-colors flex items-center justify-center gap-2"
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
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                Open Camera
              </button>
              <label className="flex-1 py-3 px-6 border-2 border-inventory-700 text-inventory-300 rounded-2xl font-display font-semibold text-sm hover:border-inventory-500 transition-colors cursor-pointer flex items-center justify-center gap-2">
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
                  type="file"
                  accept="video/*,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {capturedFrames.length > 0 && !cameraActive && (
        <button
          onClick={() => {
            setCapturedFrames([]);
            startCamera();
          }}
          className="w-full py-3 border-2 border-inventory-200 text-inventory-600 rounded-2xl font-display font-semibold text-sm hover:border-inventory-400 transition-colors"
        >
          Retake Video
        </button>
      )}
    </div>
  );
}
