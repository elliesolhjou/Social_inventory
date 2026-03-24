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
function formatDeposit(cents: number) {
  return cents > 0 ? `$${(cents / 100).toFixed(0)} deposit` : "Free to borrow";
}

function renderMd(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="font-bold text-[#ae3200]">{p.slice(2, -2)}</strong>
      : p
  );
}

function isRelatedNotExact(content: string): boolean {
  const lower = content.toLowerCase();
  return lower.includes("couldn't find") || lower.includes("could not find") ||
    lower.includes("no exact match") || lower.includes("related items") ||
    lower.includes("might interest");
}

// ── Full-size item card ───────────────────────────────────────────────────────
function ChatItemCard({ item }: { item: ItemResult }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#e6e2de]/50 hover:border-[#ae3200]/30 hover:shadow-sm transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-[#f7f3ef] flex items-center justify-center flex-shrink-0 overflow-hidden">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <svg className="w-5 h-5 text-[#8f7067]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-['Plus_Jakarta_Sans'] font-bold text-xs text-[#1c1b1a] truncate group-hover:text-[#ae3200] transition-colors">
          {item.title}
        </p>
        <p className="text-xs text-[#8f7067] mt-0.5 font-['Be_Vietnam_Pro']">
          {item.owner.display_name} · Unit {item.owner.unit_number}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-bold text-[#ae3200]">{formatDeposit(item.deposit_cents)}</p>
        <p className="text-xs text-[#8f7067] capitalize">{item.ai_condition?.replace("_", " ")}</p>
      </div>
    </Link>
  );
}

// ── Compact item card ─────────────────────────────────────────────────────────
function CompactItemCard({ item }: { item: ItemResult }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="flex items-center gap-2 p-2 rounded-xl bg-white/80 border border-[#e6e2de]/50 hover:border-[#ae3200]/20 transition-all group"
    >
      <div className="w-7 h-7 rounded-lg bg-[#f7f3ef] flex items-center justify-center flex-shrink-0 overflow-hidden">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <svg className="w-3.5 h-3.5 text-[#8f7067]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        )}
      </div>
      <p className="text-[11px] text-[#5b4038] truncate flex-1 group-hover:text-[#ae3200] transition-colors font-['Be_Vietnam_Pro']">
        {item.title}
      </p>
      <p className="text-[10px] font-bold text-[#ae3200] flex-shrink-0">
        ${(item.deposit_cents / 100).toFixed(0)}
      </p>
    </Link>
  );
}

