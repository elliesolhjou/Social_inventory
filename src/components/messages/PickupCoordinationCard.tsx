"use client";

import { useState } from "react";

interface PickupCoordinationCardProps {
  transactionId: string;
  itemTitle: string;
  partnerName: string;
  userUnitNumber: string;
  recipientId: string;
  currentUserId: string;
  onSent?: () => void;
}

export default function PickupCoordinationCard({
  transactionId,
  itemTitle,
  partnerName,
  userUnitNumber,
  recipientId,
  currentUserId,
  onSent,
}: PickupCoordinationCardProps) {
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Quick location options
  const quickLocations = [
    { label: "Leasing office", value: "Leasing office" },
    { label: `At my unit (${userUnitNumber})`, value: `Unit ${userUnitNumber}` },
  ];

  // Generate date options (today + next 3 days)
  function getDateOptions() {
    const options: { label: string; value: string }[] = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dayLabel =
        i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      options.push({
        label: dayLabel,
        value: d.toISOString().split("T")[0],
      });
    }
    return options;
  }

  // Generate time slot options
  const timeSlots = [
    { label: "8:00 AM", value: "08:00" },
    { label: "9:00 AM", value: "09:00" },
    { label: "10:00 AM", value: "10:00" },
    { label: "11:00 AM", value: "11:00" },
    { label: "12:00 PM", value: "12:00" },
    { label: "1:00 PM", value: "13:00" },
    { label: "2:00 PM", value: "14:00" },
    { label: "3:00 PM", value: "15:00" },
    { label: "4:00 PM", value: "16:00" },
    { label: "5:00 PM", value: "17:00" },
    { label: "6:00 PM", value: "18:00" },
    { label: "7:00 PM", value: "19:00" },
    { label: "8:00 PM", value: "20:00" },
    { label: "9:00 PM", value: "21:00" },
  ];

  const finalLocation = location === "custom" ? customLocation : location;
  const canSend = finalLocation.trim() && selectedDate && selectedTime;

  // Format the pickup message
  function buildMessage() {
    const dateObj = new Date(`${selectedDate}T${selectedTime}`);
    const dateStr = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    const timeStr = dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    let msg = `Pickup for "${itemTitle}"\n📍 ${finalLocation}\n📅 ${dateStr} at ${timeStr}`;
    if (note.trim()) {
      msg += `\n💬 ${note.trim()}`;
    }
    return msg;
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: recipientId,
          content: buildMessage(),
          message_type: "pickup_proposal",
          topic: transactionId,
          payload: {
            transaction_id: transactionId,
            item_title: itemTitle,
            location: finalLocation,
            date: selectedDate,
            time: selectedTime,
            note: note.trim() || null,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send");
      }

      setSent(true);
      onSent?.();
    } catch (err) {
      console.error("Failed to send pickup proposal:", err);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-3 max-w-[320px]">
        <p className="text-xs font-medium text-green-800">
          Pickup proposal sent to {partnerName}!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 bg-white p-4 max-w-[320px]">
      {/* Header */}
      <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-3">
        Coordinate pickup
      </p>

      {/* Location */}
      <label className="block text-[11px] font-medium text-inventory-400 uppercase tracking-wider mb-1.5">
        Where
      </label>
      <div className="flex gap-1.5 mb-2">
        {quickLocations.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setLocation(opt.value);
              setCustomLocation("");
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors
              ${location === opt.value
                ? "bg-accent/10 text-accent border-accent"
                : "bg-inventory-50 text-inventory-600 border-inventory-200 hover:border-inventory-300"
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => setLocation("custom")}
        className={`w-full text-left mb-1 ${location === "custom" ? "" : "hidden"}`}
      >
      </button>
      {location !== "custom" ? (
        <button
          onClick={() => setLocation("custom")}
          className="text-[11px] text-accent hover:underline mb-3"
        >
          Or type a custom location...
        </button>
      ) : (
        <input
          type="text"
          value={customLocation}
          onChange={(e) => setCustomLocation(e.target.value)}
          placeholder="e.g. Pool area, Parking garage P1..."
          autoFocus
          className="w-full px-3 py-2 rounded-lg border border-inventory-200 text-sm focus:border-accent outline-none mb-3"
        />
      )}

      {/* Date */}
      <label className="block text-[11px] font-medium text-inventory-400 uppercase tracking-wider mb-1.5">
        When
      </label>
      <div className="flex gap-1 mb-2 flex-wrap">
        {getDateOptions().map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedDate(opt.value)}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border transition-colors
              ${selectedDate === opt.value
                ? "bg-accent/10 text-accent border-accent"
                : "bg-inventory-50 text-inventory-600 border-inventory-200 hover:border-inventory-300"
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Time */}
      {selectedDate && (
        <select
          value={selectedTime}
          onChange={(e) => setSelectedTime(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-inventory-200 text-sm focus:border-accent outline-none mb-3 bg-white"
        >
          <option value="">Select time...</option>
          {timeSlots.map((slot) => (
            <option key={slot.value} value={slot.value}>
              {slot.label}
            </option>
          ))}
        </select>
      )}

      {/* Optional note */}
      {canSend && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`Note for ${partnerName.split(" ")[0]} (optional)...`}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-inventory-200 text-sm focus:border-accent outline-none resize-none mb-3"
        />
      )}

      {/* Preview */}
      {canSend && (
        <div className="p-2.5 rounded-lg bg-inventory-50 border border-inventory-100 mb-3">
          <p className="text-xs text-inventory-600 whitespace-pre-line leading-relaxed">
            {buildMessage()}
          </p>
        </div>
      )}

      {/* Send */}
      <button
        onClick={handleSend}
        disabled={!canSend || sending}
        className="w-full py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-dark disabled:opacity-50 transition-colors"
      >
        {sending ? "Sending..." : "Send pickup proposal"}
      </button>
    </div>
  );
}
