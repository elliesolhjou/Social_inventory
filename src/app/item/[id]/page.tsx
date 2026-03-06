"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import SearchBar from "@/components/SearchBar";

type Item = {
  id: string;
  title: string;
  description: string;
  ai_description: string;
  category: string;
  subcategory: string;
  ai_condition: string;
  deposit_cents: number;
  max_borrow_days: number;
  rules: string;
  status: string;
  times_borrowed: number;
  metadata: {
    brand?: string;
    model?: string;
    color?: string;
    year?: number;
    original_price_cents?: number;
  };
  owner: {
    id: string;
    username: string;
    display_name: string;
    trust_score: number;
    reputation_tags: string[];
    unit_number: string;
  };
};

function MessagePopup({
  owner,
  itemTitle,
  onClose,
}: {
  owner: Item["owner"];
  itemTitle: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState(
    `Hi ${owner.display_name}! I'm interested in borrowing your ${itemTitle}. Is it available?`,
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let senderId = user?.id;
      if (!senderId) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .neq("id", owner.id)
          .limit(1)
          .single();
        senderId = profiles?.id;
      }
      if (senderId) {
        await supabase.from("messages").insert({
          sender_id: senderId,
          recipient_id: owner.id,
          content: message.trim(),
          message_type: "item_inquiry",
        });
      }
      setSent(true);
      setTimeout(onClose, 1800);
    } catch {
      setSent(true);
      setTimeout(onClose, 1800);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full animate-slide-up">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-inventory-200">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-inventory-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="font-bold text-accent text-sm">
                  {owner.display_name?.[0] ?? "?"}
                </span>
              </div>
              <div>
                <p className="font-display font-bold text-sm">
                  {owner.display_name}
                </p>
                <p className="text-xs text-inventory-400">
                  Unit {owner.unit_number}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-inventory-100 flex items-center justify-center hover:bg-inventory-200 transition-colors"
            >
              <svg
                className="w-4 h-4 text-inventory-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="px-6 py-4">
            {sent ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-14 h-14 rounded-full bg-trust-high/10 flex items-center justify-center mb-3">
                  <span className="text-3xl">✓</span>
                </div>
                <p className="font-display font-bold text-lg">Message sent!</p>
                <p className="text-inventory-500 text-sm mt-1">
                  {owner.display_name} will be notified
                </p>
              </div>
            ) : (
              <>
                <label className="block text-xs font-bold text-inventory-400 uppercase tracking-widest mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm resize-none transition-colors"
                  placeholder="Write your message..."
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="w-full mt-3 py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      Send Message
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TrustBadge({ score }: { score: number }) {
  const level = score >= 85 ? "high" : score >= 60 ? "medium" : "low";
  const colors = {
    high: "bg-trust-high/10 text-trust-high",
    medium: "bg-trust-medium/10 text-trust-medium",
    low: "bg-trust-low/10 text-trust-low",
  };
  const labels = { high: "Trusted", medium: "Good", low: "New" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${colors[level]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {labels[level]} · {score.toFixed(0)}
    </span>
  );
}

function ConditionBadge({ condition }: { condition: string }) {
  const map: Record<string, { label: string; color: string }> = {
    like_new: { label: "Like New", color: "bg-trust-high/10 text-trust-high" },
    good: { label: "Good", color: "bg-blue-50 text-blue-600" },
    fair: { label: "Fair", color: "bg-trust-medium/10 text-trust-medium" },
    worn: { label: "Well Used", color: "bg-inventory-100 text-inventory-600" },
  };
  const c = map[condition] ?? {
    label: condition,
    color: "bg-inventory-100 text-inventory-600",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${c.color}`}
    >
      {c.label}
    </span>
  );
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    electronics: "📱",
    kitchen: "🍳",
    outdoor: "⛺",
    sports: "🏋️",
    tools: "🔧",
    entertainment: "🎮",
    home: "🏠",
    wellness: "🧘",
    travel: "✈️",
    creative: "🎨",
    beauty: "💇",
    clothing: "👗",
    baby_kids: "🧸",
    music: "🎵",
    automotive: "🚗",
  };
  return map[category] ?? "📦";
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMessage, setShowMessage] = useState(false);
  const [borrowRequested, setBorrowRequested] = useState(false);
  const supabase = createClient();

  // Search navigates to dashboard with query
  const handleSearch = useCallback(
    (q: string) => {
      if (q.trim()) router.push(`/dashboard?q=${encodeURIComponent(q)}`);
    },
    [router],
  );

  useEffect(() => {
    const fetchItem = async () => {
      const { data, error } = await supabase
        .from("items")
        .select(
          "*, owner:profiles(id, username, display_name, trust_score, reputation_tags, unit_number)",
        )
        .eq("id", params.id)
        .single();
      if (error || !data) {
        router.push("/dashboard");
        return;
      }
      setItem(data);
      setLoading(false);
    };
    fetchItem();
  }, [params.id]);

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
      </main>
    );
  if (!item) return null;

  const isAvailable = item.status === "available";

  return (
    <main className="min-h-screen pb-24">
      {/* Header with search */}
      <header className="sticky top-0 z-40 glass border-b border-inventory-200/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-inventory-500 hover:text-inventory-900 transition-colors flex-shrink-0"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="text-sm font-medium hidden sm:block">Back</span>
            </Link>
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search other items..."
              className="flex-1"
            />
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0 ${isAvailable ? "bg-trust-high/10 text-trust-high" : "bg-inventory-100 text-inventory-500"}`}
            >
              {isAvailable ? "Available" : item.status}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Hero */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="h-56 sm:h-72 bg-gradient-to-br from-inventory-100 to-inventory-200 flex items-center justify-center relative">
            <span className="text-8xl opacity-30">
              {getCategoryEmoji(item.category)}
            </span>
            <div className="absolute bottom-4 left-4 flex gap-2">
              <ConditionBadge condition={item.ai_condition} />
              {item.times_borrowed > 0 && (
                <span className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-inventory-600">
                  Borrowed {item.times_borrowed}×
                </span>
              )}
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h1 className="font-display text-2xl font-bold leading-tight">
                {item.title}
              </h1>
              {item.metadata?.brand && (
                <span className="text-xs font-mono text-inventory-400 whitespace-nowrap mt-1">
                  {item.metadata.brand} {item.metadata.model ?? ""}
                </span>
              )}
            </div>
            <p className="text-inventory-600 text-sm leading-relaxed">
              {item.description}
            </p>
            {item.ai_description && (
              <div className="mt-4 p-4 rounded-2xl bg-inventory-50 border border-inventory-100">
                <p className="text-xs font-bold text-inventory-400 uppercase tracking-widest mb-1.5">
                  VisionAgent Notes
                </p>
                <p className="text-sm text-inventory-600 leading-relaxed">
                  {item.ai_description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Borrow Details */}
        <div className="glass rounded-3xl p-6">
          <h2 className="font-display text-sm font-bold text-inventory-400 uppercase tracking-widest mb-4">
            Borrow Details
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="text-center p-4 rounded-2xl bg-inventory-50">
              <p className="text-2xl font-display font-bold text-accent">
                ${(item.deposit_cents / 100).toFixed(0)}
              </p>
              <p className="text-xs text-inventory-400 mt-1">Deposit</p>
            </div>
            <div className="text-center p-4 rounded-2xl bg-inventory-50">
              <p className="text-2xl font-display font-bold">
                {item.max_borrow_days}
              </p>
              <p className="text-xs text-inventory-400 mt-1">Max days</p>
            </div>
            <div className="text-center p-4 rounded-2xl bg-inventory-50">
              <p className="text-2xl font-display font-bold text-trust-high">
                $0
              </p>
              <p className="text-xs text-inventory-400 mt-1">Fee</p>
            </div>
          </div>
          {item.rules && (
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100">
              <span className="text-lg mt-0.5">📋</span>
              <p className="text-sm text-amber-800">{item.rules}</p>
            </div>
          )}
        </div>

        {/* Owner */}
        {item.owner && (
          <div className="glass rounded-3xl p-6">
            <h2 className="font-display text-sm font-bold text-inventory-400 uppercase tracking-widest mb-4">
              Listed By
            </h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-display font-bold text-xl text-accent">
                    {item.owner.display_name?.[0] ?? "?"}
                  </span>
                </div>
                <div>
                  <p className="font-display font-bold text-base">
                    {item.owner.display_name}
                  </p>
                  <p className="text-sm text-inventory-400">
                    @{item.owner.username} ·
                  </p>
                  <div className="mt-2">
                    <TrustBadge score={item.owner.trust_score} />
                  </div>
                </div>
              </div>
            </div>
            {item.owner.reputation_tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-inventory-100">
                {item.owner.reputation_tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1 rounded-full bg-inventory-100 text-inventory-600 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 glass border-t border-inventory-200/50">
        <div className="max-w-3xl mx-auto flex gap-3">
          <button
            onClick={() => setShowMessage(true)}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border-2 border-inventory-200 text-inventory-700 font-display font-semibold text-sm hover:border-accent hover:text-accent transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            Message
          </button>
          <button
            onClick={() => setBorrowRequested(true)}
            disabled={!isAvailable || borrowRequested}
            className="flex-1 py-3.5 rounded-2xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: borrowRequested
                ? "var(--color-trust-high)"
                : isAvailable
                  ? "var(--color-accent)"
                  : "var(--color-inventory-200)",
              color:
                isAvailable || borrowRequested
                  ? "white"
                  : "var(--color-inventory-500)",
            }}
          >
            {borrowRequested ? (
              <>✓ Request Sent</>
            ) : isAvailable ? (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                Request to Borrow · ${(item.deposit_cents / 100).toFixed(0)}{" "}
                deposit
              </>
            ) : (
              "Currently Unavailable"
            )}
          </button>
        </div>
      </div>

      {showMessage && item.owner && (
        <MessagePopup
          owner={item.owner}
          itemTitle={item.title}
          onClose={() => setShowMessage(false)}
        />
      )}
    </main>
  );
}