// ── Action buttons ────────────────────────────────────────────────────────────
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
        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-[#f7f3ef] border border-[#e6e2de]/50 hover:bg-[#ebe7e4] transition-colors text-left"
      >
        <svg className="w-4 h-4 text-[#526442] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
        </svg>
        <div>
          <p className="text-[11px] font-bold text-[#1c1b1a] font-['Plus_Jakarta_Sans']">Search nearby buildings</p>
          <p className="text-[10px] text-[#8f7067] font-['Be_Vietnam_Pro']">Check the Proxe network</p>
        </div>
      </button>
      <button
        onClick={onBroadcast}
        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-[#ae3200]/5 border border-[#ae3200]/20 hover:bg-[#ae3200]/10 transition-colors text-left"
      >
        <svg className="w-4 h-4 text-[#ae3200] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
        </svg>
        <div>
          <p className="text-[11px] font-bold text-[#ae3200] font-['Plus_Jakarta_Sans']">Ask your neighbors</p>
          <p className="text-[10px] text-[#8f7067] font-['Be_Vietnam_Pro']">Broadcast to your building</p>
        </div>
      </button>
      <a
        href={amazonUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-[#fdf9f5] border border-[#e6e2de]/50 hover:bg-[#f7f3ef] transition-colors"
      >
        <svg className="w-4 h-4 text-[#5b4038] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>
        <div>
          <p className="text-[11px] font-bold text-[#1c1b1a] font-['Plus_Jakarta_Sans']">Find on Amazon</p>
          <p className="text-[10px] text-[#8f7067] font-['Be_Vietnam_Pro']">Buy a {query}</p>
        </div>
      </a>
    </div>
  );
}

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
      <div className="w-7 h-7 rounded-full bg-[#ae3200] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
        P
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-[#e6e2de]/50 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#e6e2de] animate-bounce"
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
      content: "Hey! I'm Proxie. Ask me to find something in your building, or I can ask your neighbors for you. You can also drop a photo!",
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

  // Listen for "open-miles" custom events from other components
  // Supports optional prompt: new CustomEvent("open-miles", { detail: { prompt: "..." } })
  useEffect(() => {
    const handler = (e: Event) => {
      setOpen(true);
      const detail = (e as CustomEvent)?.detail;
      if (detail?.prompt) {
        setInput(detail.prompt);
        // Auto-focus so user can review and hit Enter
        setTimeout(() => inputRef.current?.focus(), 300);
      }
    };
    window.addEventListener("open-miles", handler);
    return () => window.removeEventListener("open-miles", handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || loading) return;
    e.target.value = "";

    addMessage({ role: "user", content: "[Searching by photo...]" });
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
            className="w-[340px] sm:w-[380px] bg-white rounded-3xl shadow-2xl border border-[#e6e2de]/50 flex flex-col overflow-hidden"
            style={{ height: "520px", animation: "slideUp 0.2s ease-out" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e6e2de] bg-white flex-shrink-0">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-[#ae3200] flex items-center justify-center text-white font-bold text-sm font-['Plus_Jakarta_Sans']">
                  P
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#22c55e] border-2 border-white" />
              </div>
              <div className="flex-1">
                <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#1c1b1a]">Proxie</p>
                <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">AI Concierge · The Meridian</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-[#f7f3ef] flex items-center justify-center hover:bg-[#ebe7e4] transition-colors"
              >
                <svg className="w-4 h-4 text-[#5b4038]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-[#fdf9f5]/50">
              {messages.map((msg) => {
                const isRelated = msg.role === "assistant" && msg.action?.type === "items" && isRelatedNotExact(msg.content);
                const query = msg.action && "query" in msg.action ? msg.action.query : "";

                return (
                  <div key={msg.id} className={`flex items-end gap-2 mb-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-[#ae3200] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mb-0.5 font-['Plus_Jakarta_Sans']">
                        P
                      </div>
                    )}
                    <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-2`}>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed font-['Be_Vietnam_Pro'] ${
                          msg.role === "user"
                            ? "bg-[#ae3200] text-white rounded-br-sm"
                            : "bg-white border border-[#e6e2de]/50 shadow-sm text-[#1c1b1a] rounded-bl-sm"
                        }`}
                      >
                        {renderMd(msg.content)}
                      </div>

                      {msg.action?.type === "items" && !isRelated && (
                        <div className="w-full space-y-1.5 mt-1">
                          {msg.action.items.map((item) => (
                            <ChatItemCard key={item.id} item={item} />
                          ))}
                        </div>
                      )}

                      {msg.action?.type === "items" && isRelated && (
                        <div className="w-full mt-1">
                          {msg.action.items.length > 0 && (
                            <div className="space-y-1 mb-2">
                              <p className="text-[10px] text-[#8f7067] font-medium font-['Be_Vietnam_Pro']">Related items:</p>
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

                      {msg.action?.type === "no_results" && (
                        <NoResultsCard
                          query={msg.action.query}
                          amazonUrl={msg.action.amazonUrl}
                          onBroadcast={() => handleBroadcast(msg.action!.type === "no_results" ? (msg.action as any).query : "")}
                          onSearchNearby={() => handleSearchNearby(msg.action!.type === "no_results" ? (msg.action as any).query : "")}
                        />
                      )}

                      {msg.action?.type === "broadcast_sent" && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#526442]/10 border border-[#526442]/20 mt-1">
                          <svg className="w-4 h-4 text-[#526442]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
                          </svg>
                          <p className="text-xs text-[#526442] font-medium font-['Be_Vietnam_Pro']">Broadcast sent to neighbors</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && <TypingIndicator />}

              {messages.length === 1 && !loading && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-xs text-[#8f7067] font-medium px-1 font-['Be_Vietnam_Pro']">Try asking:</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white border border-[#e6e2de]/50 text-xs text-[#5b4038] hover:border-[#ae3200]/40 hover:text-[#ae3200] transition-colors font-medium font-['Be_Vietnam_Pro']"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-3 py-3 border-t border-[#e6e2de] bg-white">
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border-2 border-[#e6e2de] focus-within:border-[#ae3200] transition-colors bg-white">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={loading}
                  className="w-7 h-7 rounded-lg bg-[#f7f3ef] flex items-center justify-center hover:bg-[#ebe7e4] transition-colors flex-shrink-0 disabled:opacity-40"
                  title="Search by photo"
                >
                  <svg className="w-3.5 h-3.5 text-[#5b4038]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  placeholder="Ask Proxie anything..."
                  className="flex-1 text-sm outline-none bg-transparent placeholder:text-[#8f7067] text-[#1c1b1a] font-['Be_Vietnam_Pro']"
                  disabled={loading}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-xl bg-[#ae3200] text-white flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition-all flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="text-center text-xs text-[#8f7067] mt-1.5 font-['Be_Vietnam_Pro']">Proxie by Proxe</p>
            </div>
          </div>
        )}

        {/* Bubble button — Stitch green sparkle style */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative w-16 h-16 rounded-full bg-[#526442] text-white shadow-2xl hover:scale-110 active:scale-90 transition-transform flex items-center justify-center group"
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-7 h-7 group-hover:animate-pulse" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
          )}
          {unread > 0 && !open && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ae3200] text-white text-xs font-bold flex items-center justify-center">
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
