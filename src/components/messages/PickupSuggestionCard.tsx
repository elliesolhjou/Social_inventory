"use client";

import { useState } from "react";

interface PickupSuggestionCardProps {
  transactionId: string;
  currentUserId: string;
  ownerId: string;
  borrowerId: string;
  suggestedLocation: string | null;
  suggestedDate: string | null;
  suggestedTime: string | null;
  suggestedNote: string | null;
  dateDisplay: string | null;
  timeDisplay: string | null;
  confidence: number;
  transactionState: string;
}

export default function PickupSuggestionCard({
  transactionId,
  currentUserId,
  ownerId,
  borrowerId,
  suggestedLocation,
  suggestedDate,
  suggestedTime,
  suggestedNote,
  dateDisplay,
  timeDisplay,
  confidence,
  transactionState,
}: PickupSuggestionCardProps) {
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [bothConfirmed, setBothConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing state — user can tweak before confirming
  const [editMode, setEditMode] = useState(false);
  const [location, setLocation] = useState(suggestedLocation ?? "");
  const [date, setDate] = useState(suggestedDate ?? "");
  const [time, setTime] = useState(suggestedTime ?? "");

  const isOwner = currentUserId === ownerId;

  // Not eligible for logistics
  if (!["approved", "deposit_held"].includes(transactionState)) {
    return null;
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/transactions/${transactionId}/confirm-logistics`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: location || null,
            date: date || null,
            time: time || null,
            note: suggestedNote,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to confirm");
      }

      const data = await res.json();
      setConfirmed(true);

      if (data.both_confirmed) {
        setBothConfirmed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Both confirmed
  if (bothConfirmed) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-3 max-w-[320px] mx-auto">
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs font-semibold text-green-800">Pickup details locked in!</span>
        </div>
        {location && <p className="text-xs text-green-700">📍 {location}</p>}
        {dateDisplay && <p className="text-xs text-green-700">📅 {dateDisplay}</p>}
        {timeDisplay && <p className="text-xs text-green-700">🕐 {timeDisplay}</p>}
      </div>
    );
  }

  // I confirmed, waiting for the other
  if (confirmed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 max-w-[320px] mx-auto">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs font-medium text-amber-800">
            You confirmed — waiting for {isOwner ? "borrower" : "owner"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 max-w-[320px] mx-auto">
      {/* Miles header */}
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
          <span className="text-[10px] text-white font-bold">M</span>
        </div>
        <span className="text-xs font-semibold text-accent">Miles detected pickup details</span>
      </div>

      {/* Suggested details */}
      {!editMode ? (
        <div className="space-y-1 mb-3">
          {suggestedLocation && (
            <p className="text-sm text-foreground">📍 {suggestedLocation}</p>
          )}
          {dateDisplay && (
            <p className="text-sm text-foreground">📅 {dateDisplay}</p>
          )}
          {timeDisplay && (
            <p className="text-sm text-foreground">🕐 {timeDisplay}</p>
          )}
          {suggestedNote && (
            <p className="text-xs text-muted-foreground mt-1">💬 {suggestedNote}</p>
          )}
        </div>
      ) : (
        /* Edit mode — inline fields */
        <div className="space-y-2 mb-3">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="w-full px-3 py-1.5 rounded-lg border border-border text-sm focus:border-accent outline-none"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-border text-sm focus:border-accent outline-none"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-border text-sm focus:border-accent outline-none"
          />
        </div>
      )}

      {/* Confidence indicator */}
      {confidence < 0.85 && (
        <p className="text-[10px] text-muted-foreground mb-2">
          Confidence: {Math.round(confidence * 100)}% — you can edit before confirming
        </p>
      )}

      {error && <p className="text-[11px] text-red-600 mb-2">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 py-2 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-dark disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-1.5">
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Confirming...
            </span>
          ) : (
            "Confirm pickup details"
          )}
        </button>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
