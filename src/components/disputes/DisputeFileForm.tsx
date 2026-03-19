"use client";

import { useState } from "react";

interface DisputeFileFormProps {
  transactionId: string;
  hasV3: boolean;
  onDisputeFiled: (dispute: { id: string; state: string }) => void;
  onCancel: () => void;
}

const DISPUTE_REASONS = [
  "Physical damage",
  "Missing parts or accessories",
  "Not functioning properly",
  "Excessive wear beyond normal use",
  "Item returned dirty or stained",
  "Wrong item returned",
  "Other",
];

export default function DisputeFileForm({
  transactionId,
  hasV3,
  onDisputeFiled,
  onCancel,
}: DisputeFileFormProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasV3) {
    return (
      <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200">
        <h3 className="font-display font-bold text-amber-900 mb-2">
          Inspection Video Required
        </h3>
        <p className="text-amber-700 text-sm">
          You must record an inspection video (V3) before filing a dispute.
          Go back and use the &ldquo;Record Inspection&rdquo; button first.
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!reason) {
      setError("Please select a reason for the dispute.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/disputes/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: transactionId,
          reason,
          description: description || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to file dispute");
      }

      onDisputeFiled(data.dispute);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-white border border-inventory-200 space-y-5">
      <div>
        <h3 className="font-display font-bold text-lg text-inventory-900">
          File a Dispute
        </h3>
        <p className="text-inventory-500 text-sm mt-1">
          Describe the damage or issue. Your inspection video and condition
          checklist (if available) will be included as evidence.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Reason selection */}
      <div>
        <label className="block text-sm font-medium text-inventory-700 mb-2">
          Reason
        </label>
        <div className="grid grid-cols-1 gap-2">
          {DISPUTE_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                reason === r
                  ? "border-accent bg-accent/5 text-accent font-medium"
                  : "border-inventory-200 text-inventory-600 hover:border-inventory-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-inventory-700 mb-2">
          Describe the issue (optional but recommended)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-inventory-200 text-sm 
                     focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
                     placeholder:text-inventory-400"
          placeholder="What specific damage did you find? Where on the item is it?"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !reason}
          className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-display font-semibold text-sm
                     hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Filing..." : "File Dispute"}
        </button>
        <button
          onClick={onCancel}
          className="py-3 px-6 border-2 border-inventory-200 text-inventory-600 rounded-2xl 
                     font-display font-semibold text-sm hover:border-inventory-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
