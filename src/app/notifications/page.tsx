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

type Tab = "broadcasts" | "messages";

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

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("broadcasts");
  const [msgFilter, setMsgFilter] = useState<"received" | "sent">("received");
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [myBroadcasts, setMyBroadcasts] = useState<Broadcast[]>([]);
  const [messages, setMessages] = useState<MessageNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setMyId(user.id);

      // Fetch active broadcasts (not expired, not mine)
      const { data: bcast } = await supabase
        .from("broadcasts")
        .select("*, sender:profiles(id, display_name, username, unit_number, avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .neq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      // Fetch MY own broadcasts
      const { data: myBcast } = await supabase
        .from("broadcasts")
        .select("*, sender:profiles(id, display_name, username, unit_number, avatar_url)")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch all messages (sent + received)
      const { data: msgs } = await supabase
        .from("messages")
        .select(`*, 
          sender:profiles!messages_sender_id_fkey(id, display_name, username, avatar_url, unit_number),
          recipient:profiles!messages_recipient_id_fkey(id, display_name, username, avatar_url, unit_number)
        `)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(50);

      setBroadcasts(bcast ?? []);
      setMyBroadcasts(myBcast ?? []);
      setMessages(msgs ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const [repliedTo, setRepliedTo] = useState<Set<string>>(new Set());

  const handleReplyToBroadcast = async (broadcast: Broadcast) => {
    if (!myId || repliedTo.has(broadcast.id)) return;

    // Send a pre-written message instantly
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

  const unreadMsgCount = messages.filter(m => !m.read_at).length;

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
    </main>
  );

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-inventory-200/50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-inventory-500 hover:text-inventory-900 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-display font-bold text-base flex-1">Notifications</h1>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-1">
          <button
            onClick={() => setTab("broadcasts")}
            className={`flex-1 py-2 rounded-xl text-sm font-display font-semibold transition-all flex items-center justify-center gap-2 ${
              tab === "broadcasts" ? "bg-accent text-white" : "text-inventory-500 hover:text-inventory-700"
            }`}
          >
            📣 Neighbor Requests
            {broadcasts.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === "broadcasts" ? "bg-white/20 text-white" : "bg-inventory-200 text-inventory-600"}`}>
                {broadcasts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("messages")}
            className={`flex-1 py-2 rounded-xl text-sm font-display font-semibold transition-all flex items-center justify-center gap-2 ${
              tab === "messages" ? "bg-accent text-white" : "text-inventory-500 hover:text-inventory-700"
            }`}
          >
            💬 Messages
            {unreadMsgCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === "messages" ? "bg-white/20 text-white" : "bg-accent text-white"}`}>
                {unreadMsgCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">

        {/* BROADCASTS TAB */}
        {tab === "broadcasts" && (
          <>
            {/* My own broadcasts */}
            {myBroadcasts.length > 0 && (
              <div className="mb-5">
                <h3 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-3">
                  📤 My Requests
                </h3>
                {myBroadcasts.map((b) => (
                  <div key={b.id} className="glass rounded-2xl p-4 mb-3 border-l-4 border-l-accent">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-accent/10 text-accent px-3 py-1 rounded-full font-bold">
                            🔍 {b.item_query}
                          </span>
                          <span className="text-xs text-inventory-400">{formatTime(b.created_at)}</span>
                        </div>
                        <p className="text-sm text-inventory-600 leading-relaxed">
                          {b.message.replace(/\*\*/g, "")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-inventory-100 flex items-center gap-1.5">
                      {isExpired(b.expires_at)
                        ? <><div className="w-1.5 h-1.5 rounded-full bg-inventory-300" /><p className="text-xs text-inventory-400">Expired</p></>
                        : <><div className="w-1.5 h-1.5 rounded-full bg-trust-high animate-pulse" /><p className="text-xs text-inventory-400">Active · expires in {Math.max(0, Math.floor((new Date(b.expires_at).getTime() - Date.now()) / 3600000))}h</p></>
                      }
                    </div>
                  </div>
                ))}
                {broadcasts.length > 0 && <div className="h-px bg-inventory-100 my-4" />}
              </div>
            )}

            {/* Neighbor broadcasts */}
            {broadcasts.length === 0 && myBroadcasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-5xl mb-4">📣</span>
                <p className="font-display font-bold text-inventory-700 mb-2">No neighbor requests</p>
                <p className="text-sm text-inventory-400">When neighbors ask for items via Miles, they'll appear here.</p>
              </div>
            ) : broadcasts.length > 0 ? (
              <>
                <h3 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-3">
                  📣 From Your Neighbors
                </h3>
                <p className="text-xs text-inventory-400 pb-1">
                  Your neighbors are looking for these items. If you have one, message them!
                </p>
                {broadcasts.map((b) => (
                  <div key={b.id} className="glass rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {b.sender?.avatar_url
                          ? <img src={b.sender.avatar_url} className="w-full h-full object-cover" />
                          : <span className="font-bold text-accent text-sm">{b.sender?.display_name?.[0] ?? "?"}</span>
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/profile/${b.sender?.id}`} className="font-display font-bold text-sm hover:text-accent transition-colors">
                            {b.sender?.display_name}
                          </Link>
                          <span className="text-xs text-inventory-400">Unit {b.sender?.unit_number}</span>
                          <span className="text-xs text-inventory-300 ml-auto">{formatTime(b.created_at)}</span>
                        </div>

                        {/* Broadcast message */}
                        <div className="bg-inventory-50 rounded-xl p-3 mb-3">
                          <p className="text-sm text-inventory-700 leading-relaxed">
                            {b.message.replace(/\*\*/g, "")}
                          </p>
                        </div>

                        {/* Item tag */}
                        {b.item_query && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs bg-accent/10 text-accent px-3 py-1 rounded-full font-bold">
                              🔍 Looking for: {b.item_query}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
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
                            {repliedTo.has(b.id) ? "✓ Sent! They'll see it in their inbox" : "I have it! →"}
                          </button>
                          {!repliedTo.has(b.id) && (
                            <Link
                              href={`/dashboard?q=${encodeURIComponent(b.item_query ?? "")}`}
                              className="px-3 py-2 border border-inventory-200 text-inventory-600 rounded-xl font-display font-semibold text-xs hover:border-accent hover:text-accent transition-colors"
                            >
                              Browse
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expiry */}
                    <div className="mt-3 pt-3 border-t border-inventory-100 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-trust-high" />
                      <p className="text-xs text-inventory-400">
                        Active for {Math.max(0, Math.floor((new Date(b.expires_at).getTime() - Date.now()) / 3600000))}h more
                      </p>
                    </div>
                  </div>
                ))}
              </>
            ) : null}
          </>
        )}

        {/* MESSAGES TAB */}
        {tab === "messages" && (
          <>
            {/* Received / Sent sub-tabs */}
            <div className="flex rounded-2xl bg-inventory-100 p-1 mb-4">
              {(["received", "sent"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setMsgFilter(f)}
                  className={`flex-1 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
                    msgFilter === f ? "bg-white shadow-sm text-inventory-900" : "text-inventory-500 hover:text-inventory-700"
                  }`}
                >
                  {f === "received" ? "📥 Received" : "📤 Sent"}
                  {f === "received" && unreadMsgCount > 0 && (
                    <span className="ml-1.5 text-xs bg-accent text-white px-1.5 py-0.5 rounded-full font-bold">{unreadMsgCount}</span>
                  )}
                </button>
              ))}
            </div>

            {(() => {
              const filtered = messages.filter(m =>
                msgFilter === "received" ? m.recipient_id === myId : m.sender_id === myId
              );
              const person = (m: MessageNotif) => msgFilter === "received" ? m.sender : m.recipient;

              if (filtered.length === 0) return (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <span className="text-5xl mb-4">{msgFilter === "received" ? "📥" : "📤"}</span>
                  <p className="font-display font-bold text-inventory-700 mb-2">
                    {msgFilter === "received" ? "No messages received yet" : "No messages sent yet"}
                  </p>
                  <p className="text-sm text-inventory-400 mb-6">
                    {msgFilter === "received" ? "When neighbors message you, they'll appear here." : "Message a neighbor from any item page."}
                  </p>
                  {msgFilter === "sent" && (
                    <Link href="/dashboard" className="px-5 py-2.5 bg-accent text-white rounded-xl font-display font-semibold text-sm">
                      Browse Items →
                    </Link>
                  )}
                </div>
              );

              return filtered.map((msg) => {
                const p = person(msg);
                return (
                  <Link
                    key={msg.id}
                    href={`/inbox?with=${p?.id}`}
                    className={`glass rounded-2xl p-4 flex items-start gap-3 card-hover block ${msgFilter === "received" && !msg.read_at ? "border-l-4 border-l-accent" : ""}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {p?.avatar_url
                        ? <img src={p.avatar_url} className="w-full h-full object-cover" />
                        : <span className="font-bold text-accent text-sm">{p?.display_name?.[0] ?? "?"}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <p className="font-display font-bold text-sm">{p?.display_name}</p>
                          <span className="text-xs text-inventory-400">Unit {p?.unit_number}</span>
                        </div>
                        <span className="text-xs text-inventory-400 flex-shrink-0">{formatTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm text-inventory-600 truncate">{msg.content}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {msgFilter === "received" && !msg.read_at && (
                          <span className="text-xs bg-accent/10 text-accent font-bold px-2 py-0.5 rounded-full">New</span>
                        )}
                        {msgFilter === "sent" && (
                          <span className="text-xs text-inventory-400">Tap to continue conversation →</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              });
            })()}
          </>
        )}
      </div>
    </main>
  );
}
