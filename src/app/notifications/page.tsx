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
  const [msgFilter, setMsgFilter] = useState<"received" | "sent">("received");
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
        // Neighbor broadcasts (not mine, not expired)
        supabase
          .from("broadcasts")
          .select(
            "*, sender:profiles(id, display_name, username, unit_number, avatar_url)"
          )
          .gt("expires_at", new Date().toISOString())
          .neq("sender_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30),

        // My broadcasts
        supabase
          .from("broadcasts")
          .select(
            "*, sender:profiles(id, display_name, username, unit_number, avatar_url)"
          )
          .eq("sender_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),

        // Messages (sent + received)
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

        // Incoming borrow requests for my items
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
      content: `Hey ${broadcast.sender?.display_name?.split(" ")[0]}! I saw your request for ${itemName} — I have one you can borrow! Let me know when works for you 🙌`,
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
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
      </main>
    );

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-inventory-200/50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-inventory-500 hover:text-inventory-900 transition-colors"
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
          </Link>
          <h1 className="font-display font-bold text-base flex-1">
            Notifications
          </h1>
        </div>

        {/* 4 Tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                {
                  key: "messages" as Tab,
                  label: "Messages",
                  icon: "💬",
                  badge: unreadMsgCount,
                },
                {
                  key: "requests" as Tab,
                  label: "Requests",
                  icon: "📋",
                  badge: activeRequestCount,
                },
                {
                  key: "my_broadcasts" as Tab,
                  label: "My Broadcasts",
                  icon: "📤",
                  badge: 0,
                },
                {
                  key: "neighbor_broadcasts" as Tab,
                  label: "Neighbors",
                  icon: "📣",
                  badge: neighborBroadcasts.length,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-shrink-0 py-2 px-3 rounded-xl text-xs font-display font-semibold transition-all flex items-center gap-1.5 ${
                  tab === t.key
                    ? "bg-accent text-white"
                    : "text-inventory-500 hover:text-inventory-700"
                }`}
              >
                {t.icon} {t.label}
                {t.badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      tab === t.key
                        ? "bg-white/20 text-white"
                        : "bg-accent text-white"
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

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        {/* ════════════════════════════════════════════
            TAB 1: MESSAGES
            ════════════════════════════════════════════ */}
        {tab === "messages" && (
          <>

            {(() => {
              // Group messages by conversation partner (like inbox)
              const partnerMap = new Map<
                string,
                { partner: MessageNotif["sender"]; lastMessage: MessageNotif; unreadCount: number }
              >();

              messages.forEach((m) => {
                const partnerId =
                  m.sender_id === myId ? m.recipient_id : m.sender_id;
                const partner = m.sender_id === myId ? m.recipient : m.sender;

                if (!partnerMap.has(partnerId)) {
                  partnerMap.set(partnerId, {
                    partner,
                    lastMessage: m,
                    unreadCount:
                      m.recipient_id === myId && !m.read_at ? 1 : 0,
                  });
                } else {
                  const existing = partnerMap.get(partnerId)!;
                  // Messages are ordered desc, so first one is latest
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
                    <span className="text-5xl mb-4">💬</span>
                    <p className="font-display font-bold text-inventory-700 mb-2">
                      No conversations yet
                    </p>
                    <p className="text-sm text-inventory-400 mb-6">
                      When you message a neighbor or someone messages you,
                      it&apos;ll appear here.
                    </p>
                    <Link
                      href="/dashboard"
                      className="px-5 py-2.5 bg-accent text-white rounded-xl font-display font-semibold text-sm"
                    >
                      Browse Items →
                    </Link>
                  </div>
                );

              return (
                <>
                  <p className="text-xs font-bold text-inventory-400 uppercase tracking-widest mb-1">
                    Conversations ({conversations.length})
                  </p>
                  {conversations.map((conv) => {
                    const p = conv.partner;
                    const msg = conv.lastMessage;
                    return (
                      <Link
                        key={p?.id ?? msg.id}
                        href={`/inbox?with=${p?.id}`}
                        className={`glass rounded-2xl p-4 flex items-start gap-3 card-hover block ${
                          conv.unreadCount > 0
                            ? "border-l-4 border-l-accent"
                            : ""
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {p?.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-bold text-accent text-sm">
                              {p?.display_name?.[0] ?? "?"}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <p className="font-display font-bold text-sm">
                                {p?.display_name}
                              </p>
                              <span className="text-xs text-inventory-400">
                                Unit {p?.unit_number}
                              </span>
                            </div>
                            <span className="text-xs text-inventory-400 flex-shrink-0">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-inventory-600 truncate">
                            {msg.sender_id === myId ? "You: " : ""}
                            {messagePreview(msg)}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="inline-block mt-1.5 text-xs bg-accent text-white font-bold px-2 py-0.5 rounded-full">
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
            TAB 2: NEIGHBOR REQUESTS (incoming borrow requests for my items)
            ════════════════════════════════════════════ */}
        {tab === "requests" && (
          <>
            {borrowRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-5xl mb-4">📋</span>
                <p className="font-display font-bold text-inventory-700 mb-2">
                  No pending requests
                </p>
                <p className="text-sm text-inventory-400">
                  When someone wants to borrow your items, their requests will
                  appear here.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-inventory-400 uppercase tracking-widest mb-3">
                  Incoming requests ({borrowRequests.length})
                </p>
                {borrowRequests.map((req) => (
                  <div
                    key={req.id}
                    className="glass rounded-2xl p-4"
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
                        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-accent">
                            {(req.borrower_display_name ?? "?")[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-sm truncate">
                          {req.borrower_display_name ?? "Someone"}
                        </p>
                        <p className="text-[11px] text-inventory-400">
                          {formatTime(req.requested_at)}
                          {req.status === "pending" &&
                            req.pending_expires_at &&
                            ` · expires ${formatTime(req.pending_expires_at)}`}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          req.status === "requested"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {req.status === "requested" ? "New" : "Pending"}
                      </span>
                    </div>

                    {/* Item info */}
                    <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-inventory-50">
                      {req.item_photo_url ? (
                        <img
                          src={req.item_photo_url}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-inventory-200 flex items-center justify-center">
                          <span className="text-[10px] text-inventory-400">
                            📦
                          </span>
                        </div>
                      )}
                      <p className="text-sm font-medium text-inventory-700">
                        {req.item_title}
                      </p>
                    </div>

                    {/* Request message */}
                    {req.request_message && (
                      <p className="text-xs text-inventory-500 mb-3 italic">
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
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-display font-semibold bg-trust-high/10 text-trust-high hover:bg-trust-high/20 disabled:opacity-50 transition-colors"
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
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-display font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        Can&apos;t lend
                      </button>
                      {req.status === "requested" && (
                        <button
                          onClick={() =>
                            handleRequestAction(req.transaction_id, "pending")
                          }
                          disabled={actionLoading === req.transaction_id}
                          className="flex-1 py-2 px-3 rounded-xl text-xs font-display font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 disabled:opacity-50 transition-colors"
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
                <span className="text-5xl mb-4">📤</span>
                <p className="font-display font-bold text-inventory-700 mb-2">
                  No broadcasts yet
                </p>
                <p className="text-sm text-inventory-400 mb-6">
                  Ask Miles to find an item and your request will be broadcast to
                  neighbors.
                </p>
                <Link
                  href="/dashboard"
                  className="px-5 py-2.5 bg-accent text-white rounded-xl font-display font-semibold text-sm"
                >
                  Ask Miles →
                </Link>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-inventory-400 uppercase tracking-widest mb-3">
                  My broadcasts ({myBroadcasts.length})
                </p>
                {myBroadcasts.map((b) => (
                  <div
                    key={b.id}
                    className="glass rounded-2xl p-4 border-l-4 border-l-accent"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-accent/10 text-accent px-3 py-1 rounded-full font-bold">
                        🔍 {b.item_query}
                      </span>
                      <span className="text-xs text-inventory-400">
                        {formatTime(b.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-inventory-600 leading-relaxed">
                      {b.message.replace(/\*\*/g, "")}
                    </p>
                    <div className="mt-3 pt-3 border-t border-inventory-100 flex items-center gap-1.5">
                      {isExpired(b.expires_at) ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-inventory-300" />
                          <p className="text-xs text-inventory-400">Expired</p>
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-trust-high animate-pulse" />
                          <p className="text-xs text-inventory-400">
                            Active · expires in{" "}
                            {Math.max(
                              0,
                              Math.floor(
                                (new Date(b.expires_at).getTime() - Date.now()) /
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
                <span className="text-5xl mb-4">📣</span>
                <p className="font-display font-bold text-inventory-700 mb-2">
                  No neighbor requests right now
                </p>
                <p className="text-sm text-inventory-400">
                  When neighbors ask for items via Miles, they&apos;ll appear
                  here.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-inventory-400 uppercase tracking-widest mb-1">
                  From your neighbors
                </p>
                <p className="text-xs text-inventory-400 mb-3">
                  Your neighbors are looking for these items. If you have one,
                  let them know!
                </p>
                {neighborBroadcasts.map((b) => (
                  <div key={b.id} className="glass rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {b.sender?.avatar_url ? (
                          <img
                            src={b.sender.avatar_url}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-bold text-accent text-sm">
                            {b.sender?.display_name?.[0] ?? "?"}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/profile/${b.sender?.id}`}
                            className="font-display font-bold text-sm hover:text-accent transition-colors"
                          >
                            {b.sender?.display_name}
                          </Link>
                          <span className="text-xs text-inventory-400">
                            Unit {b.sender?.unit_number}
                          </span>
                          <span className="text-xs text-inventory-300 ml-auto">
                            {formatTime(b.created_at)}
                          </span>
                        </div>

                        <div className="bg-inventory-50 rounded-xl p-3 mb-3">
                          <p className="text-sm text-inventory-700 leading-relaxed">
                            {b.message.replace(/\*\*/g, "")}
                          </p>
                        </div>

                        {b.item_query && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs bg-accent/10 text-accent px-3 py-1 rounded-full font-bold">
                              🔍 Looking for: {b.item_query}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReplyToBroadcast(b)}
                            disabled={repliedTo.has(b.id)}
                            className={`flex-1 py-2 rounded-xl font-display font-semibold text-xs transition-colors ${
                              repliedTo.has(b.id)
                                ? "bg-trust-high text-white"
                                : "bg-accent text-white hover:bg-accent-dark"
                            }`}
                          >
                            {repliedTo.has(b.id)
                              ? "✓ Sent! They'll see it in Messages"
                              : "I have it! →"}
                          </button>
                          {!repliedTo.has(b.id) && (
                            <Link
                              href={`/dashboard?q=${encodeURIComponent(
                                b.item_query ?? ""
                              )}`}
                              className="px-3 py-2 border border-inventory-200 text-inventory-600 rounded-xl font-display font-semibold text-xs hover:border-accent hover:text-accent transition-colors"
                            >
                              Browse
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-inventory-100 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-trust-high" />
                      <p className="text-xs text-inventory-400">
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
