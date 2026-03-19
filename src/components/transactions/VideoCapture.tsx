"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export type CaptureMode = "upload" | "V1" | "V2" | "V3";

interface VideoCaptureProps {
  onFramesCaptured: (frames: string[]) => void;
  onRecordingStateChange?: (recording: boolean) => void;
  onVideoBlob?: (blob: Blob) => void;
  onSkip?: () => void;
  mode?: CaptureMode;
}

const MODE_CONFIG: Record<
  CaptureMode,
  {
    title: string;
    subtitle: string;
    maxDuration: number;
    allowPhoto: boolean;
    allowUpload: boolean;
    showSkip: boolean;
  }
> = {
  upload: {
    title: "Record your item",
    subtitle: "Hold your camera steady and slowly rotate the item. 5 seconds is all we need.",
    maxDuration: 5,
    allowPhoto: true,
    allowUpload: true,
    showSkip: false,
  },
  V1: {
    title: "Quick Scan — Protect Yourself",
    subtitle: "Record a video of the item before you take it. Tap stop when you're done.",
    maxDuration: 30,
    allowPhoto: false,
    allowUpload: false,
    showSkip: true,
  },
  V2: {
    title: "Record Handback",
    subtitle: "Quick video of the item as you return it. Tap stop when done.",
    maxDuration: 30,
    allowPhoto: false,
    allowUpload: false,
    showSkip: true,
  },
  V3: {
    title: "Inspect Your Item",
    subtitle: "Your item is back! Record a video inspection. Tap stop when you're done.",
    maxDuration: 30,
    allowPhoto: false,
    allowUpload: false,
    showSkip: false,
  },
};

const FRAME_INTERVAL = 1250;

