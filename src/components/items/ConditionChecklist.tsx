"use client";

import { useState } from "react";

interface ChecklistQuestion {
  id: string;
  question: string;
  component: string;
}

interface ChecklistAnswer {
  id: string;
  answer: string;
  note?: string;
}

interface ChecklistData {
  generated_at: string;
  checklist_version: string;
  questions: ChecklistQuestion[];
  answers?: ChecklistAnswer[] | null;
  certified_at?: string | null;
}

interface ConditionChecklistProps {
  itemId: string;
  checklist: ChecklistData | null;
  /** Is this user the item owner? */
  isOwner: boolean;
  /** Has any borrow request been made? Locks editing if true. */
  hasActiveBorrow: boolean;
  onChecklistUpdated?: (checklist: ChecklistData) => void;
}

export default function ConditionChecklist({
  itemId,
  checklist,
  isOwner,
  hasActiveBorrow,
  onChecklistUpdated,
}: ConditionChecklistProps) {
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { answer: string; note: string }>>(
    () => {
      if (!checklist?.answers) return {};
      const map: Record<string, { answer: string; note: string }> = {};
      for (const a of checklist.answers) {
        map[a.id] = { answer: a.answer, note: a.note || "" };
      }
      return map;
    }
  );

  const isCertified = !!checklist?.certified_at;
  const isLocked = isCertified || hasActiveBorrow;
  const isReadOnly = !isOwner || isLocked;

  // Generate checklist via Gemini
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/generate-checklist`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate checklist");
      onChecklistUpdated?.(data.checklist);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  // Submit certification
  const handleCertify = async () => {
    if (!checklist?.questions) return;

    // Validate all questions answered
    const unanswered = checklist.questions.filter((q) => !answers[q.id]?.answer);
    if (unanswered.length > 0) {
      setError(`Please answer all questions. ${unanswered.length} remaining.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const answerArray = checklist.questions.map((q) => ({
        id: q.id,
        answer: answers[q.id].answer,
        note: answers[q.id].note || undefined,
      }));

      const res = await fetch(`/api/items/${itemId}/submit-checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answerArray }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      onChecklistUpdated?.(data.checklist);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submission failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const setAnswer = (qId: string, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], answer, note: prev[qId]?.note || "" },
    }));
  };

  const setNote = (qId: string, note: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], answer: prev[qId]?.answer || "", note },
    }));
  };

  // ── No checklist yet: show generate button (owner only) ──────
  if (!checklist && isOwner) {
    return (
      <div className="p-5 rounded-2xl border border-dashed border-inventory-300 bg-inventory-50">
        <p className="text-sm text-inventory-600 mb-3">
          Add a detailed condition report to protect yourself in disputes.
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="py-2.5 px-5 bg-accent text-white rounded-xl font-display font-semibold text-sm
                     hover:bg-accent-dark disabled:opacity-50 transition-colors"
        >
          {generating ? "Generating..." : "Add Detailed Condition Report"}
        </button>
        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
      </div>
    );
  }

  if (!checklist || !checklist.questions) return null;

  // ── Read-only display (borrowers, or certified/locked) ───────
  if (isReadOnly) {
    return (
      <div className="rounded-2xl border border-inventory-200 overflow-hidden">
        <div className="px-4 py-3 bg-inventory-50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-inventory-900">
            Condition Report
          </h4>
          {isCertified && (
            <span className="px-2 py-0.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium">
              Certified
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {checklist.questions.map((q) => {
            const a = checklist.answers?.find((ans) => ans.id === q.id);
            return (
              <div key={q.id} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    a?.answer === "yes"
                      ? "bg-green-100 text-green-700"
                      : a?.answer === "no"
                        ? "bg-red-100 text-red-700"
                        : "bg-inventory-100 text-inventory-500"
                  }`}
                >
                  {a?.answer === "yes" ? "✓" : a?.answer === "no" ? "✗" : "—"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-inventory-700">
                    <span className="font-medium text-inventory-900">
                      {q.component}:
                    </span>{" "}
                    {q.question}
                  </p>
                  {a?.note && (
                    <p className="text-xs text-inventory-500 mt-0.5">
                      Note: {a.note}
                    </p>
                  )}
                  {a?.answer &&
                    a.answer !== "yes" &&
                    a.answer !== "no" && (
                      <p className="text-xs text-inventory-600 mt-0.5 italic">
                        {a.answer}
                      </p>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Editable form (owner, not yet certified, no active borrow) ──
  return (
    <div className="rounded-2xl border border-accent/30 overflow-hidden">
      <div className="px-4 py-3 bg-accent/5">
        <h4 className="text-sm font-bold text-inventory-900">
          Condition Certification
        </h4>
        <p className="text-xs text-inventory-500 mt-1">
          You are certifying the condition of your item. Your answers are stored
          and may be used in dispute resolution. Inaccurate answers may result in
          your dispute being denied and your account being flagged.
        </p>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="p-4 space-y-4">
        {checklist.questions.map((q, i) => {
          const isLast = i === checklist.questions.length - 1;
          const currentAnswer = answers[q.id]?.answer || "";
          const currentNote = answers[q.id]?.note || "";

          return (
            <div key={q.id} className="pb-4 border-b border-inventory-100 last:border-0 last:pb-0">
              <p className="text-sm text-inventory-800 mb-2">
                <span className="font-semibold text-inventory-900">
                  {q.component}:
                </span>{" "}
                {q.question}
              </p>

              {isLast ? (
                // Accessories question: free text
                <textarea
                  value={currentAnswer}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-inventory-200 text-sm
                             focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
                             placeholder:text-inventory-400"
                  placeholder="List all included accessories..."
                />
              ) : (
                // Yes/No toggle
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setAnswer(q.id, "yes")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentAnswer === "yes"
                        ? "bg-green-100 text-green-700 border border-green-300"
                        : "bg-inventory-50 text-inventory-500 border border-inventory-200 hover:border-inventory-300"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setAnswer(q.id, "no")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentAnswer === "no"
                        ? "bg-red-100 text-red-700 border border-red-300"
                        : "bg-inventory-50 text-inventory-500 border border-inventory-200 hover:border-inventory-300"
                    }`}
                  >
                    No
                  </button>
                </div>
              )}

              {/* Optional note */}
              {!isLast && (
                <input
                  type="text"
                  value={currentNote}
                  onChange={(e) => setNote(q.id, e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-inventory-200 text-xs
                             focus:outline-none focus:border-accent placeholder:text-inventory-400"
                  placeholder="Add a note (optional)..."
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={handleCertify}
          disabled={submitting}
          className="w-full py-3 bg-accent text-white rounded-2xl font-display font-semibold text-sm
                     hover:bg-accent-dark disabled:opacity-50 transition-colors"
        >
          {submitting ? "Certifying..." : "Certify Condition"}
        </button>
      </div>
    </div>
  );
}
