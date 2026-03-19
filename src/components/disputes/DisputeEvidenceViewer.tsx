"use client";

import { useState } from "react";

interface EvidenceItem {
  id: string;
  evidence_type: "V1" | "V2" | "V3";
  video_url: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  extracted_frames?: {
    timestamp_offset_ms: number;
    angle_label: string;
    frame_url: string;
    frame_index: number;
  }[];
  captured_at: string;
}

interface ChecklistData {
  generated_at: string;
  questions: { id: string; question: string; component: string }[];
  answers?: { id: string; answer: string; note?: string }[];
  certified_at?: string;
}

interface DisputeEvidenceViewerProps {
  evidence: EvidenceItem[];
  conditionChecklist?: ChecklistData | null;
}

const TYPE_LABELS: Record<string, { label: string; description: string; color: string }> = {
  V1: {
    label: "Pickup Scan",
    description: "Borrower's video at pickup",
    color: "bg-blue-100 text-blue-700",
  },
  V2: {
    label: "Return Handback",
    description: "Borrower's video at return",
    color: "bg-green-100 text-green-700",
  },
  V3: {
    label: "Owner Inspection",
    description: "Owner's inspection after return",
    color: "bg-amber-100 text-amber-700",
  },
};

function formatTimeGap(fromDate: string, toDate: string): string {
  const ms = new Date(toDate).getTime() - new Date(fromDate).getTime();
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h gap`;
  if (hours > 0) return `${hours}h gap`;
  const minutes = Math.floor(ms / 60000);
  return `${minutes}m gap`;
}

export default function DisputeEvidenceViewer({
  evidence,
  conditionChecklist,
}: DisputeEvidenceViewerProps) {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const sorted = [...evidence].sort(
    (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
  );

  return (
    <div className="space-y-6">
      <h3 className="font-display font-bold text-lg text-inventory-900">
        Evidence Timeline
      </h3>

      {sorted.length === 0 ? (
        <p className="text-inventory-500 text-sm">No evidence videos recorded.</p>
      ) : (
        <div className="space-y-4">
          {sorted.map((ev, i) => {
            const config = TYPE_LABELS[ev.evidence_type];
            const prevEv = i > 0 ? sorted[i - 1] : null;

            return (
              <div key={ev.id}>
                {/* Time gap badge between evidence */}
                {prevEv && (
                  <div className="flex justify-center mb-3">
                    <span className="px-3 py-1 rounded-full bg-inventory-100 text-inventory-500 text-xs font-medium">
                      {formatTimeGap(prevEv.captured_at, ev.captured_at)}
                    </span>
                  </div>
                )}

                <div className="rounded-2xl border border-inventory-200 overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 bg-inventory-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${config.color}`}>
                        {ev.evidence_type}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-inventory-900">{config.label}</p>
                        <p className="text-xs text-inventory-500">{config.description}</p>
                      </div>
                    </div>
                    <span className="text-xs text-inventory-400">
                      {new Date(ev.captured_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Video player */}
                  <div className="p-4">
                    {activeVideo === ev.id ? (
                      <video
                        src={ev.video_url}
                        controls
                        autoPlay
                        className="w-full rounded-xl"
                        onEnded={() => setActiveVideo(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setActiveVideo(ev.id)}
                        className="relative w-full aspect-video rounded-xl bg-inventory-900 
                                   flex items-center justify-center group cursor-pointer overflow-hidden"
                      >
                        {ev.thumbnail_url && (
                          <img
                            src={ev.thumbnail_url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover opacity-60"
                          />
                        )}
                        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center 
                                        group-hover:scale-110 transition-transform">
                          <svg className="w-6 h-6 text-inventory-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                        {ev.duration_seconds && (
                          <span className="absolute bottom-3 right-3 px-2 py-1 rounded-lg 
                                         bg-black/70 text-white text-xs font-mono">
                            {ev.duration_seconds}s
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Extracted frames grid */}
                  {ev.extracted_frames && ev.extracted_frames.length > 0 && (
                    <div className="px-4 pb-4">
                      <p className="text-xs font-medium text-inventory-500 mb-2">
                        Key Frames ({ev.extracted_frames.length})
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {ev.extracted_frames.map((frame, fi) => (
                          <div key={fi} className="relative group">
                            <img
                              src={frame.frame_url}
                              alt={frame.angle_label}
                              className="w-full aspect-square object-cover rounded-lg"
                            />
                            <span className="absolute bottom-0 inset-x-0 px-1.5 py-1 
                                           bg-black/70 text-white text-[10px] rounded-b-lg 
                                           truncate text-center">
                              {frame.angle_label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Condition Checklist */}
      {conditionChecklist && conditionChecklist.answers && (
        <div className="rounded-2xl border border-inventory-200 overflow-hidden">
          <div className="px-4 py-3 bg-inventory-50">
            <h4 className="text-sm font-bold text-inventory-900">
              Owner&apos;s Condition Certification
            </h4>
            {conditionChecklist.certified_at && (
              <p className="text-xs text-inventory-500">
                Certified {new Date(conditionChecklist.certified_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="p-4 space-y-3">
            {conditionChecklist.questions.map((q) => {
              const answer = conditionChecklist.answers?.find((a) => a.id === q.id);
              return (
                <div key={q.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      answer?.answer === "yes"
                        ? "bg-green-100 text-green-700"
                        : answer?.answer === "no"
                          ? "bg-red-100 text-red-700"
                          : "bg-inventory-100 text-inventory-500"
                    }`}
                  >
                    {answer?.answer === "yes" ? "✓" : answer?.answer === "no" ? "✗" : "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-inventory-700">
                      <span className="font-medium text-inventory-900">{q.component}:</span>{" "}
                      {q.question}
                    </p>
                    {answer?.note && (
                      <p className="text-xs text-inventory-500 mt-0.5">
                        Note: {answer.note}
                      </p>
                    )}
                    {/* Free text answer (accessories) */}
                    {answer?.answer && answer.answer !== "yes" && answer.answer !== "no" && (
                      <p className="text-xs text-inventory-600 mt-0.5 italic">
                        {answer.answer}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