export default function VideoCapture({
  onFramesCaptured,
  onRecordingStateChange,
  onVideoBlob,
  onSkip,
  mode = "upload",
}: VideoCaptureProps) {
  const config = MODE_CONFIG[mode];

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const frameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const framesRef = useRef<string[]>([]);

  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);

  const isEvidence = mode !== "upload";

  const handleVideoMetadata = useCallback(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

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
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === "NotAllowedError") {
        setCameraError("Camera access denied. Please allow camera permissions and try again.");
      } else if (error.name === "NotFoundError") {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError("Could not access camera. Please try again.");
      }
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraActive || !video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {
      setTimeout(() => video.play().catch(() => {}), 300);
    });
  }, [cameraActive]);

  const flipCamera = useCallback(() => {
    stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, [stopCamera]);

  useEffect(() => {
    if (cameraActive) startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const captureFrame = useCallback((): string | null => {
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
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  // Extracted finish logic so both auto-stop and manual stop can call it
  const finishRecording = useCallback(() => {
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    onRecordingStateChange?.(false);

    const lastFrame = captureFrame();
    if (lastFrame) framesRef.current.push(lastFrame);

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        onVideoBlob?.(blob);
      };
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    const finalFrames = [...framesRef.current];
    setCapturedFrames(finalFrames);
    stopCamera();
    onFramesCaptured(finalFrames);
  }, [captureFrame, stopCamera, onFramesCaptured, onRecordingStateChange, onVideoBlob]);

  const startRecording = useCallback(() => {
    framesRef.current = [];
    chunksRef.current = [];
    setRecording(true);
    setElapsed(0);
    setCapturedFrames([]);
    onRecordingStateChange?.(true);

    if (onVideoBlob && streamRef.current) {
      try {
        const recorder = new MediaRecorder(streamRef.current, {
          mimeType: "video/webm;codecs=vp8",
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start();
        recorderRef.current = recorder;
      } catch {
        // MediaRecorder not supported
      }
    }

    const firstFrame = captureFrame();
    if (firstFrame) framesRef.current.push(firstFrame);

    frameTimerRef.current = setInterval(() => {
      const frame = captureFrame();
      if (frame) framesRef.current.push(frame);
    }, FRAME_INTERVAL);

    let seconds = 0;
    timerRef.current = setInterval(() => {
      seconds += 1;
      setElapsed(seconds);
      if (seconds >= config.maxDuration) {
        finishRecording();
      }
    }, 1000);
  }, [captureFrame, onRecordingStateChange, onVideoBlob, config.maxDuration, finishRecording]);

  const takePhoto = useCallback(() => {
    let attempts = 0;
    const tryCapture = () => {
      const frame = captureFrame();
      if (frame) {
        setCapturedFrames([frame]);
        stopCamera();
        onFramesCaptured([frame]);
      } else if (attempts++ < 20) {
        requestAnimationFrame(tryCapture);
      }
    };
    requestAnimationFrame(tryCapture);
  }, [captureFrame, stopCamera, onFramesCaptured]);

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
        const frameCount = 4;
        const interval = duration / frameCount;
        for (let i = 0; i < frameCount; i++) {
          video.currentTime = i * interval;
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
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    };
  }, [stopCamera]);

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
              disablePictureInPicture
              onLoadedMetadata={handleVideoMetadata}
              onCanPlay={() => videoRef.current?.play().catch(() => {})}
            />

            {recording && (
              <div className="absolute inset-0">
                {/* Border + badge are non-interactive */}
                <div className="absolute inset-0 border-4 border-red-500 rounded-3xl animate-pulse pointer-events-none" />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/90 text-white pointer-events-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  <span className="font-mono font-bold text-sm">{elapsed}s</span>
                </div>

                {/* Stop button — always visible during recording */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                  <button
                    onClick={finishRecording}
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                  >
                    <div className="w-10 h-10 rounded-sm bg-red-500" />
                  </button>
                  {isEvidence && (
                    <p className="text-white text-[10px] text-center mt-2 font-medium">
                      Tap to stop
                    </p>
                  )}
                </div>
              </div>
            )}

            {!recording && (
              <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={flipCamera}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>

                  <button
                    onClick={startRecording}
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                  >
                    <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                      <span className="font-display font-bold text-white text-xs">REC</span>
                    </div>
                  </button>

                  {config.allowPhoto && (
                    <button
                      onClick={takePhoto}
                      className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                      title="Take a photo"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}

                  <button
                    onClick={stopCamera}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : capturedFrames.length > 0 ? (
          <div
            className={`w-full h-full p-1 ${
              capturedFrames.length === 1
                ? "flex items-center justify-center"
                : "grid grid-cols-2 gap-1"
            }`}
          >
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
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                  </svg>
                </div>
                <p className="text-red-300 text-sm max-w-xs">{cameraError}</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-white font-display font-bold text-lg mb-1">
                    {config.title}
                  </p>
                  <p className="text-inventory-400 text-sm">{config.subtitle}</p>
                </div>
              </>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
              <button
                onClick={startCamera}
                className="flex-1 py-3 px-6 bg-accent text-white rounded-2xl font-display font-semibold text-sm hover:bg-accent-dark transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Open Camera
              </button>

              {config.allowUpload && (
                <label className="flex-1 py-3 px-6 border-2 border-inventory-700 text-inventory-300 rounded-2xl font-display font-semibold text-sm hover:border-inventory-500 transition-colors cursor-pointer flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload
                  <input
                    type="file"
                    accept="video/*,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {config.showSkip && onSkip && (
              <button
                onClick={onSkip}
                className="text-inventory-500 text-sm hover:text-inventory-300 transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        )}
      </div>

      {capturedFrames.length > 0 && !cameraActive && (
        <div className="flex gap-3">
          <button
            onClick={() => {
              setCapturedFrames([]);
              framesRef.current = [];
              startCamera();
            }}
            className="flex-1 py-3 border-2 border-inventory-200 text-inventory-600 rounded-2xl font-display font-semibold text-sm hover:border-inventory-400 transition-colors"
          >
            {isEvidence ? "Re-record" : capturedFrames.length === 1 ? "Retake Photo" : "Retake Video"}
          </button>
          {isEvidence && config.showSkip && onSkip && (
            <button
              onClick={onSkip}
              className="py-3 px-6 text-inventory-500 text-sm hover:text-inventory-300 transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
