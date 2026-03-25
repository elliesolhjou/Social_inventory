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
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);

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
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError") {
        setCameraError("Camera access denied. Please allow camera permissions and try again.");
      } else if (err.name === "NotFoundError") {
        setCameraError("No camera found. Try uploading photos instead.");
      } else {
        setCameraError("Could not access camera. Try uploading photos instead.");
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
        setCapturedFrames(frames);
        stopCamera();
        onFramesCaptured(frames);
      }
    }, 1000);
  }, [captureFrame, stopCamera, onFramesCaptured, onRecordingStateChange]);

  const [photoFlash, setPhotoFlash] = useState(false);

  // Take a single photo and ADD to existing frames — with visual flash
  const takePhoto = useCallback(() => {
    let attempts = 0;
    const tryCapture = () => {
      const frame = captureFrame();
      if (frame) {
        setCapturedFrames((prev) => [...prev, frame]);
        // Flash feedback
        setPhotoFlash(true);
        setTimeout(() => setPhotoFlash(false), 200);
      } else if (attempts++ < 20) {
        requestAnimationFrame(tryCapture);
      }
    };
    requestAnimationFrame(tryCapture);
  }, [captureFrame]);

  // Handle multi-file upload — adds to existing frames
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newFrames: string[] = [];

      for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi];

        if (file.type.startsWith("video/")) {
          const video = document.createElement("video");
          video.src = URL.createObjectURL(file);
          video.muted = true;
          await new Promise<void>((resolve) => {
            video.onloadedmetadata = () => { video.currentTime = 0; resolve(); };
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
                newFrames.push(canvas.toDataURL("image/jpeg", 0.85));
                resolve();
              };
            });
          }
          URL.revokeObjectURL(video.src);
        } else {
          // Image file
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newFrames.push(dataUrl);
        }
      }

      // Reset input so the same files can be re-selected
      e.target.value = "";

      if (newFrames.length > 0) {
        setCapturedFrames((prev) => [...prev, ...newFrames]);
      }
    },
    [],
  );

  // Remove a specific frame
  const removeFrame = useCallback((index: number) => {
    setCapturedFrames((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Submit captured frames
  const handleSubmitFrames = useCallback(() => {
    if (capturedFrames.length > 0) {
      stopCamera();
      onFramesCaptured(capturedFrames);
    }
  }, [capturedFrames, stopCamera, onFramesCaptured]);

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />
      <div className="relative bg-[#1c1b1a] rounded-2xl overflow-hidden" style={{ minHeight: "400px" }}>
        {cameraActive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleVideoMetadata}
              className="w-full h-full object-cover"
              style={{ minHeight: "400px" }}
            />

            {/* Photo flash feedback */}
            {photoFlash && (
              <div className="absolute inset-0 bg-white/80 pointer-events-none z-20 animate-pulse" />
            )}

            {/* Photo count badge — shows when photos taken while camera open */}
            {capturedFrames.length > 0 && (
              <div className="absolute top-4 left-4 z-10 bg-[#ae3200] text-white px-3 py-1.5 rounded-full text-xs font-bold font-['Plus_Jakarta_Sans'] flex items-center gap-1.5 shadow-lg">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                {capturedFrames.length} photo{capturedFrames.length !== 1 ? "s" : ""}
              </div>
            )}

            {/* Done button — when photos taken, show option to finish */}
            {capturedFrames.length > 0 && !recording && (
              <button
                onClick={() => stopCamera()}
                className="absolute top-4 right-4 z-10 bg-white text-[#1c1b1a] px-4 py-1.5 rounded-full text-xs font-bold font-['Plus_Jakarta_Sans'] shadow-lg hover:bg-[#f7f3ef] transition-colors"
              >
                Done ({capturedFrames.length})
              </button>
            )}

            {/* Recording overlay */}
            {recording && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (countdown / RECORD_DURATION)}`}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* Camera controls */}
            {!recording && (
              <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-center justify-center gap-6">
                  <button onClick={flipCamera}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button onClick={startRecording}
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
                    <div className="w-16 h-16 rounded-full bg-[#ae3200] flex items-center justify-center">
                      <span className="font-['Plus_Jakarta_Sans'] font-bold text-white text-xs">REC</span>
                    </div>
                  </button>
                  <button onClick={takePhoto}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                    title="Take a photo">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button onClick={stopCamera}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : capturedFrames.length > 0 ? (
          /* Photo grid with delete buttons */
          <div className="w-full p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {capturedFrames.map((frame, i) => (
                <div key={i} className="relative group aspect-square rounded-xl overflow-hidden">
                  <img src={frame} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeFrame(i)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    title="Remove photo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <span className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-['Plus_Jakarta_Sans']">
                    {i + 1}
                  </span>
                </div>
              ))}
              {/* Add more button */}
              <label className="aspect-square rounded-xl border-2 border-dashed border-[#5b4038]/30 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#ae3200]/50 hover:bg-[#ae3200]/5 transition-all">
                <svg className="w-8 h-8 text-[#8f7067]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-xs text-[#8f7067] font-['Plus_Jakarta_Sans'] font-bold">Add Photo</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        ) : (
          /* Initial empty state */
          <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8" style={{ minHeight: "400px" }}>
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
                <div className="w-20 h-20 rounded-full bg-[#ae3200]/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#ae3200]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-white font-['Plus_Jakarta_Sans'] font-bold text-lg mb-1">Record your item</p>
                  <p className="text-[#8f7067] text-sm font-['Be_Vietnam_Pro']">5 seconds is all it takes. Our AI does the rest.</p>
                </div>
              </>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
              <button onClick={startCamera}
                className="flex-1 py-3 px-6 bg-[#ae3200] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Open Camera
              </button>
              <label className="flex-1 py-3 px-6 border border-[#5b4038]/30 text-[#e6e2de] rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:border-[#ae3200]/50 transition-colors cursor-pointer flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upload
                <input type="file" accept="image/*,video/*" multiple onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons when photos exist */}
      {capturedFrames.length > 0 && !cameraActive && (
        <div className="flex gap-3">
          <button
            onClick={() => { setCapturedFrames([]); }}
            className="flex-1 py-3 border border-[#e6e2de] text-[#5b4038] rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:border-[#ae3200]/30 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={startCamera}
            className="flex-1 py-3 border border-[#e6e2de] text-[#5b4038] rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:border-[#ae3200]/30 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            Take More
          </button>
          <button
            onClick={handleSubmitFrames}
            className="flex-[2] py-3 bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            Analyze {capturedFrames.length} Photo{capturedFrames.length !== 1 ? "s" : ""}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
