"use client";

import { useState } from "react";

interface DisputeResolveFormProps {
  disputeId: string;
  depositCents: number;
  onResolved: (result: { resolution: string; deposit_captured_cents: number }) => void;
}

type Resolution = "resolved_owner" | "resolved_borrower" | "dismissed";

const RESOLUTIONS: {
  value: Resolution;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: "resolved_owner",
    label: "Owner's favor — Capture deposit",
    description: "Borrower caused damage. Capture full or partial deposit.",
    color: "border-red-300 bg-red-50",
  },
  {
    value: "resolved_borrower",
    label: "Borrower's favor — Release deposit",
    description: "No damage found or damage was pre-existing. Release deposit.",
    color: "border-green-300 bg-green-50",
  },
  {
    value: "dismissed",
    label: "Dismiss — Release deposit",
    description: "Insufficient evidence or invalid dispute. Release deposit.",
    color: "border-inventory-300 bg-inventory-50",
  },
];

export default function DisputeResolveForm({
  disputeId,
  depositCents,
  onResolved,
}: DisputeResolveFormProps) {
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [notes, setNotes] = useState("");
  const [captureAmount, setCaptureAmount] = useState(
    (depositCents / 100).toFixed(2)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!resolution) {
      setError("Select a resolution.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const captureCents =
        resolution === "resolved_owner"
          ? Math.round(parseFloat(captureAmount) * 100)
          : 0;

      const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution,
          resolution_notes: notes || undefined,
          capture_cents: captureCents > 0 ? captureCents : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Resolution failed");

      onResolved({
        resolution: data.resolution,
        deposit_captured_cents: data.deposit_captured_cents,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-white border-2 border-accent/30 space-y-5">
      <div>
        <h3 className="font-display font-bold text-lg text-inventory-900">
          Resolve Dispute
        </h3>
        <p className="text-inventory-500 text-sm mt-1">
          Deposit held: ${(depositCents / 100).toFixed(2)}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Resolution options */}
      <div className="space-y-2">
        {RESOLUTIONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setResolution(r.value)}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
              resolution === r.value
                ? r.color + " border-current"
                : "border-inventory-200 hover:border-inventory-300"
            }`}
          >
            <p className="text-sm font-medium text-inventory-900">{r.label}</p>
            <p className="text-xs text-inventory-500 mt-0.5">{r.description}</p>
          </button>
        ))}
      </div>

      {/* Capture amount (only for owner's favor) */}
      {resolution === "resolved_owner" && (
        <div>
          <label className="block text-sm font-medium text-inventory-700 mb-2">
            Amount to capture ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={(depositCents / 100).toFixed(2)}
            value={captureAmount}
            onChange={(e) => setCaptureAmount(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-inventory-200 text-sm
                       focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <p className="text-xs text-inventory-400 mt-1">
            Max: ${(depositCents / 100).toFixed(2)}
          </p>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-inventory-700 mb-2">
          Resolution notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-inventory-200 text-sm
                     focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
                     placeholder:text-inventory-400"
          placeholder="Explain your decision..."
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !resolution}
        className="w-full py-3.5 bg-accent text-white rounded-2xl font-display font-semibold text-sm
                   hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Processing..." : "Confirm Resolution"}
      </button>
    </div>
  );
}
