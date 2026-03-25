"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface VideoCaptureProps {
  onFramesCaptured: (frames: string[], videoUrl?: string) => void;
  onRecordingStateChange?: (recording: boolean) => void;
}

const FRAME_INTERVAL = 2000;

export default function VideoCapture({
  onFramesCaptured,
  onRecordingStateChange,
}: VideoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const frameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingFramesRef = useRef<string[]>([]);

  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [photoFlash, setPhotoFlash] = useState(false);

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
    if (videoRef.current) videoRef.current.srcObject = null;
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

  // ── Start recording: MediaRecorder for video + frame extraction for API ──
  const startRecording = useCallback(() => {
    recordingFramesRef.current = [];
    chunksRef.current = [];
    setRecording(true);
    setElapsed(0);
    setRecordedVideoUrl(null);
    onRecordingStateChange?.(true);

    // Start MediaRecorder for actual video
    const stream = streamRef.current;
    if (stream) {
      try {
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : MediaRecorder.isTypeSupported("video/webm")
            ? "video/webm"
            : "video/mp4";
        const recorder = new MediaRecorder(stream, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(1000); // collect chunks every second
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.error("MediaRecorder not supported:", err);
      }
    }

    // Extract frames for vision API
    const firstFrame = captureFrame();
    if (firstFrame) recordingFramesRef.current.push(firstFrame);
    frameTimerRef.current = setInterval(() => {
      const frame = captureFrame();
      if (frame) recordingFramesRef.current.push(frame);
    }, FRAME_INTERVAL);

    // Count-up timer
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, [captureFrame, onRecordingStateChange]);

  // ── Stop recording ──
  const stopRecording = useCallback(() => {
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    onRecordingStateChange?.(false);

    // Last frame
    const lastFrame = captureFrame();
    if (lastFrame) recordingFramesRef.current.push(lastFrame);

    const frames = recordingFramesRef.current;

    // Stop MediaRecorder — wait for video blob, then send everything to parent
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        // Send frames + video URL to parent (goes to Preview step)
        onFramesCaptured(frames, url);
      };
      recorder.stop();
    } else {
      // No recorder — just send frames
      onFramesCaptured(frames);
    }

    setCapturedFrames(frames);
    stopCamera();
  }, [captureFrame, onRecordingStateChange, stopCamera, onFramesCaptured]);

  // Take a single photo — send to parent immediately
  const takePhoto = useCallback(() => {
    let attempts = 0;
    const tryCapture = () => {
      const frame = captureFrame();
      if (frame) {
        setPhotoFlash(true);
        setTimeout(() => setPhotoFlash(false), 200);
        // Send to parent → goes to Preview step
        setTimeout(() => {
          stopCamera();
          onFramesCaptured([frame]);
        }, 300);
      } else if (attempts++ < 20) {
        requestAnimationFrame(tryCapture);
      }
    };
    requestAnimationFrame(tryCapture);
  }, [captureFrame, stopCamera, onFramesCaptured]);

  // Handle file upload — send to parent immediately
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const newFrames: string[] = [];
      let uploadedVideoUrl: string | undefined;

      for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi];
        if (file.type.startsWith("video/")) {
          uploadedVideoUrl = URL.createObjectURL(file);
          // Extract frames silently for AI
          const video = document.createElement("video");
          video.src = uploadedVideoUrl;
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
        } else {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newFrames.push(dataUrl);
        }
      }
      e.target.value = "";
      // Send to parent → goes to Preview step
      if (newFrames.length > 0) {
        onFramesCaptured(newFrames, uploadedVideoUrl);
      }
    },
    [onFramesCaptured],
  );

  const removeFrame = useCallback((index: number) => {
    setCapturedFrames((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Submit frames + optional video URL
  const handleSubmitFrames = useCallback(() => {
    if (capturedFrames.length > 0) {
      stopCamera();
      onFramesCaptured(capturedFrames, recordedVideoUrl ?? undefined);
    }
  }, [capturedFrames, recordedVideoUrl, stopCamera, onFramesCaptured]);

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

            {/* Photo flash */}
            {photoFlash && (
              <div className="absolute inset-0 bg-white/80 pointer-events-none z-20 animate-pulse" />
            )}

            {/* Photo count badge */}
            {capturedFrames.length > 0 && !recording && (
              <div className="absolute top-4 left-4 z-10 bg-[#ae3200] text-white px-3 py-1.5 rounded-full text-xs font-bold font-['Plus_Jakarta_Sans'] flex items-center gap-1.5 shadow-lg">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                {capturedFrames.length} photo{capturedFrames.length !== 1 ? "s" : ""}
              </div>
            )}

            {/* Done button */}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white text-sm font-mono font-bold">
                    {Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <button
                  onClick={stopRecording}
                  className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-2xl"
                >
                  <div className="w-8 h-8 rounded-sm bg-[#ae3200]" />
                </button>
                <p className="text-white text-sm mt-3 font-['Plus_Jakarta_Sans'] font-bold">Tap to stop</p>
              </div>
            )}

            {/* Camera controls (when not recording) */}
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
        ) : (capturedFrames.length > 0 || recordedVideoUrl) ? (
          /* Preview: video OR photo grid — never both */
          <div className="w-full p-4">
            {recordedVideoUrl ? (
              /* Video preview only — frames are internal */
              <div>
                <video
                  src={recordedVideoUrl}
                  controls
                  playsInline
                  className="w-full rounded-xl"
                  style={{ maxHeight: "400px" }}
                />
              </div>
            ) : (
              /* Photo grid — only when no video */
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {capturedFrames.map((frame, i) => (
                  <div key={i} className="relative group aspect-square rounded-xl overflow-hidden">
                    <img src={frame} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeFrame(i)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <span className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-['Plus_Jakarta_Sans']">{i + 1}</span>
                  </div>
                ))}
                <button
                  onClick={startCamera}
                  className="aspect-square rounded-xl border-2 border-dashed border-[#8f7067]/30 flex flex-col items-center justify-center gap-2 hover:border-[#ae3200]/50 hover:bg-[#ae3200]/5 transition-all"
                >
                  <svg className="w-8 h-8 text-[#8f7067]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                  <span className="text-xs text-[#8f7067] font-['Plus_Jakarta_Sans'] font-bold">Camera</span>
                </button>
                <label className="aspect-square rounded-xl border-2 border-dashed border-[#8f7067]/30 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#ae3200]/50 hover:bg-[#ae3200]/5 transition-all">
                  <svg className="w-8 h-8 text-[#8f7067]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span className="text-xs text-[#8f7067] font-['Plus_Jakarta_Sans'] font-bold">Upload</span>
                  <input type="file" accept="image/*,video/*" multiple onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            )}
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

      {/* Action buttons */}
      {capturedFrames.length > 0 && !cameraActive && (
        <div className="flex gap-3">
          <button
            onClick={() => { setCapturedFrames([]); setRecordedVideoUrl(null); }}
            className="flex-1 py-3 border border-[#e6e2de] text-[#5b4038] rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:border-[#ae3200]/30 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleSubmitFrames}
            className="flex-[2] py-3 bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            {recordedVideoUrl ? "Continue with Video" : `Analyze ${capturedFrames.length} Photo${capturedFrames.length !== 1 ? "s" : ""}`}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
