"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: string;
  created_at: string;
  read_at: string | null;
};

type Profile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  unit_number: string;
  trust_score: number;
};

type Conversation = {
  partner: Profile;
  lastMessage: Message;
  unreadCount: number;
  messages: Message[];
};

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [myId, setMyId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
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

      // Fetch all messages where I am sender or recipient
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: true });

      if (!msgs || msgs.length === 0) {
        setLoading(false);
        return;
      }

      // Group by conversation partner
      const partnerIds = [
        ...new Set(
          msgs.map((m) =>
            m.sender_id === user.id ? m.recipient_id : m.sender_id,
          ),
        ),
      ];

      const { data: profiles } = await supabase
        .from("profiles")
        .select(
          "id, display_name, username, avatar_url, unit_number, trust_score",
        )
        .in("id", partnerIds);

      const profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      const convs: Conversation[] = partnerIds
        .map((partnerId) => {
          const convMsgs = msgs.filter(
            (m) =>
              (m.sender_id === user.id && m.recipient_id === partnerId) ||
              (m.sender_id === partnerId && m.recipient_id === user.id),
          );
          const unread = convMsgs.filter(
            (m) => m.recipient_id === user.id && !m.read_at,
          ).length;
          return {
            partner: profileMap[partnerId],
            lastMessage: convMsgs[convMsgs.length - 1],
            unreadCount: unread,
            messages: convMsgs,
          };
        })
        .filter((c) => c.partner); // filter out missing profiles

      // Sort by latest message
      convs.sort(
        (a, b) =>
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime(),
      );
      setConversations(convs);

      // Auto-open conversation from URL param
      const openId = searchParams.get("with");
      if (openId) {
        const found = convs.find((c) => c.partner.id === openId);
        if (found) setActiveConv(found);
      } else if (convs.length > 0) {
        setActiveConv(convs[0]);
      }

      setLoading(false);
    };
    load();
  }, []);

  // Scroll to bottom when active conversation changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConv || !myId) return;
    setSending(true);

    const { data: msg } = await supabase
      .from("messages")
      .insert({
        sender_id: myId,
        recipient_id: activeConv.partner.id,
        content: newMessage.trim(),
        message_type: "direct",
      })
      .select()
      .single();

    if (msg) {
      const updatedMsgs = [...activeConv.messages, msg];
      const updatedConv = {
        ...activeConv,
        messages: updatedMsgs,
        lastMessage: msg,
      };
      setActiveConv(updatedConv);
      setConversations((prev) =>
        prev.map((c) =>
          c.partner.id === activeConv.partner.id ? updatedConv : c,
        ),
      );
    }

    setNewMessage("");
    setSending(false);
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  };

  function formatTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000)
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
      </main>
    );

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-inventory-200/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
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
          <h1 className="font-display font-bold text-base flex-1">Inbox</h1>
          {conversations.reduce((n, c) => n + c.unreadCount, 0) > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-accent text-white text-xs font-bold">
              {conversations.reduce((n, c) => n + c.unreadCount, 0)} new
            </span>
          )}
        </div>
      </header>

      {conversations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <span className="text-5xl mb-4">💬</span>
          <p className="font-display font-bold text-inventory-700 mb-2">
            No messages yet
          </p>
          <p className="text-sm text-inventory-400 mb-6">
            When you message a neighbor or someone messages you, it'll appear
            here.
          </p>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-accent text-white rounded-xl font-display font-semibold text-sm"
          >
            Browse Items →
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex max-w-5xl mx-auto w-full">
          {/* Conversation list */}
          <aside
            className={`w-full sm:w-72 border-r border-inventory-100 flex-shrink-0 ${activeConv ? "hidden sm:block" : "block"}`}
          >
            {conversations.map((conv) => (
              <button
                key={conv.partner.id}
                onClick={() => setActiveConv(conv)}
                className={`w-full flex items-center gap-3 px-4 py-4 border-b border-inventory-50 hover:bg-inventory-50 transition-colors text-left ${activeConv?.partner.id === conv.partner.id ? "bg-accent/5 border-l-2 border-l-accent" : ""}`}
              >
                <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {conv.partner.avatar_url ? (
                    <img
                      src={conv.partner.avatar_url}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-bold text-accent">
                      {conv.partner.display_name?.[0] ?? "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-display font-bold text-sm truncate">
                      {conv.partner.display_name}
                    </p>
                    <span className="text-xs text-inventory-400 flex-shrink-0 ml-2">
                      {formatTime(conv.lastMessage.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-inventory-400 truncate">
                    {conv.lastMessage.content}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </aside>

          {/* Message thread */}
          {activeConv ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-inventory-100 bg-white">
                <button
                  onClick={() => setActiveConv(null)}
                  className="sm:hidden text-inventory-500"
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
                </button>
                <Link
                  href={`/profile/${activeConv.partner.id}`}
                  className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
                >
                  <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden">
                    {activeConv.partner.avatar_url ? (
                      <img
                        src={activeConv.partner.avatar_url}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-accent text-sm">
                        {activeConv.partner.display_name?.[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm">
                      {activeConv.partner.display_name}
                    </p>
                    <p className="text-xs text-inventory-400">
                      Unit {activeConv.partner.unit_number}
                    </p>
                  </div>
                </Link>
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
                style={{ maxHeight: "calc(100vh - 220px)" }}
              >
                {activeConv.messages.map((msg) => {
                  const isMine = msg.sender_id === myId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-xs sm:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                          isMine
                            ? "bg-accent text-white rounded-br-md"
                            : "bg-inventory-100 text-inventory-900 rounded-bl-md"
                        }`}
                      >
                        <p className="leading-relaxed">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${isMine ? "text-white/60" : "text-inventory-400"}`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-inventory-100 bg-white flex gap-2 items-end">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Message ${activeConv.partner.display_name.split(" ")[0]}...`}
                  rows={1}
                  className="flex-1 px-4 py-2.5 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm resize-none transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !newMessage.trim()}
                  className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center flex-shrink-0 hover:bg-accent-dark transition-colors disabled:opacity-50"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
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
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 hidden sm:flex items-center justify-center text-center">
              <div>
                <span className="text-4xl mb-3 block">💬</span>
                <p className="font-display font-bold text-inventory-500">
                  Select a conversation
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
