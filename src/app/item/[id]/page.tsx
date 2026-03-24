"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import UserMenu from "@/components/UserMenu";

type Item = {
  id: string;
  title: string;
  description: string;
  ai_description: string;
  category: string;
  subcategory: string;
  ai_condition: string;
  deposit_cents: number;
  thumbnail_url: string | null;
  borrow_available: boolean;
  rent_available: boolean;
  sell_available: boolean;
  rent_price_day_cents: number | null;
  rent_price_month_cents: number | null;
  sell_price_cents: number | null;
  estimated_market_value_cents: number | null;
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

/* ── Message Popup ─────────────────────────────────────────────────────── */
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
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full animate-slide-up">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#e6e2de]/50">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#e6e2de]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ae3200]/10 flex items-center justify-center">
                <span className="font-bold text-[#ae3200] text-sm font-['Plus_Jakarta_Sans']">{owner.display_name?.[0] ?? "?"}</span>
              </div>
              <div>
                <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#1c1b1a]">{owner.display_name}</p>
                <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">Unit {owner.unit_number}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#f7f3ef] flex items-center justify-center hover:bg-[#ebe7e4] transition-colors">
              <svg className="w-4 h-4 text-[#5b4038]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-6 py-4">
            {sent ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#526442]/10 flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-[#526442]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1c1b1a]">Message sent!</p>
                <p className="text-[#8f7067] text-sm mt-1 font-['Be_Vietnam_Pro']">{owner.display_name} will be notified</p>
              </div>
            ) : (
              <>
                <label className="block text-xs font-bold text-[#5b4038] uppercase tracking-widest mb-2 font-['Plus_Jakarta_Sans']">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm resize-none transition-colors font-['Be_Vietnam_Pro'] text-[#1c1b1a]"
                  placeholder="Write your message..."
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="w-full mt-3 py-3.5 bg-[#ae3200] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
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

/* ── Condition Badge ───────────────────────────────────────────────────── */
function ConditionBadge({ condition }: { condition: string }) {
  const map: Record<string, { label: string; color: string }> = {
    like_new: { label: "Like New", color: "bg-[#d2e6bc] text-[#3b4c2c]" },
    good: { label: "Good", color: "bg-[#e6e2de] text-[#5b4038]" },
    fair: { label: "Fair", color: "bg-[#ffdbd0] text-[#852400]" },
    worn: { label: "Well Used", color: "bg-[#ebe7e4] text-[#5b4038]" },
  };
  const c = map[condition] ?? { label: condition, color: "bg-[#ebe7e4] text-[#5b4038]" };
  return (
    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wide font-['Plus_Jakarta_Sans'] ${c.color}`}>
      {c.label}
    </span>
  );
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
        .select("*, owner:profiles(id, username, display_name, trust_score, reputation_tags, unit_number)")
        .eq("id", params.id)
        .single();
      if (error || !data) { router.push("/dashboard"); return; }
      setItem(data);

      const { data: { user } } = await supabase.auth.getUser();
      setIsOwner(user?.id === data.owner?.id);

      if (user && user.id !== data.owner?.id) {
        const { data: existing } = await supabase
          .from("transactions").select("id")
          .eq("item_id", data.id).eq("borrower_id", user.id)
          .in("state", ["requested", "pending", "approved", "deposit_held", "active"])
          .limit(1);
        if (existing && existing.length > 0) setBorrowRequested(true);
      }
      setLoading(false);
    };
    fetchItem();
  }, [params.id]);

  const handleBorrowRequest = async () => {
    if (!item || borrowRequested || borrowLoading) return;
    setBorrowLoading(true);
    setBorrowError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      if (user.id === item.owner?.id) return;

      const { data: existing } = await supabase
        .from("transactions").select("id")
        .eq("item_id", item.id).eq("borrower_id", user.id)
        .in("state", ["requested", "pending", "approved", "deposit_held", "active"])
        .limit(1);
      if (existing && existing.length > 0) { setBorrowRequested(true); return; }

      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + borrowDays);

      const { data: txn, error: txnError } = await supabase
        .from("transactions")
        .insert({
          item_id: item.id, borrower_id: user.id, owner_id: item.owner.id,
          building_id: item.building_id, state: "requested",
          deposit_held: item.deposit_cents, due_at: dueAt.toISOString(),
          borrow_days: borrowDays, requested_at: new Date().toISOString(),
        })
        .select("id").single();
      if (txnError) throw txnError;

      const { data: borrowerProfile } = await supabase
        .from("profiles").select("display_name, unit_number, avatar_url")
        .eq("id", user.id).single();
      const borrowerName = borrowerProfile?.display_name ?? "A neighbor";

      await supabase.from("borrow_requests").insert({
        transaction_id: txn.id, item_id: item.id, borrower_id: user.id,
        owner_id: item.owner.id, item_title: item.title, item_photo_url: null,
        borrower_display_name: borrowerProfile?.display_name ?? null,
        borrower_avatar_url: borrowerProfile?.avatar_url ?? null,
        status: "requested",
        request_message: `I'd like to borrow your ${item.title} for ${borrowDays} day${borrowDays !== 1 ? "s" : ""} with a $${(item.deposit_cents / 100).toFixed(0)} deposit hold.`,
        requested_at: new Date().toISOString(),
      });

      await supabase.from("transaction_state_log").insert({
        transaction_id: txn.id, from_state: null, to_state: "requested",
        changed_by: user.id, change_reason: "borrower_requested",
      });

      await supabase.from("messages").insert({
        sender_id: user.id, recipient_id: item.owner.id,
        content: `Hi ${item.owner.display_name}! I'd like to borrow your ${item.title} for ${borrowDays} day${borrowDays !== 1 ? "s" : ""}. I've submitted a borrow request with a $${(item.deposit_cents / 100).toFixed(0)} deposit hold. Let me know if that works for you!`,
        message_type: "borrow_request", topic: item.id,
        payload: {
          transaction_id: txn.id, item_id: item.id, item_title: item.title,
          item_photo_url: null, borrower_name: borrowerName,
          borrower_avatar_url: borrowerProfile?.avatar_url ?? null,
          deposit_amount_cents: item.deposit_cents, condition: item.ai_condition,
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

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center bg-[#fdf9f5]">
      <div className="w-10 h-10 border-4 border-[#ae3200]/20 border-t-[#ae3200] rounded-full animate-spin" />
    </main>
  );
  if (!item) return null;

  const isAvailable = (item as any).availability_status
    ? (item as any).availability_status === "available"
    : item.status === "available";

  const availabilityLabel =
    (item as any).availability_status === "borrowed" ? "Borrowed"
    : (item as any).availability_status === "reserved" ? "Reserved"
    : isAvailable ? "Available" : item.status;

  return (
    <main className="min-h-screen pb-28 md:pb-20 bg-[#fdf9f5] text-[#1c1b1a] font-['Be_Vietnam_Pro']">
      {/* ── Header ── */}
      <header className="bg-[#fdf9f5] sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-4 sm:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-2xl font-black text-[#ae3200] font-['Plus_Jakarta_Sans'] tracking-tight hidden sm:block">Proxe</Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-[#5b4038] font-medium hover:text-[#ff5a1f] transition-colors font-['Plus_Jakarta_Sans']">Dashboard</Link>
              <Link href="/profile/me" className="text-[#5b4038] font-medium hover:text-[#ff5a1f] transition-colors font-['Plus_Jakarta_Sans']">My Items</Link>
              <Link href="/inbox" className="text-[#5b4038] font-medium hover:text-[#ff5a1f] transition-colors font-['Plus_Jakarta_Sans']">Inbox</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/notifications" className="p-2 rounded-full hover:bg-[#f7f3ef] transition-colors">
              <svg className="w-5 h-5 text-[#5b4038]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </Link>
            <UserMenu />
          </div>
        </div>
        <div className="bg-[#f7f3ef] h-px w-full" />
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* ── Back nav ── */}
        <div className="mb-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-[#ae3200] font-bold hover:translate-x-[-4px] transition-transform font-['Plus_Jakarta_Sans']">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span className="tracking-tight">Back to {item.category.charAt(0).toUpperCase() + item.category.slice(1)}</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          {/* ── Left Column: Image & Info ── */}
          <div className="lg:col-span-7 space-y-8">
            {/* Main Image */}
            <div className="rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(174,50,0,0.06)] group">
              {item.thumbnail_url ? (
                <img src={item.thumbnail_url} alt={item.title}
                  className="w-full h-[400px] sm:h-[500px] object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="w-full h-[400px] sm:h-[500px] bg-gradient-to-br from-[#f1edea] to-[#e6e2de] flex items-center justify-center">
                  <svg className="w-24 h-24 text-[#8f7067] opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
              )}
            </div>

            {/* Title & Meta */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <ConditionBadge condition={item.ai_condition} />
                {item.times_borrowed > 0 && (
                  <span className="bg-[#ebe7e4] text-[#5b4038] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide font-['Plus_Jakarta_Sans']">
                    Borrowed {item.times_borrowed}x
                  </span>
                )}
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide font-['Plus_Jakarta_Sans'] ${
                  isAvailable ? "bg-[#d2e6bc] text-[#3b4c2c]" : "bg-[#ffdbd0] text-[#852400]"
                }`}>
                  {availabilityLabel}
                </span>
              </div>
              <h1 className="text-[#1c1b1a] font-['Plus_Jakarta_Sans'] font-extrabold text-4xl lg:text-5xl tracking-tighter">{item.title}</h1>
              {item.metadata?.brand && (
                <p className="text-[#5b4038] text-lg font-medium font-['Be_Vietnam_Pro']">
                  {item.metadata.color && `${item.metadata.color} · `}{item.metadata.brand} {item.metadata.model ?? ""}
                </p>
              )}
            </div>

            {/* Description */}
            {(item.description || item.ai_description) && (
              <div className="bg-[#f7f3ef] p-8 lg:p-10 rounded-2xl space-y-4">
                {item.ai_description && (
                  <>
                    <div className="flex items-center gap-3 text-[#526442]">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                      <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg tracking-tight">Proxie AI Description</span>
                    </div>
                    <p className="text-[#5b4038] text-lg leading-relaxed italic font-['Be_Vietnam_Pro']">"{item.ai_description}"</p>
                  </>
                )}
                {item.description && !item.ai_description && (
                  <p className="text-[#5b4038] text-base leading-relaxed font-['Be_Vietnam_Pro']">{item.description}</p>
                )}
              </div>
            )}

            {/* Owner Card */}
            {item.owner && (
              <Link href={isOwner ? "/profile/me" : `/profile/${item.owner.id}`}
                className="bg-white border border-[#e6e2de]/30 p-6 rounded-2xl flex items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] transition-all block">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full bg-[#ae3200]/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-['Plus_Jakarta_Sans'] font-bold text-xl text-[#ae3200]">{item.owner.display_name?.[0] ?? "?"}</span>
                  </div>
                  <div>
                    <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1c1b1a]">{item.owner.display_name}</h3>
                    <p className="text-[#5b4038] font-['Be_Vietnam_Pro'] text-sm">
                      Unit {item.owner.unit_number}
                    </p>
                  </div>
                </div>
                {item.owner.reputation_tags?.length > 0 && (
                  <span className="hidden sm:inline-flex bg-[#ffdbd0] text-[#852400] px-4 py-2 rounded-full text-sm font-bold font-['Plus_Jakarta_Sans']">
                    {item.owner.reputation_tags[0]}
                  </span>
                )}
              </Link>
            )}
          </div>

          {/* ── Right Column: Actions & Pricing ── */}
          <div className="lg:col-span-5 space-y-6">
            <div className="sticky top-28 space-y-6">
              {/* Pricing Cards — neutral warm style */}
              <div className="space-y-3">
                {/* Borrow */}
                {(item.borrow_available ?? true) && (
                  <div className="bg-white border border-[#e6e2de]/50 p-5 rounded-2xl flex justify-between items-center hover:border-[#526442]/30 transition-colors cursor-pointer">
                    <div className="flex gap-4 items-center">
                      <div className="w-11 h-11 rounded-full bg-[#d2e6bc] flex items-center justify-center text-[#526442]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#1c1b1a]">Borrow</h4>
                        <p className="text-[#8f7067] text-xs font-['Be_Vietnam_Pro']">Free for neighbors + deposit</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-[#1c1b1a] font-['Plus_Jakarta_Sans']">$0</span>
                      <p className="text-[10px] text-[#8f7067] font-['Be_Vietnam_Pro']">${(item.deposit_cents / 100).toFixed(0)} deposit</p>
                    </div>
                  </div>
                )}
                {/* Rent */}
                {item.rent_available && item.rent_price_day_cents && (
                  <div className="bg-white border border-[#e6e2de]/50 p-5 rounded-2xl flex justify-between items-center hover:border-[#ae3200]/20 transition-colors cursor-pointer">
                    <div className="flex gap-4 items-center">
                      <div className="w-11 h-11 rounded-full bg-[#ebe7e4] flex items-center justify-center text-[#5b4038]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#1c1b1a]">Rent</h4>
                        <p className="text-[#8f7067] text-xs font-['Be_Vietnam_Pro']">Daily rate + deposit</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-[#1c1b1a] font-['Plus_Jakarta_Sans']">${(item.rent_price_day_cents / 100).toFixed(0)}</span>
                      <p className="text-[10px] text-[#8f7067] font-['Be_Vietnam_Pro']">per day</p>
                    </div>
                  </div>
                )}
                {/* Buy */}
                {item.sell_available && item.sell_price_cents && (
                  <div className="bg-white border border-[#e6e2de]/50 p-5 rounded-2xl flex justify-between items-center hover:border-[#ae3200]/20 transition-colors cursor-pointer">
                    <div className="flex gap-4 items-center">
                      <div className="w-11 h-11 rounded-full bg-[#ffdbd0] flex items-center justify-center text-[#ae3200]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#1c1b1a]">Buy</h4>
                        <p className="text-[#8f7067] text-xs font-['Be_Vietnam_Pro']">Full purchase price</p>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-[#1c1b1a] font-['Plus_Jakarta_Sans']">${(item.sell_price_cents / 100).toFixed(0)}</span>
                  </div>
                )}
                {/* Rent-to-Own */}
                {item.rent_available && item.sell_available && item.sell_price_cents && (
                  <div className="p-4 rounded-2xl bg-[#f7f3ef] border border-[#e6e2de]/50">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#ae3200]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                      </svg>
                      <p className="text-xs text-[#5b4038] font-['Be_Vietnam_Pro']">
                        <span className="font-bold">Rent-to-Own:</span> 80% of rental fees apply toward the ${(item.sell_price_cents / 100).toFixed(0)} purchase price.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Primary CTA */}
              {!isOwner && (
                <button
                  onClick={() => setShowBorrowPrompt(true)}
                  disabled={!isAvailable || borrowRequested || borrowLoading}
                  className="w-full bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white py-5 rounded-full font-['Plus_Jakarta_Sans'] font-extrabold text-lg tracking-tight shadow-xl shadow-[#ae3200]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {borrowLoading ? (
                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Requesting...</>
                  ) : borrowRequested ? (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Request Sent
                    </>
                  ) : isAvailable ? (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
                      </svg>
                      Borrow This Item
                    </>
                  ) : (
                    "Currently Unavailable"
                  )}
                </button>
              )}
              {isOwner && (
                <div className="w-full py-5 rounded-full bg-[#ebe7e4] text-[#5b4038] font-['Plus_Jakarta_Sans'] font-bold text-base flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                  This is your item
                </div>
              )}

              {/* Proxie Chat Suggestion */}
              <div className="bg-[#fdf9f5]/80 backdrop-blur-xl border border-[#d2e6bc]/50 p-6 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#d2e6bc] flex items-center justify-center text-[#526442] flex-shrink-0">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[#3b4c2c] font-medium leading-relaxed text-sm font-['Be_Vietnam_Pro']">
                      "Ask Proxie about pickup, borrowing details, or how deposits work."
                    </p>
                    <div className="flex flex-wrap gap-3 pt-1">
                      <button
                        onClick={() => {
                          const event = new CustomEvent("open-miles", {
                            detail: { prompt: `I want to borrow the ${item.title}. How does pickup and deposit work?` },
                          });
                          window.dispatchEvent(event);
                        }}
                        className="text-[#526442] font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all font-['Plus_Jakarta_Sans']"
                      >
                        Start chatting with Proxie
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                      {!isOwner && item.owner && (
                        <button
                          onClick={() => setShowMessage(true)}
                          className="text-[#ae3200] font-bold text-sm flex items-center gap-1.5 hover:gap-2 transition-all font-['Plus_Jakarta_Sans']"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Message {item.owner.display_name}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rules */}
              {item.rules && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#fdf9f5] border border-[#e6e2de]/50">
                  <svg className="w-5 h-5 text-[#8f7067] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                  </svg>
                  <p className="text-sm text-[#5b4038] font-['Be_Vietnam_Pro']">{item.rules}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Borrow error */}
        {borrowError && (
          <div className="max-w-3xl mx-auto mt-6 flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
            <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <p className="text-red-700 text-sm leading-relaxed font-['Be_Vietnam_Pro']">{borrowError}</p>
          </div>
        )}
      </div>

      {/* ── Message Popup ── */}
      {showMessage && item.owner && (
        <MessagePopup owner={item.owner} itemTitle={item.title} onClose={() => setShowMessage(false)} />
      )}

      {/* ── Borrow Duration Prompt ── */}
      {showBorrowPrompt && item && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowBorrowPrompt(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-sm sm:w-full animate-slide-up">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#e6e2de]/50">
              <div className="px-6 pt-6 pb-4 border-b border-[#e6e2de]">
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#1c1b1a]">How long do you need it?</h3>
                <p className="text-xs text-[#8f7067] mt-1 font-['Be_Vietnam_Pro']">{item.title} · Max {item.max_borrow_days} days</p>
              </div>
              <div className="px-6 py-5">
                <div className="flex gap-2 mb-4 flex-wrap">
                  {[1, 2, 3, 5, 7].filter((d) => d <= item.max_borrow_days).map((d) => (
                    <button key={d}
                      onClick={() => { setBorrowDays(d); setCustomDays(false); }}
                      className={`px-4 py-2 rounded-full text-sm font-['Plus_Jakarta_Sans'] font-semibold transition-all ${
                        borrowDays === d && !customDays ? "bg-[#ae3200] text-white" : "bg-[#f7f3ef] text-[#5b4038] hover:bg-[#ebe7e4]"
                      }`}>
                      {d} day{d !== 1 ? "s" : ""}
                    </button>
                  ))}
                  <button onClick={() => setCustomDays(true)}
                    className={`px-4 py-2 rounded-full text-sm font-['Plus_Jakarta_Sans'] font-semibold transition-all ${
                      customDays ? "bg-[#ae3200] text-white" : "bg-[#f7f3ef] text-[#5b4038] hover:bg-[#ebe7e4]"
                    }`}>
                    Custom
                  </button>
                </div>
                {customDays && (
                  <div className="flex items-center gap-3 mb-4">
                    <input type="number" min={1} max={item.max_borrow_days} value={borrowDays}
                      onChange={(e) => setBorrowDays(Math.min(Math.max(1, Number(e.target.value)), item.max_borrow_days))}
                      className="w-20 px-3 py-2 rounded-xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm text-center font-['Plus_Jakarta_Sans'] font-bold"
                      autoFocus />
                    <span className="text-sm text-[#8f7067] font-['Be_Vietnam_Pro']">day{borrowDays !== 1 ? "s" : ""} (max {item.max_borrow_days})</span>
                  </div>
                )}
                {item.max_borrow_days > 7 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-[#5b4038] uppercase tracking-widest font-['Plus_Jakarta_Sans']">Or choose</label>
                      <span className="text-sm font-['Plus_Jakarta_Sans'] font-bold text-[#ae3200]">{borrowDays} day{borrowDays !== 1 ? "s" : ""}</span>
                    </div>
                    <input type="range" min={1} max={item.max_borrow_days} value={borrowDays}
                      onChange={(e) => setBorrowDays(Number(e.target.value))}
                      className="w-full accent-[#ae3200]" />
                    <div className="flex justify-between text-[10px] text-[#8f7067] mt-1 font-['Be_Vietnam_Pro']">
                      <span>1 day</span><span>{item.max_borrow_days} days</span>
                    </div>
                  </div>
                )}
                <div className="p-4 rounded-2xl bg-[#f7f3ef] mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#8f7067] font-['Be_Vietnam_Pro']">Duration</span>
                    <span className="font-['Plus_Jakarta_Sans'] font-bold">{borrowDays} day{borrowDays !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#8f7067] font-['Be_Vietnam_Pro']">Deposit hold</span>
                    <span className="font-['Plus_Jakarta_Sans'] font-bold">${(item.deposit_cents / 100).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8f7067] font-['Be_Vietnam_Pro']">Fee</span>
                    <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#526442]">Free</span>
                  </div>
                </div>
                <button onClick={handleBorrowRequest} disabled={borrowLoading}
                  className="w-full py-3.5 bg-[#ae3200] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {borrowLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending request...</>
                  ) : "Send borrow request"}
                </button>
                <button onClick={() => setShowBorrowPrompt(false)}
                  className="w-full mt-2 py-2 text-xs text-[#8f7067] hover:text-[#5b4038] transition-colors font-['Be_Vietnam_Pro']">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile Bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-[#fdf9f5]/80 backdrop-blur-xl border-t border-[#e6e2de]/50 md:hidden">
        <div className="max-w-3xl mx-auto flex gap-3">
          {isOwner ? (
            <Link href="/dashboard"
              className="w-full py-3.5 rounded-full bg-[#ebe7e4] text-[#5b4038] font-['Plus_Jakarta_Sans'] font-bold text-sm flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Back to Dashboard
            </Link>
          ) : (
            <>
              <button onClick={() => setShowMessage(true)}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-full border border-[#e6e2de] text-[#5b4038] font-['Plus_Jakarta_Sans'] font-bold text-sm hover:border-[#ae3200]/30 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message
              </button>
              <button onClick={() => setShowBorrowPrompt(true)}
                disabled={!isAvailable || borrowRequested || borrowLoading}
                className="flex-1 py-3.5 rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white">
                {borrowLoading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Requesting...</>
                ) : borrowRequested ? (
                  "Request Sent"
                ) : isAvailable ? (
                  `Borrow · $${(item.deposit_cents / 100).toFixed(0)} deposit`
                ) : (
                  "Currently Unavailable"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
