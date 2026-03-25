"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Broadcast = {
  id: string;
  message: string;
  item_query: string;
  created_at: string;
  expires_at: string;
  sender: {
    id: string;
    display_name: string;
    username: string;
    unit_number: string;
    avatar_url: string | null;
  };
};

type MessageNotif = {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  read_at: string | null;
  sender_id: string;
  recipient_id: string;
  sender: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
    unit_number: string;
  };
  recipient: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
    unit_number: string;
  };
};

type BorrowRequest = {
  id: string;
  transaction_id: string;
  item_id: string;
  borrower_id: string;
  item_title: string;
  item_photo_url: string | null;
  borrower_display_name: string | null;
  borrower_avatar_url: string | null;
  status: string;
  request_message: string | null;
  requested_at: string;
  pending_expires_at: string | null;
};

type Tab = "messages" | "requests" | "my_broadcasts" | "neighbor_broadcasts";

/* ── SVG Icons ── */
const ChevronLeft = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChatIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
const ClipboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);
const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);
const MegaphoneIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>
);
const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const PackageIcon = () => (
  <svg className="w-5 h-5 text-[#8f7067]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

function formatTime(ts: string) {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function isExpired(ts: string) {
  return new Date(ts).getTime() < Date.now();
}

function messagePreview(msg: MessageNotif): string {
  const typeLabels: Record<string, string> = {
    borrow_request: "Borrow request",
    request_accepted: "Request accepted",
    request_declined: "Request declined",
    request_pending: "Considering request...",
    deposit_confirmed: "Deposit confirmed",
    pickup_confirmed: "Pickup confirmed",
    request_cancelled: "Request cancelled",
    request_expired: "Request expired",
    deposit_nudge: "Pickup reminder",
    deposit_warning: "Holding fee warning",
    deposit_auto_cancelled: "Auto-cancelled",
  };
  return typeLabels[msg.message_type] ?? msg.content;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("messages");
  const [neighborBroadcasts, setNeighborBroadcasts] = useState<Broadcast[]>([]);
  const [myBroadcasts, setMyBroadcasts] = useState<Broadcast[]>([]);
  const [messages, setMessages] = useState<MessageNotif[]>([]);
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setMyId(user.id);

      const [bcastRes, myBcastRes, msgsRes, reqsRes] = await Promise.all([
        supabase
          .from("broadcasts")
          .select(
            "*, sender:profiles(id, display_name, username, unit_number, avatar_url)"
          )
          .gt("expires_at", new Date().toISOString())
          .neq("sender_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("broadcasts")
          .select(
            "*, sender:profiles(id, display_name, username, unit_number, avatar_url)"
          )
          .eq("sender_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("messages")
          .select(
            `*, 
            sender:profiles!messages_sender_id_fkey(id, display_name, username, avatar_url, unit_number),
            recipient:profiles!messages_recipient_id_fkey(id, display_name, username, avatar_url, unit_number)`
          )
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("borrow_requests")
          .select("*")
          .eq("owner_id", user.id)
          .in("status", ["requested", "pending"])
          .order("requested_at", { ascending: false }),
      ]);

      setNeighborBroadcasts(bcastRes.data ?? []);
      setMyBroadcasts(myBcastRes.data ?? []);
      setMessages(msgsRes.data ?? []);
      setBorrowRequests(reqsRes.data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  // ─── Broadcast reply ───
  const [repliedTo, setRepliedTo] = useState<Set<string>>(new Set());

  const handleReplyToBroadcast = async (broadcast: Broadcast) => {
    if (!myId || repliedTo.has(broadcast.id)) return;

    const itemName = broadcast.item_query ?? "that item";
    const { error } = await supabase.from("messages").insert({
      sender_id: myId,
      recipient_id: broadcast.sender?.id,
      content: `Hey ${broadcast.sender?.display_name?.split(" ")[0]}! I saw your request for ${itemName} — I have one you can borrow! Let me know when works for you.`,
      message_type: "broadcast_reply",
    });

    if (!error) {
      setRepliedTo((prev) => new Set(prev).add(broadcast.id));
    }
  };

  // ─── Borrow request actions ───
  async function handleRequestAction(
    transactionId: string,
    action: "approve" | "decline" | "pending"
  ) {
    setActionLoading(transactionId);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setBorrowRequests((prev) =>
          prev.filter((r) => r.transaction_id !== transactionId)
        );
      }
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setActionLoading(null);
    }
  }

  const unreadMsgCount = messages.filter(
    (m) => m.recipient_id === myId && !m.read_at
  ).length;
  const activeRequestCount = borrowRequests.length;

  if (loading)
    return (
      <main className="min-h-screen bg-[#fdf9f5] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#e6e2de] border-t-[#ae3200] rounded-full animate-spin" />
      </main>
    );

  const tabs: {
    key: Tab;
    label: string;
    icon: React.ReactNode;
    badge: number;
  }[] = [
    { key: "messages", label: "Messages", icon: <ChatIcon />, badge: unreadMsgCount },
    { key: "requests", label: "Requests", icon: <ClipboardIcon />, badge: activeRequestCount },
    { key: "my_broadcasts", label: "My Broadcasts", icon: <UploadIcon />, badge: 0 },
    { key: "neighbor_broadcasts", label: "Neighbors", icon: <MegaphoneIcon />, badge: neighborBroadcasts.length },
  ];

  return (
    <main className="min-h-screen bg-[#fdf9f5] pb-32">
      {/* ── Sticky Header with Nav ── */}
      <header className="sticky top-0 z-40 bg-[#f7f3ef]/90 backdrop-blur-md border-b border-[#e6e2de]/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-[#8f7067] hover:text-[#1c1b1a] transition-colors"
          >
            <ChevronLeft />
          </Link>
          <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1c1b1a]">
            Inbox
          </h1>
        </div>

        {/* Tab pills */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-3">
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-shrink-0 py-2 px-4 rounded-full text-sm font-['Plus_Jakarta_Sans'] font-bold transition-all flex items-center gap-2 ${
                  tab === t.key
                    ? "bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white shadow-sm"
                    : "text-[#5b4038] hover:bg-[#ebe7e4]"
                }`}
              >
                {t.icon}
                {t.label}
                {t.badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      tab === t.key
                        ? "bg-white/20 text-white"
                        : "bg-[#ae3200] text-white"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 space-y-3">
        {/* ════════════════════════════════════════════
            TAB 1: MESSAGES
            ════════════════════════════════════════════ */}
        {tab === "messages" && (
          <>
            {(() => {
              const partnerMap = new Map<
                string,
                {
                  partner: MessageNotif["sender"];
                  lastMessage: MessageNotif;
                  unreadCount: number;
                }
              >();

              messages.forEach((m) => {
                const partnerId =
                  m.sender_id === myId ? m.recipient_id : m.sender_id;
                const partner =
                  m.sender_id === myId ? m.recipient : m.sender;

                if (!partnerMap.has(partnerId)) {
                  partnerMap.set(partnerId, {
                    partner,
                    lastMessage: m,
                    unreadCount:
                      m.recipient_id === myId && !m.read_at ? 1 : 0,
                  });
                } else {
                  const existing = partnerMap.get(partnerId)!;
                  if (m.recipient_id === myId && !m.read_at) {
                    existing.unreadCount += 1;
                  }
                }
              });

              const conversations = Array.from(partnerMap.values()).sort(
                (a, b) =>
                  new Date(b.lastMessage.created_at).getTime() -
                  new Date(a.lastMessage.created_at).getTime()
              );

              if (conversations.length === 0)
                return (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#f7f3ef] flex items-center justify-center mx-auto mb-4">
                      <ChatIcon />
                    </div>
                    <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] text-lg mb-2">
                      No conversations yet
                    </p>
                    <p className="text-sm text-[#8f7067] font-['Be_Vietnam_Pro'] mb-6">
                      When you message a neighbor or someone messages you,
                      it&apos;ll appear here.
                    </p>
                    <Link
                      href="/dashboard"
                      className="px-6 py-2.5 bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm"
                    >
                      Browse Items
                    </Link>
                  </div>
                );

              return (
                <>
                  <p className="text-xs font-['Plus_Jakarta_Sans'] font-bold text-[#8f7067] uppercase tracking-widest mb-1">
                    Conversations ({conversations.length})
                  </p>
                  {conversations.map((conv) => {
                    const p = conv.partner;
                    const msg = conv.lastMessage;
                    return (
                      <Link
                        key={p?.id ?? msg.id}
                        href={`/inbox?with=${p?.id}`}
                        className={`bg-white border border-[#e6e2de]/50 rounded-2xl p-4 flex items-start gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-md transition-all block ${
                          conv.unreadCount > 0
                            ? "border-l-4 border-l-[#ae3200]"
                            : ""
                        }`}
                      >
                        <div className="w-11 h-11 rounded-full bg-[#ae3200]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {p?.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt={p.display_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-bold text-[#ae3200] text-sm">
                              {p?.display_name?.[0] ?? "?"}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#1c1b1a]">
                                {p?.display_name}
                              </p>
                              <span className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">
                                Unit {p?.unit_number}
                              </span>
                            </div>
                            <span className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro'] flex-shrink-0">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-[#5b4038] font-['Be_Vietnam_Pro'] truncate">
                            {msg.sender_id === myId ? "You: " : ""}
                            {messagePreview(msg)}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="inline-block mt-1.5 text-xs bg-[#ae3200] text-white font-['Plus_Jakarta_Sans'] font-bold px-2 py-0.5 rounded-full">
                              {conv.unreadCount} new
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </>
              );
            })()}
          </>
        )}

        {/* ════════════════════════════════════════════
            TAB 2: REQUESTS
            ════════════════════════════════════════════ */}
        {tab === "requests" && (
          <>
            {borrowRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-[#f7f3ef] flex items-center justify-center mx-auto mb-4">
                  <ClipboardIcon />
                </div>
                <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] text-lg mb-2">
                  No pending requests
                </p>
                <p className="text-sm text-[#8f7067] font-['Be_Vietnam_Pro']">
                  When someone wants to borrow your items, their requests will
                  appear here.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs font-['Plus_Jakarta_Sans'] font-bold text-[#8f7067] uppercase tracking-widest mb-3">
                  Incoming requests ({borrowRequests.length})
                </p>
                {borrowRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white border border-[#e6e2de]/50 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.02)]"
                  >
                    {/* Borrower info */}
                    <div className="flex items-center gap-2 mb-3">
                      {req.borrower_avatar_url ? (
                        <img
                          src={req.borrower_avatar_url}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#ae3200]/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-[#ae3200]">
                            {(req.borrower_display_name ?? "?")[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#1c1b1a] truncate">
                          {req.borrower_display_name ?? "Someone"}
                        </p>
                        <p className="text-[11px] text-[#8f7067] font-['Be_Vietnam_Pro']">
                          {formatTime(req.requested_at)}
                          {req.status === "pending" &&
                            req.pending_expires_at &&
                            ` · expires ${formatTime(req.pending_expires_at)}`}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] font-['Plus_Jakarta_Sans'] font-bold px-2.5 py-0.5 rounded-full ${
                          req.status === "requested"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {req.status === "requested" ? "New" : "Pending"}
                      </span>
                    </div>

                    {/* Item info */}
                    <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-[#f7f3ef]">
                      {req.item_photo_url ? (
                        <img
                          src={req.item_photo_url}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#e6e2de] flex items-center justify-center">
                          <PackageIcon />
                        </div>
                      )}
                      <p className="text-sm font-medium text-[#1c1b1a] font-['Be_Vietnam_Pro']">
                        {req.item_title}
                      </p>
                    </div>

                    {/* Request message */}
                    {req.request_message && (
                      <p className="text-xs text-[#5b4038] font-['Be_Vietnam_Pro'] mb-3 italic">
                        &ldquo;{req.request_message}&rdquo;
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() =>
                          handleRequestAction(req.transaction_id, "approve")
                        }
                        disabled={actionLoading === req.transaction_id}
                        className="flex-1 py-2.5 px-3 rounded-full text-xs font-['Plus_Jakarta_Sans'] font-bold bg-[#526442]/10 text-[#526442] hover:bg-[#526442]/20 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === req.transaction_id
                          ? "..."
                          : "Lend it"}
                      </button>
                      <button
                        onClick={() =>
                          handleRequestAction(req.transaction_id, "decline")
                        }
                        disabled={actionLoading === req.transaction_id}
                        className="flex-1 py-2.5 px-3 rounded-full text-xs font-['Plus_Jakarta_Sans'] font-bold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        Can&apos;t lend
                      </button>
                      {req.status === "requested" && (
                        <button
                          onClick={() =>
                            handleRequestAction(req.transaction_id, "pending")
                          }
                          disabled={actionLoading === req.transaction_id}
                          className="flex-1 py-2.5 px-3 rounded-full text-xs font-['Plus_Jakarta_Sans'] font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                        >
                          Thinking...
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════
            TAB 3: MY BROADCASTS
            ════════════════════════════════════════════ */}
        {tab === "my_broadcasts" && (
          <>
            {myBroadcasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-[#f7f3ef] flex items-center justify-center mx-auto mb-4">
                  <UploadIcon />
                </div>
                <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] text-lg mb-2">
                  No broadcasts yet
                </p>
                <p className="text-sm text-[#8f7067] font-['Be_Vietnam_Pro'] mb-6">
                  Ask Proxie to find an item and your request will be broadcast
                  to neighbors.
                </p>
                <Link
                  href="/dashboard"
                  className="px-6 py-2.5 bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm"
                >
                  Ask Proxie
                </Link>
              </div>
            ) : (
              <>
                <p className="text-xs font-['Plus_Jakarta_Sans'] font-bold text-[#8f7067] uppercase tracking-widest mb-3">
                  My broadcasts ({myBroadcasts.length})
                </p>
                {myBroadcasts.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white border border-[#e6e2de]/50 rounded-2xl p-4 border-l-4 border-l-[#ae3200] shadow-[0_10px_30px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-[#ae3200]/10 text-[#ae3200] px-3 py-1 rounded-full font-['Plus_Jakarta_Sans'] font-bold flex items-center gap-1">
                        <SearchIcon />
                        {b.item_query}
                      </span>
                      <span className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">
                        {formatTime(b.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed">
                      {b.message.replace(/\*\*/g, "")}
                    </p>
                    <div className="mt-3 pt-3 border-t border-[#e6e2de]/50 flex items-center gap-1.5">
                      {isExpired(b.expires_at) ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-[#8f7067]" />
                          <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">Expired</p>
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-[#526442] animate-pulse" />
                          <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">
                            Active · expires in{" "}
                            {Math.max(
                              0,
                              Math.floor(
                                (new Date(b.expires_at).getTime() -
                                  Date.now()) /
                                  3600000
                              )
                            )}
                            h
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════
            TAB 4: NEIGHBOR BROADCASTS
            ════════════════════════════════════════════ */}
        {tab === "neighbor_broadcasts" && (
          <>
            {neighborBroadcasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-[#f7f3ef] flex items-center justify-center mx-auto mb-4">
                  <MegaphoneIcon />
                </div>
                <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] text-lg mb-2">
                  No neighbor requests right now
                </p>
                <p className="text-sm text-[#8f7067] font-['Be_Vietnam_Pro']">
                  When neighbors ask for items via Proxie, they&apos;ll appear
                  here.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs font-['Plus_Jakarta_Sans'] font-bold text-[#8f7067] uppercase tracking-widest mb-1">
                  From your neighbors
                </p>
                <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro'] mb-3">
                  Your neighbors are looking for these items. If you have one,
                  let them know!
                </p>
                {neighborBroadcasts.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white border border-[#e6e2de]/50 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#ae3200]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {b.sender?.avatar_url ? (
                          <img
                            src={b.sender.avatar_url}
                            alt={b.sender.display_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-bold text-[#ae3200] text-sm">
                            {b.sender?.display_name?.[0] ?? "?"}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/profile/${b.sender?.id}`}
                            className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#1c1b1a] hover:text-[#ae3200] transition-colors"
                          >
                            {b.sender?.display_name}
                          </Link>
                          <span className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">
                            Unit {b.sender?.unit_number}
                          </span>
                          <span className="text-xs text-[#8f7067]/50 font-['Be_Vietnam_Pro'] ml-auto">
                            {formatTime(b.created_at)}
                          </span>
                        </div>

                        <div className="bg-[#f7f3ef] rounded-xl p-3 mb-3">
                          <p className="text-sm text-[#1c1b1a] font-['Be_Vietnam_Pro'] leading-relaxed">
                            {b.message.replace(/\*\*/g, "")}
                          </p>
                        </div>

                        {b.item_query && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs bg-[#ae3200]/10 text-[#ae3200] px-3 py-1 rounded-full font-['Plus_Jakarta_Sans'] font-bold flex items-center gap-1">
                              <SearchIcon />
                              Looking for: {b.item_query}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReplyToBroadcast(b)}
                            disabled={repliedTo.has(b.id)}
                            className={`flex-1 py-2.5 rounded-full font-['Plus_Jakarta_Sans'] font-bold text-xs transition-colors ${
                              repliedTo.has(b.id)
                                ? "bg-[#526442] text-white"
                                : "bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white hover:shadow-lg hover:shadow-[#ae3200]/20"
                            }`}
                          >
                            {repliedTo.has(b.id) ? (
                              <>
                                <CheckIcon />
                                Sent! They&apos;ll see it in Messages
                              </>
                            ) : (
                              "I have it!"
                            )}
                          </button>
                          {!repliedTo.has(b.id) && (
                            <Link
                              href={`/dashboard?q=${encodeURIComponent(
                                b.item_query ?? ""
                              )}`}
                              className="px-4 py-2.5 border border-[#e6e2de] text-[#5b4038] rounded-full font-['Plus_Jakarta_Sans'] font-bold text-xs hover:border-[#ae3200] hover:text-[#ae3200] transition-colors"
                            >
                              Browse
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#e6e2de]/50 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#526442]" />
                      <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">
                        Active for{" "}
                        {Math.max(
                          0,
                          Math.floor(
                            (new Date(b.expires_at).getTime() - Date.now()) /
                              3600000
                          )
                        )}
                        h more
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
