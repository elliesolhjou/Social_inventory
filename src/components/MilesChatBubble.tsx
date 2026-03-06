"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
type ActionType =
  | { type: "items"; items: ItemResult[]; query: string }
  | { type: "no_results"; query: string; amazonUrl: string; amazonQuery: string }
  | { type: "broadcast_sent"; query: string }
  | { type: "platform_answer"; answer: string }
  | { type: "chitchat" };

type ItemResult = {
  id: string;
  title: string;
  category: string;
  deposit_cents: number;
  ai_condition: string;
  owner: { display_name: string; unit_number: string; trust_score: number };
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: ActionType;
  timestamp: Date;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCategoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    electronics: "📱", kitchen: "🍳", outdoor: "⛺", sports: "🏋️",
    tools: "🔧", entertainment: "🎮", home: "🏠", wellness: "🧘",
    travel: "✈️", creative: "🎨", clothing: "👗", music: "🎵",
  };
  return map[cat] ?? "📦";
}

function formatDeposit(cents: number) {
  return cents > 0 ? `$${(cents / 100).toFixed(0)} deposit` : "Free to borrow";
}

// Render **bold** markdown in responses
function renderMd(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="font-bold text-accent">{p.slice(2, -2)}</strong>
      : p
  );
}

// ── Item card inside chat ─────────────────────────────────────────────────────
function ChatItemCard({ item }: { item: ItemResult }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-inventory-100 hover:border-accent/30 hover:shadow-sm transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-inventory-100 flex items-center justify-center flex-shrink-0 text-lg">
        {getCategoryEmoji(item.category)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-xs text-inventory-900 truncate group-hover:text-accent transition-colors">
          {item.title}
        </p>
        <p className="text-xs text-inventory-400 mt-0.5">
          {item.owner.display_name} · Unit {item.owner.unit_number}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-bold text-accent">{formatDeposit(item.deposit_cents)}</p>
        <p className="text-xs text-inventory-300 capitalize">{item.ai_condition?.replace("_", " ")}</p>
      </div>
    </Link>
  );
}

// ── No results card ───────────────────────────────────────────────────────────
function NoResultsCard({
  query, amazonUrl, onBroadcast
}: { query: string; amazonUrl: string; onBroadcast: () => void }) {
  return (
    <div className="space-y-2 mt-2">
      <p className="text-xs text-inventory-500 font-medium">What would you like to do?</p>
      <button
        onClick={onBroadcast}
        className="w-full flex items-center gap-3 p-3 rounded-2xl bg-accent/5 border border-accent/20 hover:bg-accent/10 transition-colors text-left"
      >
        <span className="text-lg">📣</span>
        <div>
          <p className="text-xs font-bold text-accent">Ask your neighbors</p>
          <p className="text-xs text-inventory-400">Send a building-wide message</p>
        </div>
      </button>
      <a
        href={amazonUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors"
      >
        <span className="text-lg">🛒</span>
        <div>
          <p className="text-xs font-bold text-amber-800">Browse Amazon</p>
          <p className="text-xs text-amber-600">Find a {query} to buy</p>
        </div>
      </a>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
        M
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-inventory-100 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-inventory-300 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Suggested prompts ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Do you have a stand mixer?",
  "I need a drill for the weekend",
  "Anyone have camping gear?",
  "How do deposits work?",
];

// ── Main component ────────────────────────────────────────────────────────────
export default function MilesChatBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey! I'm Miles 👋 Ask me to find something in your building, or I can ask your neighbors for you.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingBroadcast, setPendingBroadcast] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
      setUnread(0);
    }
  }, [open]);

  const addMessage = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    setMessages((prev) => [...prev, { ...msg, id: crypto.randomUUID(), timestamp: new Date() }]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput("");

    addMessage({ role: "user", content: userMsg });
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/miles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history }),
      });

      const data = await res.json();

      addMessage({ role: "assistant", content: data.response, action: data.action });

      if (!open) setUnread((n) => n + 1);
    } catch {
      addMessage({ role: "assistant", content: "Oops, something went wrong. Try again!" });
    } finally {
      setLoading(false);
    }
  }, [messages, loading, addMessage, open]);

  const handleBroadcast = useCallback(async (query: string) => {
    setPendingBroadcast(null);
    addMessage({ role: "user", content: `Yes, ask my neighbors about a ${query}` });
    setLoading(true);

    try {
      const res = await fetch("/api/miles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, broadcastConfirmed: true }),
      });
      const data = await res.json();
      addMessage({ role: "assistant", content: data.response, action: data.action });
    } catch {
      addMessage({ role: "assistant", content: "Couldn't send the broadcast. Try again!" });
    } finally {
      setLoading(false);
    }
  }, [addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* ── Floating bubble ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

        {/* Chat window */}
        {open && (
          <div
            className="w-[340px] sm:w-[380px] bg-white rounded-3xl shadow-2xl border border-inventory-100 flex flex-col overflow-hidden"
            style={{ height: "520px", animation: "slideUp 0.2s ease-out" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-inventory-100 bg-white flex-shrink-0">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm">
                  M
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-trust-high border-2 border-white" />
              </div>
              <div className="flex-1">
                <p className="font-display font-bold text-sm">Miles</p>
                <p className="text-xs text-inventory-400">AI Concierge · The Meridian</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-inventory-100 flex items-center justify-center hover:bg-inventory-200 transition-colors"
              >
                <svg className="w-4 h-4 text-inventory-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-inventory-50/50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex items-end gap-2 mb-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mb-0.5">
                      M
                    </div>
                  )}
                  <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-2`}>
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-accent text-white rounded-br-sm"
                          : "bg-white border border-inventory-100 shadow-sm text-inventory-900 rounded-bl-sm"
                      }`}
                    >
                      {renderMd(msg.content)}
                    </div>

                    {/* Action cards */}
                    {msg.action?.type === "items" && (
                      <div className="w-full space-y-1.5 mt-1">
                        {msg.action.items.map((item) => (
                          <ChatItemCard key={item.id} item={item} />
                        ))}
                      </div>
                    )}

                    {msg.action?.type === "no_results" && (
                      <NoResultsCard
                        query={msg.action.query}
                        amazonUrl={msg.action.amazonUrl}
                        onBroadcast={() => handleBroadcast(msg.action!.type === "no_results" ? (msg.action as any).query : "")}
                      />
                    )}

                    {msg.action?.type === "broadcast_sent" && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-trust-high/10 border border-trust-high/20 mt-1">
                        <span>📣</span>
                        <p className="text-xs text-trust-high font-medium">Broadcast sent to neighbors</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && <TypingIndicator />}

              {/* Suggestions — only show when just welcome message */}
              {messages.length === 1 && !loading && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-xs text-inventory-400 font-medium px-1">Try asking:</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white border border-inventory-100 text-xs text-inventory-600 hover:border-accent/40 hover:text-accent transition-colors font-medium"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-3 py-3 border-t border-inventory-100 bg-white">
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border-2 border-inventory-200 focus-within:border-accent transition-colors bg-white">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Miles anything..."
                  className="flex-1 text-sm outline-none bg-transparent placeholder:text-inventory-400"
                  disabled={loading}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center disabled:opacity-40 hover:bg-accent-dark transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="text-center text-xs text-inventory-300 mt-1.5">Miles by Anbo</p>
            </div>
          </div>
        )}

        {/* Bubble button */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative w-14 h-14 rounded-full bg-accent text-white shadow-lg hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
          style={{ boxShadow: "0 4px 20px rgba(255, 90, 31, 0.4)" }}
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <span className="font-display font-black text-lg">M</span>
          )}
          {unread > 0 && !open && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
