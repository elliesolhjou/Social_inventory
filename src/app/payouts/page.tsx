"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type PayoutMethod = {
  id: string;
  method: string;
  handle: string | null;
  is_default: boolean;
  verified: boolean;
};

type PayoutRequest = {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
};

const METHOD_INFO: Record<string, { label: string; icon: string; placeholder: string; color: string; bg: string }> = {
  stripe_connect: { label: "Bank Account", icon: "🏦", placeholder: "", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
  paypal: { label: "PayPal", icon: "💳", placeholder: "PayPal email", color: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function MethodConnectCard({
  method,
  info,
  saving,
  onConnect,
}: {
  method: string;
  info: { label: string; icon: string; placeholder: string; color: string; bg: string };
  saving: boolean;
  onConnect: (handle: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [handle, setHandle] = useState("");

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${expanded ? "border-accent bg-accent/5" : "border-inventory-100 bg-white"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="text-2xl">{info.icon}</span>
        <div className="flex-1">
          <p className="font-display font-bold text-sm">{info.label}</p>
          <p className="text-[10px] text-inventory-400">Tap to connect</p>
        </div>
        <svg
          className={`w-4 h-4 text-inventory-400 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {method === "stripe_connect" ? (
            <>
              <button
                onClick={() => onConnect("stripe_connect")}
                disabled={saving}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-display font-bold text-xs disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Setting up...</>
                ) : (
                  <>🔗 Connect via Stripe</>
                )}
              </button>
              <p className="text-[10px] text-inventory-400 mt-2 text-center">
                Securely connect your bank via Stripe. Proxe never sees your bank details.
              </p>
            </>
          ) : (
            <>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder={info.placeholder}
                className="w-full px-4 py-3 rounded-xl border-2 border-inventory-200 focus:border-accent outline-none text-sm mb-2"
                autoFocus
              />
              <button
                onClick={() => onConnect(handle)}
                disabled={saving || !handle.trim()}
                className="w-full py-2.5 bg-accent text-white rounded-xl font-display font-bold text-xs disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Connecting...</>
                ) : `Connect ${info.label}`}
              </button>
              <p className="text-[10px] text-inventory-400 mt-2 text-center">
                We&apos;ll send payouts to your {info.label} account.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function PayoutsPage() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalPaidOut, setTotalPaidOut] = useState(0);
  const [available, setAvailable] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<PayoutRequest[]>([]);

  const [showAddMethod, setShowAddMethod] = useState(false);
  const [newMethod, setNewMethod] = useState<string>("paypal");
  const [saving, setSaving] = useState(false);

  const [showCashOut, setShowCashOut] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [cashingOut, setCashingOut] = useState(false);
  const [cashOutSuccess, setCashOutSuccess] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payouts/balance");
      const data = await res.json();
      setBalance(data.balance_cents ?? 0);
      setTotalEarned(data.total_earned_cents ?? 0);
      setTotalPaidOut(data.total_paid_out_cents ?? 0);
      setAvailable(data.available_cents ?? 0);
      setPendingAmount(data.pending_payout_cents ?? 0);
      setMethods(data.methods ?? []);
      setPendingPayouts(data.pending_payouts ?? []);
    } catch {
      setError("Failed to load payout data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRemoveMethod = async (id: string) => {
    try {
      await fetch("/api/payouts/methods", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchData();
    } catch {
      setError("Failed to remove method");
    }
  };

  const handleCashOut = async () => {
    const cents = Math.round(parseFloat(cashOutAmount) * 100);
    setCashingOut(true);
    setError(null);

    try {
      const defaultMethod = methods.find((m) => m.is_default);
      const res = await fetch("/api/payouts/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: cents,
          payout_method_id: defaultMethod?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCashOutSuccess(true);
      setCashOutAmount("");
      setShowCashOut(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
    setCashingOut(false);
  };

  const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-inventory-50/30 pt-6 pb-20 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/profile/me" className="w-9 h-9 rounded-full bg-inventory-100 flex items-center justify-center hover:bg-inventory-200 transition-colors">
            <svg className="w-4 h-4 text-inventory-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-display font-bold text-xl">Payouts</h1>
            <p className="text-xs text-inventory-400">Earnings & withdrawals</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-inventory-200 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Balance Card */}
            <div className="glass rounded-3xl p-6 border border-accent/10 bg-gradient-to-r from-accent/5 via-purple-50/30 to-blue-50/30 mb-4">
              <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Available Balance</p>
              <p className="font-display font-black text-4xl text-accent mb-1">{dollars(available)}</p>
              {pendingAmount > 0 && (
                <p className="text-xs text-amber-600">{dollars(pendingAmount)} pending payout</p>
              )}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white/80 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-inventory-400 uppercase">Total Earned</p>
                  <p className="font-display font-bold text-sm text-emerald-600">{dollars(totalEarned)}</p>
                </div>
                <div className="bg-white/80 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-inventory-400 uppercase">Paid Out</p>
                  <p className="font-display font-bold text-sm">{dollars(totalPaidOut)}</p>
                </div>
              </div>

              {methods.length > 0 && available >= 500 ? (
                <button
                  onClick={() => { setShowCashOut(true); setCashOutSuccess(false); }}
                  className="w-full mt-4 py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors"
                >
                  Cash Out →
                </button>
              ) : methods.length === 0 ? (
                <p className="text-xs text-center text-inventory-400 mt-4">Add a payout method to cash out</p>
              ) : (
                <p className="text-xs text-center text-inventory-400 mt-4"></p>
              )}
            </div>

            {/* Cash Out Success */}
            {cashOutSuccess && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 mb-4">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-sm font-bold text-emerald-800">Cash out request submitted!</p>
                  <p className="text-xs text-emerald-600">We&apos;ll process it within 24–48 hours.</p>
                </div>
              </div>
            )}

            {/* Cash Out Modal */}
            {showCashOut && (
              <div className="glass rounded-2xl p-5 border border-inventory-100 mb-4">
                <h3 className="font-display font-bold text-sm mb-3">Cash Out</h3>
                <div className="mb-3">
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-inventory-400 font-mono text-sm">$</span>
                    <input
                      type="number"
                      value={cashOutAmount}
                      onChange={(e) => setCashOutAmount(e.target.value)}
                      placeholder={`Max ${dollars(available)}`}
                      className="w-full pl-8 pr-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm"
                      min={5}
                      step={0.01}
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[25, 50, 100].map((pct) => {
                      const amt = Math.floor(available * pct / 100);
                      if (amt < 500) return null;
                      return (
                        <button
                          key={pct}
                          onClick={() => setCashOutAmount((amt / 100).toFixed(2))}
                          className="px-3 py-1 text-[10px] font-bold rounded-lg bg-inventory-100 text-inventory-600 hover:bg-inventory-200 transition-colors"
                        >
                          {pct}%
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCashOutAmount((available / 100).toFixed(2))}
                      className="px-3 py-1 text-[10px] font-bold rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                    >
                      Max
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-inventory-400 mb-3">
                  Payout via: <strong>{methods.find((m) => m.is_default)?.method === "stripe_connect" ? "Bank Account" : methods.find((m) => m.is_default)?.method ?? "default method"}</strong>
                  {methods.find((m) => m.is_default)?.handle && methods.find((m) => m.is_default)?.handle !== "stripe_connect" && ` (${methods.find((m) => m.is_default)?.handle})`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCashOut}
                    disabled={cashingOut || !cashOutAmount}
                    className="flex-1 py-3 bg-accent text-white rounded-2xl font-display font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {cashingOut ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
                    ) : "Confirm Cash Out"}
                  </button>
                  <button
                    onClick={() => setShowCashOut(false)}
                    className="px-4 py-3 bg-inventory-100 rounded-2xl text-sm text-inventory-600 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-100 mb-4">
                <span className="text-red-500 text-xs mt-0.5">⚠</span>
                <p className="text-red-600 text-xs">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-red-400 text-xs">✕</button>
              </div>
            )}

            {/* Payout Methods */}
            <div className="glass rounded-3xl p-5 border border-inventory-100 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-sm">Payout Methods</h2>
                <button
                  onClick={() => setShowAddMethod(!showAddMethod)}
                  className="text-xs text-accent font-bold hover:underline"
                >
                  {showAddMethod ? "Cancel" : "+ Add"}
                </button>
              </div>

              {/* Add Method Cards */}
              {showAddMethod && (
                <div className="space-y-2 mb-4">
                  {(["stripe_connect", "paypal"] as const).map((m) => {
                    const info = METHOD_INFO[m];
                    const alreadyAdded = methods.some((pm) => pm.method === m);
                    if (alreadyAdded) return null;
                    return (
                      <MethodConnectCard
                        key={m}
                        method={m}
                        info={info}
                        saving={saving && newMethod === m}
                        onConnect={async (handle) => {
                          setSaving(true);
                          setNewMethod(m);
                          setError(null);
                          try {
                            const res = await fetch("/api/payouts/methods", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ method: m, handle }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error);
                            setShowAddMethod(false);
                            fetchData();
                          } catch (err: any) {
                            setError(err.message);
                          }
                          setSaving(false);
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Connected Methods */}
              {methods.length === 0 && !showAddMethod ? (
                <div className="text-center py-6">
                  <span className="text-3xl block mb-2">💳</span>
                  <p className="text-sm text-inventory-500 mb-1">No payout methods yet</p>
                  <p className="text-xs text-inventory-400">Connect your bank account or PayPal to receive earnings</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {methods.map((m) => {
                    const info = METHOD_INFO[m.method] ?? { label: m.method, icon: "💳", color: "text-inventory-700", bg: "bg-inventory-50 border-inventory-100" };
                    return (
                      <div key={m.id} className={`flex items-center gap-3 p-3.5 rounded-2xl border ${info.bg}`}>
                        <span className="text-xl">{info.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-display font-bold text-sm ${info.color}`}>{info.label}</p>
                            {m.is_default && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">Default</span>
                            )}
                          </div>
                          <p className="text-xs text-inventory-500 truncate">
                            {m.method === "stripe_connect" ? "Connected via Stripe" : m.handle}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveMethod(m.id)}
                          className="text-inventory-300 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending Payouts */}
            {pendingPayouts.length > 0 && (
              <div className="glass rounded-3xl p-5 border border-inventory-100 mb-4">
                <h2 className="font-display font-bold text-sm mb-3">Pending Payouts</h2>
                <div className="space-y-2">
                  {pendingPayouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <div>
                        <p className="font-display font-bold text-sm text-amber-800">{dollars(p.amount_cents)}</p>
                        <p className="text-[10px] text-amber-600">{timeAgo(p.created_at)}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                        {p.status === "pending" ? "⏳ Pending" : p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How it works */}
            <div className="glass rounded-3xl p-5 border border-inventory-100">
              <h2 className="font-display font-bold text-sm mb-3">How Payouts Work</h2>
              <div className="space-y-3">
                {[
                  { icon: "📦", title: "Earn", desc: "You earn money when neighbors rent or buy your items" },
                  { icon: "💰", title: "Accumulate", desc: "Earnings are tracked in your balance automatically" },
                  { icon: "🏦", title: "Connect", desc: "Link your bank account or PayPal" },
                  { icon: "🏧", title: "Cash Out", desc: "Request a withdrawal anytime (min $5). We process within 24–48 hours." },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-lg">{step.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-inventory-700">{step.title}</p>
                      <p className="text-[10px] text-inventory-400">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
