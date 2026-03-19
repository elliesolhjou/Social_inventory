"use client";

import { useState } from "react";

interface DamageAssessment {
  damage_detected: boolean;
  confidence: number;
  summary: string;
  findings: {
    component: string;
    issue: string;
    severity: "none" | "minor" | "moderate" | "severe";
  }[];
  recommendation: "release_deposit" | "capture_full" | "capture_partial" | "needs_human_review";
  recommended_capture_percent?: number | null;
  adaptive_threshold?: {
    category: string;
    condition_adjustment: number;
    effective_auto_resolve: number;
    normal_wear_description: string;
    final_recommendation: string;
    auto_resolved: boolean;
    reason: string;
  };
}

interface AIDamageResultProps {
  transactionId: string;
  existingAssessment?: DamageAssessment | null;
}

const severityColors: Record<string, string> = {
  none: "bg-green-100 text-green-700",
  minor: "bg-yellow-100 text-yellow-700",
  moderate: "bg-orange-100 text-orange-700",
  severe: "bg-red-100 text-red-700",
};

const recommendationLabels: Record<string, { label: string; color: string }> = {
  release_deposit: { label: "Release deposit — no damage found", color: "text-green-700 bg-green-50 border-green-200" },
  capture_full: { label: "Capture full deposit — significant damage", color: "text-red-700 bg-red-50 border-red-200" },
  capture_partial: { label: "Capture partial deposit", color: "text-orange-700 bg-orange-50 border-orange-200" },
  needs_human_review: { label: "Needs human review — inconclusive", color: "text-blue-700 bg-blue-50 border-blue-200" },
};

export default function AIDamageResult({
  transactionId,
  existingAssessment,
}: AIDamageResultProps) {
  const [assessment, setAssessment] = useState<DamageAssessment | null>(existingAssessment ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/compare-damage`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAssessment(data.assessment);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!assessment) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-accent/30 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🤖</span>
        </div>
        <h4 className="font-bold text-sm mb-1">AI Damage Analysis</h4>
        <p className="text-xs text-inventory-500 mb-4">
          Compare pickup photos vs inspection video using Gemini AI.
        </p>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="py-2.5 px-6 bg-accent text-white rounded-xl font-medium text-sm
                     hover:bg-accent-dark disabled:opacity-50 transition-colors"
        >
          {loading ? "Analyzing..." : "Run AI Analysis"}
        </button>
      </div>
    );
  }

  const finalRec = assessment.adaptive_threshold?.final_recommendation ?? assessment.recommendation;
  const rec = recommendationLabels[finalRec] ?? recommendationLabels.needs_human_review;

  return (
    <div className="rounded-2xl border border-inventory-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-inventory-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h4 className="text-sm font-bold text-inventory-900">AI Damage Analysis</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${assessment.confidence >= 80 ? "text-green-600" : assessment.confidence >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {assessment.confidence}% confidence
          </span>
          <span className={`w-2 h-2 rounded-full ${assessment.damage_detected ? "bg-red-500" : "bg-green-500"}`} />
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 space-y-4">
        <p className="text-sm text-inventory-700">{assessment.summary}</p>

        {/* Recommendation */}
        <div className={`px-4 py-3 rounded-xl border ${rec.color}`}>
          <p className="text-sm font-medium">{rec.label}</p>
          {assessment.recommended_capture_percent && (
            <p className="text-xs mt-1">
              Suggested: capture {assessment.recommended_capture_percent}% of deposit
            </p>
          )}
        </div>

        {/* Adaptive Threshold Info */}
        {assessment.adaptive_threshold && (
          <div className="px-4 py-3 rounded-xl bg-inventory-50 border border-inventory-200">
            <p className="text-xs font-bold text-inventory-600 mb-1">
              Adaptive Threshold: {assessment.adaptive_threshold.category}
            </p>
            <p className="text-[11px] text-inventory-500 mb-1">
              {assessment.adaptive_threshold.reason}
            </p>
            <div className="flex gap-3 text-[10px] text-inventory-400">
              <span>Auto-resolve: {assessment.adaptive_threshold.effective_auto_resolve}%</span>
              {assessment.adaptive_threshold.condition_adjustment !== 0 && (
                <span>Condition adj: {assessment.adaptive_threshold.condition_adjustment > 0 ? "+" : ""}{assessment.adaptive_threshold.condition_adjustment}</span>
              )}
              <span className={assessment.adaptive_threshold.auto_resolved ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                {assessment.adaptive_threshold.auto_resolved ? "Auto-resolved" : "Manual review needed"}
              </span>
            </div>
            <p className="text-[10px] text-inventory-400 mt-1 italic">
              Normal wear for this category: {assessment.adaptive_threshold.normal_wear_description}
            </p>
          </div>
        )}

        {/* Findings */}
        {assessment.findings.length > 0 && (
          <div>
            <p className="text-xs font-medium text-inventory-500 mb-2">
              Findings ({assessment.findings.length})
            </p>
            <div className="space-y-2">
              {assessment.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 mt-0.5 ${severityColors[f.severity]}`}>
                    {f.severity.toUpperCase()}
                  </span>
                  <div>
                    <span className="font-medium text-inventory-900">{f.component}:</span>{" "}
                    <span className="text-inventory-600">{f.issue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Re-run */}
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="text-xs text-inventory-500 hover:text-accent transition-colors"
        >
          {loading ? "Re-analyzing..." : "Re-run analysis"}
        </button>
      </div>
    </div>
  );
}
