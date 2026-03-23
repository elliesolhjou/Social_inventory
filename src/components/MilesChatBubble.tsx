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
  thumbnail_url?: string;
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

// Check if Miles's response indicates "related but not exact"
function isRelatedNotExact(content: string): boolean {
  const lower = content.toLowerCase();
  return lower.includes("couldn't find") || lower.includes("could not find") ||
    lower.includes("no exact match") || lower.includes("related items") ||
    lower.includes("might interest");
}

// ── Full-size item card (exact matches) ───────────────────────────────────────
function ChatItemCard({ item }: { item: ItemResult }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-inventory-100 hover:border-accent/30 hover:shadow-sm transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-inventory-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg">{getCategoryEmoji(item.category)}</span>
        )}
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

// ── Compact item card (related/not exact matches) ─────────────────────────────
function CompactItemCard({ item }: { item: ItemResult }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="flex items-center gap-2 p-2 rounded-xl bg-white/80 border border-inventory-100 hover:border-accent/20 transition-all group"
    >
      <div className="w-7 h-7 rounded-lg bg-inventory-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs">{getCategoryEmoji(item.category)}</span>
        )}
      </div>
      <p className="text-[11px] text-inventory-600 truncate flex-1 group-hover:text-accent transition-colors">
        {item.title}
      </p>
      <p className="text-[10px] font-bold text-accent flex-shrink-0">
        ${(item.deposit_cents / 100).toFixed(0)}
      </p>
    </Link>
  );
}

// ── Action buttons (search nearby, broadcast, amazon) ─────────────────────────
function ActionButtons({
  query, amazonUrl, onBroadcast, onSearchNearby
}: {
  query: string;
  amazonUrl: string;
  onBroadcast: () => void;
  onSearchNearby: () => void;
}) {
  return (
    <div className="space-y-1.5 mt-2">
      <button
        onClick={onSearchNearby}
        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors text-left"
      >
        <span className="text-sm">🏘️</span>
        <div>
          <p className="text-[11px] font-bold text-blue-800">Search nearby buildings</p>
          <p className="text-[10px] text-blue-500">Check the Proxe network</p>
        </div>
      </button>
      <button
        onClick={onBroadcast}
        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-accent/5 border border-accent/20 hover:bg-accent/10 transition-colors text-left"
      >
        <span className="text-sm">📣</span>
        <div>
          <p className="text-[11px] font-bold text-accent">Ask your neighbors</p>
          <p className="text-[10px] text-inventory-400">Broadcast to The Meridian</p>
        </div>
      </button>
      <a
        href={amazonUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors"
      >
        <span className="text-sm">🛒</span>
        <div>
          <p className="text-[11px] font-bold text-amber-800">Find on Amazon</p>
          <p className="text-[10px] text-amber-600">Buy a {query}</p>
        </div>
      </a>
    </div>
  );
}

// ── No results card (wraps ActionButtons) ─────────────────────────────────────
function NoResultsCard({
  query, amazonUrl, onBroadcast, onSearchNearby
}: {
  query: string;
  amazonUrl: string;
  onBroadcast: () => void;
  onSearchNearby: () => void;
}) {
  return (
    <ActionButtons
      query={query}
      amazonUrl={amazonUrl}
      onBroadcast={onBroadcast}
      onSearchNearby={onSearchNearby}
    />
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
      content: "Hey! I'm Miles 👋 Ask me to find something in your building, or I can ask your neighbors for you. You can also drop a photo!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingBroadcast, setPendingBroadcast] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  // ── Photo upload for visual search via Miles ──────────────────────────────
  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || loading) return;
    e.target.value = "";

    addMessage({ role: "user", content: "📷 [Searching by photo...]" });
    setLoading(true);

    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/search/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame: dataUrl }),
      });

      const data = await res.json();

      if (data.results && data.results.length > 0) {
        addMessage({
          role: "assistant",
          content: data.miles_message || `Found ${data.results.length} matching items!`,
          action: { type: "items", items: data.results, query: "photo search" },
        });
      } else {
        addMessage({
          role: "assistant",
          content: data.miles_message || "I couldn't find anything matching that photo in your building.",
          action: {
            type: "no_results",
            query: "your photo",
            amazonUrl: "https://www.amazon.com",
            amazonQuery: "item",
          },
        });
      }
    } catch {
      addMessage({ role: "assistant", content: "Couldn't process that photo. Try again!" });
    } finally {
      setLoading(false);
    }
  }, [loading, addMessage]);

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

  const handleSearchNearby = useCallback(async (query: string) => {
    addMessage({ role: "user", content: `Search nearby buildings for ${query}` });
    setLoading(true);

    try {
      const res = await fetch("/api/miles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `search other buildings for ${query}`,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      addMessage({ role: "assistant", content: data.response, action: data.action });
    } catch {
      addMessage({ role: "assistant", content: "Couldn't search nearby buildings. Try again!" });
    } finally {
      setLoading(false);
    }
  }, [messages, addMessage]);

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
              {messages.map((msg) => {
                const isRelated = msg.role === "assistant" && msg.action?.type === "items" && isRelatedNotExact(msg.content);
                const query = msg.action && "query" in msg.action ? msg.action.query : "";

                return (
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

                      {/* Exact match items — full size cards */}
                      {msg.action?.type === "items" && !isRelated && (
                        <div className="w-full space-y-1.5 mt-1">
                          {msg.action.items.map((item) => (
                            <ChatItemCard key={item.id} item={item} />
                          ))}
                        </div>
                      )}

                      {/* Related items — compact cards + action buttons */}
                      {msg.action?.type === "items" && isRelated && (
                        <div className="w-full mt-1">
                          {msg.action.items.length > 0 && (
                            <div className="space-y-1 mb-2">
                              <p className="text-[10px] text-inventory-400 font-medium">Related items:</p>
                              {msg.action.items.map((item) => (
                                <CompactItemCard key={item.id} item={item} />
                              ))}
                            </div>
                          )}
                          <ActionButtons
                            query={query}
                            amazonUrl={`https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=proxe-20`}
                            onBroadcast={() => handleBroadcast(query)}
                            onSearchNearby={() => handleSearchNearby(query)}
                          />
                        </div>
                      )}

                      {/* No results — action buttons only */}
                      {msg.action?.type === "no_results" && (
                        <NoResultsCard
                          query={msg.action.query}
                          amazonUrl={msg.action.amazonUrl}
                          onBroadcast={() => handleBroadcast(msg.action!.type === "no_results" ? (msg.action as any).query : "")}
                          onSearchNearby={() => handleSearchNearby(msg.action!.type === "no_results" ? (msg.action as any).query : "")}
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
                );
              })}

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
                {/* Photo upload button */}
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={loading}
                  className="w-7 h-7 rounded-lg bg-inventory-100 flex items-center justify-center hover:bg-inventory-200 transition-colors flex-shrink-0 disabled:opacity-40"
                  title="Search by photo"
                >
                  <svg className="w-3.5 h-3.5 text-inventory-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
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
              <p className="text-center text-xs text-inventory-300 mt-1.5">Miles by Proxe</p>
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
