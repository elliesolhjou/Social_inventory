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
  building_id: string;
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
    `Hi ${owner.display_name}! I'm interested in borrowing your ${itemTitle}. Please let me know if I can borrow it?`,
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
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [borrowError, setBorrowError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [showBorrowPrompt, setShowBorrowPrompt] = useState(false);
  const [borrowDays, setBorrowDays] = useState(3);
  const [customDays, setCustomDays] = useState(false);
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

      // Check if logged-in user is the owner
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsOwner(user?.id === data.owner?.id);

      // Check if user already has a pending/active request for this item
      if (user && user.id !== data.owner?.id) {
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("item_id", data.id)
          .eq("borrower_id", user.id)
          .in("state", [
            "requested",
            "pending",
            "approved",
            "deposit_held",
            "active",
          ])
          .limit(1);

        if (existing && existing.length > 0) {
          setBorrowRequested(true);
        }
      }

      setLoading(false);
    };
    fetchItem();
  }, [params.id]);

  // ── Borrow request handler ────────────────────────────────────────────────
  const handleBorrowRequest = async () => {
    if (!item || borrowRequested || borrowLoading) return;
    setBorrowLoading(true);
    setBorrowError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }

      // Prevent borrowing your own item
      if (user.id === item.owner?.id) return;

      // Check for duplicate request
      const { data: existing } = await supabase
        .from("transactions")
        .select("id")
        .eq("item_id", item.id)
        .eq("borrower_id", user.id)
        .in("state", [
          "requested",
          "pending",
          "approved",
          "deposit_held",
          "active",
        ])
        .limit(1);

      if (existing && existing.length > 0) {
        setBorrowRequested(true);
        return;
      }

      // Calculate due date based on borrower's requested days
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + borrowDays);

      // 1. Create transaction
      const { data: txn, error: txnError } = await supabase
        .from("transactions")
        .insert({
          item_id: item.id,
          borrower_id: user.id,
          owner_id: item.owner.id,
          building_id: item.building_id,
          state: "requested",
          deposit_held: item.deposit_cents,
          due_at: dueAt.toISOString(),
          borrow_days: borrowDays,
          requested_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (txnError) throw txnError;

      // 2. Get borrower profile for the message
      const { data: borrowerProfile } = await supabase
        .from("profiles")
        .select("display_name, unit_number, avatar_url")
        .eq("id", user.id)
        .single();

      const borrowerName = borrowerProfile?.display_name ?? "A neighbor";

      // 3. Create borrow_requests row (for the requests dashboard)
      await supabase.from("borrow_requests").insert({
        transaction_id: txn.id,
        item_id: item.id,
        borrower_id: user.id,
        owner_id: item.owner.id,
        item_title: item.title,
        item_photo_url: null,
        borrower_display_name: borrowerProfile?.display_name ?? null,
        borrower_avatar_url: borrowerProfile?.avatar_url ?? null,
        status: "requested",
        request_message: `I'd like to borrow your ${item.title} for ${borrowDays} day${borrowDays !== 1 ? "s" : ""} with a $${(item.deposit_cents / 100).toFixed(0)} deposit hold.`,
        requested_at: new Date().toISOString(),
      });

      // 4. Log state change
      await supabase.from("transaction_state_log").insert({
        transaction_id: txn.id,
        from_state: null,
        to_state: "requested",
        changed_by: user.id,
        change_reason: "borrower_requested",
      });

      // 5. Send notification message to owner WITH payload
      await supabase.from("messages").insert({
        sender_id: user.id,
        recipient_id: item.owner.id,
        content: `Hi ${item.owner.display_name}! I'd like to borrow your ${item.title} for ${borrowDays} day${borrowDays !== 1 ? "s" : ""}. I've submitted a borrow request with a $${(item.deposit_cents / 100).toFixed(0)} deposit hold. Let me know if that works for you!`,
        message_type: "borrow_request",
        topic: item.id,
        payload: {
          transaction_id: txn.id,
          item_id: item.id,
          item_title: item.title,
          item_photo_url: null,
          borrower_name: borrowerName,
          borrower_avatar_url: borrowerProfile?.avatar_url ?? null,
          deposit_amount_cents: item.deposit_cents,
          condition: item.ai_condition,
          borrow_days: borrowDays,
        },
      });

      setBorrowRequested(true);
      setShowBorrowPrompt(false);
    } catch (err: any) {
      console.error("Borrow request failed:", err);
      setBorrowError(err.message || "Failed to send borrow request.");
    } finally {
      setBorrowLoading(false);
    }
  };

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
      </main>
    );
  if (!item) return null;

  const isAvailable = (item as any).availability_status
    ? (item as any).availability_status === "available"
    : item.status === "available";

  const availabilityLabel =
    (item as any).availability_status === "borrowed"
      ? "Borrowed"
      : (item as any).availability_status === "reserved"
        ? "Reserved"
        : isAvailable
          ? "Available"
          : item.status;

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
              className={`text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0 ${
                isAvailable
                  ? "bg-trust-high/10 text-trust-high"
                  : availabilityLabel === "Borrowed"
                    ? "bg-red-50 text-red-600"
                    : availabilityLabel === "Reserved"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-inventory-100 text-inventory-500"
              }`}
            >
              {availabilityLabel}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Hero */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="h-56 sm:h-72 bg-gradient-to-br from-inventory-100 to-inventory-200 flex items-center justify-center relative overflow-hidden">
            {item.thumbnail_url ? (
              <img
                src={item.thumbnail_url}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-8xl opacity-30">
                {getCategoryEmoji(item.category)}
              </span>
            )}
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
            <Link href={`/profile/${item.owner.id}`}>
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
                      @{item.owner.username}
                    </p>
                    <div className="mt-2">
                      <TrustBadge score={item.owner.trust_score} />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
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

        {/* Borrow error */}
        {borrowError && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
            <span className="text-red-500 text-xs mt-0.5">⚠</span>
            <p className="text-red-600 text-xs leading-relaxed">
              {borrowError}
            </p>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 glass border-t border-inventory-200/50">
        <div className="max-w-3xl mx-auto flex gap-3">
          {isOwner ? (
            // Owner view — manage item
            <>
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border-2 border-inventory-200 text-inventory-700 font-display font-semibold text-sm hover:border-accent hover:text-accent transition-colors"
              >
                ← Dashboard
              </Link>
              <div className="flex-1 py-3.5 rounded-2xl bg-inventory-100 text-inventory-500 font-display font-bold text-sm flex items-center justify-center gap-2">
                <span>🏠</span> This is your item
              </div>
            </>
          ) : (
            // Borrower view
            <>
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
                onClick={() => setShowBorrowPrompt(true)}
                disabled={!isAvailable || borrowRequested || borrowLoading}
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
                {borrowLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Requesting...
                  </>
                ) : borrowRequested ? (
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
            </>
          )}
        </div>
      </div>

      {showMessage && item.owner && (
        <MessagePopup
          owner={item.owner}
          itemTitle={item.title}
          onClose={() => setShowMessage(false)}
        />
      )}

      {showBorrowPrompt && item && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={() => setShowBorrowPrompt(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-sm sm:w-full animate-slide-up">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-inventory-200">
              <div className="px-6 pt-6 pb-4 border-b border-inventory-100">
                <h3 className="font-display font-bold text-base">
                  How long do you need it?
                </h3>
                <p className="text-xs text-inventory-400 mt-1">
                  {item.title} · Max {item.max_borrow_days} days
                </p>
              </div>

              <div className="px-6 py-5">
                {/* Quick day buttons + custom input */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {[1, 2, 3, 5, 7]
                    .filter((d) => d <= item.max_borrow_days)
                    .map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          setBorrowDays(d);
                          setCustomDays(false);
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
                          borrowDays === d && !customDays
                            ? "bg-accent text-white"
                            : "bg-inventory-100 text-inventory-600 hover:bg-inventory-200"
                        }`}
                      >
                        {d} day{d !== 1 ? "s" : ""}
                      </button>
                    ))}
                  <button
                    onClick={() => setCustomDays(true)}
                    className={`px-4 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
                      customDays
                        ? "bg-accent text-white"
                        : "bg-inventory-100 text-inventory-600 hover:bg-inventory-200"
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {customDays && (
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="number"
                      min={1}
                      max={item.max_borrow_days}
                      value={borrowDays}
                      onChange={(e) => {
                        const val = Math.min(
                          Math.max(1, Number(e.target.value)),
                          item.max_borrow_days,
                        );
                        setBorrowDays(val);
                      }}
                      className="w-20 px-3 py-2 rounded-xl border-2 border-inventory-200 focus:border-accent outline-none text-sm text-center font-display font-bold"
                      autoFocus
                    />
                    <span className="text-sm text-inventory-500">
                      day{borrowDays !== 1 ? "s" : ""} (max{" "}
                      {item.max_borrow_days})
                    </span>
                  </div>
                )}
                {/* Custom slider for more precision */}
                {item.max_borrow_days > 7 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-inventory-400 uppercase tracking-widest">
                        Or choose
                      </label>
                      <span className="text-sm font-display font-bold text-accent">
                        {borrowDays} day{borrowDays !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={item.max_borrow_days}
                      value={borrowDays}
                      onChange={(e) => setBorrowDays(Number(e.target.value))}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-inventory-400 mt-1">
                      <span>1 day</span>
                      <span>{item.max_borrow_days} days</span>
                    </div>
                  </div>
                )}
                {/* Summary */}
                <div className="p-3 rounded-2xl bg-inventory-50 mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-inventory-500">Duration</span>
                    <span className="font-display font-bold">
                      {borrowDays} day{borrowDays !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-inventory-500">Deposit hold</span>
                    <span className="font-display font-bold">
                      ${(item.deposit_cents / 100).toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-inventory-500">Fee</span>
                    <span className="font-display font-bold text-trust-high">
                      Free
                    </span>
                  </div>
                </div>
                {/* Confirm button */}
                <button
                  onClick={handleBorrowRequest}
                  disabled={borrowLoading}
                  className="w-full py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {borrowLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending request...
                    </>
                  ) : (
                    <>Send borrow request</>
                  )}
                </button>
                <button
                  onClick={() => setShowBorrowPrompt(false)}
                  className="w-full mt-2 py-2 text-xs text-inventory-400 hover:text-inventory-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
