"use client";

import { useState, useMemo } from "react";

export interface ItemFormData {
  title: string;
  category: string;
  subcategory: string;
  description: string;
  ai_description: string;
  condition: string;
  ai_condition: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  original_price_cents: number | null;
  suggested_deposit_cents: number;
  deposit_cents: number;
  max_borrow_days: number;
  rules: string;
  confidence: number;
  metadata: any;
  borrow_available: boolean;
  rent_available: boolean;
  sell_available: boolean;
  rent_price_day_cents: number | null;
  rent_price_month_cents: number | null;
  sell_price_cents: number | null;
  estimated_market_value_cents: number | null;
}

interface ItemReviewFormProps {
  data: ItemFormData;
  onSubmit: (data: ItemFormData) => void;
  onBack: () => void;
  isSubmitting: boolean;
  frames?: string[];
  buildingName?: string;
}

const CATEGORIES = [
  "electronics", "kitchen", "outdoor", "sports", "tools", "entertainment",
  "home", "wellness", "travel", "creative", "beauty", "clothing",
  "baby_kids", "music", "automotive",
];

const CONDITIONS = [
  { value: "excellent", label: "Excellent", desc: "Pristine, like brand new", multiplier: 0.9 },
  { value: "like_new", label: "Like New", desc: "No visible wear", multiplier: 0.8 },
  { value: "good", label: "Good", desc: "Minor signs of use", multiplier: 0.65 },
  { value: "fair", label: "Fair", desc: "Noticeable wear but functional", multiplier: 0.5 },
  { value: "worn", label: "Worn", desc: "Significant wear", multiplier: 0.35 },
];

function getConditionMultiplier(condition: string): number {
  return CONDITIONS.find((c) => c.value === condition)?.multiplier ?? 0.65;
}

function calculatePricing(originalPriceCents: number | null, condition: string) {
  if (!originalPriceCents || originalPriceCents <= 0) {
    return { marketValue: 0, deposit: 0, rentDay: 0, rentMonth: 0, sellPrice: 0 };
  }
  const m = getConditionMultiplier(condition);
  const mv = Math.round(originalPriceCents * m);
  return { marketValue: mv, deposit: Math.round(mv * 0.15), rentDay: Math.round(mv * 0.03), rentMonth: Math.round(mv * 0.03 * 22), sellPrice: mv };
}

function MoneyInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <div className="flex items-center rounded-xl border border-[#e6e2de] bg-white focus-within:border-[#ae3200] transition-colors overflow-hidden">
      <span className="pl-3 pr-1 text-[#5b4038] font-mono text-sm select-none shrink-0">$</span>
      <input type="number" value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="flex-1 bg-transparent text-sm py-2.5 pr-3 outline-none text-[#1c1b1a] font-['Be_Vietnam_Pro']"
        min={0} placeholder={placeholder} />
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors ${checked ? "bg-[#ae3200]" : "bg-[#e6e2de]"}`}>
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-0"}`} />
    </button>
  );
}

function FieldGroup({ label, aiLabel, children }: { label: string; aiLabel?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-bold text-[#5b4038] uppercase tracking-[0.15em] font-['Plus_Jakarta_Sans']">{label}</span>
        {aiLabel && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#ae3200]/10 text-[#ae3200] font-mono font-bold">AI</span>}
      </label>
      {children}
    </div>
  );
}

export default function ItemReviewForm({ data, onSubmit, onBack, isSubmitting, frames = [], buildingName = "your building" }: ItemReviewFormProps) {
  const [form, setForm] = useState<ItemFormData>({
    ...data,
    borrow_available: data.borrow_available ?? true,
    rent_available: data.rent_available ?? false,
    sell_available: data.sell_available ?? false,
    rent_price_day_cents: data.rent_price_day_cents ?? null,
    rent_price_month_cents: data.rent_price_month_cents ?? null,
    sell_price_cents: data.sell_price_cents ?? null,
    estimated_market_value_cents: data.estimated_market_value_cents ?? data.original_price_cents ?? null,
  });

  const suggested = useMemo(() => calculatePricing(form.original_price_cents, form.condition), [form.original_price_cents, form.condition]);

  const update = (field: keyof ItemFormData, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "condition" || field === "original_price_cents") {
        const s = calculatePricing(field === "original_price_cents" ? value : next.original_price_cents, field === "condition" ? value : next.condition);
        next.suggested_deposit_cents = s.deposit;
        next.estimated_market_value_cents = s.marketValue;
        if (next.rent_available) { next.rent_price_day_cents = s.rentDay; next.rent_price_month_cents = s.rentMonth; }
        if (next.sell_available) { next.sell_price_cents = s.sellPrice; }
      }
      return next;
    });
  };

  const toggleMode = (mode: "borrow_available" | "rent_available" | "sell_available") => {
    setForm((prev) => {
      const next = { ...prev, [mode]: !prev[mode] };
      if (!prev[mode]) {
        if (mode === "rent_available") { next.rent_price_day_cents = next.rent_price_day_cents ?? suggested.rentDay; next.rent_price_month_cents = next.rent_price_month_cents ?? suggested.rentMonth; }
        if (mode === "sell_available") { next.sell_price_cents = next.sell_price_cents ?? suggested.sellPrice; }
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(form); };
  const showRentToOwn = form.rent_available && form.sell_available;

  return (
    <div className="space-y-8 animate-slide-up">
      {/* TWO-COLUMN: Photos + Form */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">

        {/* Left: Photo + Proxie Strategy */}
        <div className="md:col-span-5 space-y-5">
          {frames.length > 0 && (
            <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-[#1c1b1a]">
              <img src={frames[0]} alt="Item preview" className="w-full h-full object-cover" />
              {frames.length > 1 && (
                <div className="absolute bottom-3 left-3 right-3 flex gap-1.5">
                  {frames.slice(0, 5).map((f, i) => (
                    <div key={i} className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white/50 flex-shrink-0">
                      <img src={f} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {frames.length > 5 && (
                    <div className="w-12 h-12 rounded-lg bg-black/50 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">+{frames.length - 5}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Proxie Pricing Strategy */}
          {form.original_price_cents && suggested.marketValue > 0 && (
            <div className="bg-[#d2e6bc]/30 border border-[#526442]/10 p-5 rounded-2xl relative overflow-hidden">
              <div className="flex gap-3 items-start relative z-10">
                <div className="bg-[#526442] text-white p-2 rounded-full flex-shrink-0">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
                </div>
                <div>
                  <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#526442] text-sm mb-1">Proxie Pricing Strategy</p>
                  <p className="text-[#3b4c2c] text-sm leading-relaxed font-['Be_Vietnam_Pro']">
                    Based on {form.condition.replace(/_/g, " ")} condition, I suggest{" "}
                    {form.rent_available && suggested.rentDay > 0 && (<><span className="font-bold text-[#526442]">${(suggested.rentDay / 100).toFixed(0)}/day</span> for renting to get booked quickly.</>)}
                    {!form.rent_available && form.borrow_available && (<>a <span className="font-bold text-[#526442]">${(form.suggested_deposit_cents / 100).toFixed(0)} deposit</span> for borrowing.</>)}
                  </p>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-[#526442]/5 rounded-full blur-2xl pointer-events-none" />
            </div>
          )}
        </div>

        {/* Right: Form Fields */}
        <div className="md:col-span-7 space-y-5">
          <FieldGroup label="Item Name" aiLabel>
            <input type="text" value={form.title} onChange={(e) => update("title", e.target.value)} className="form-input" placeholder="What is this item?" />
          </FieldGroup>

          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Brand" aiLabel>
              <input type="text" value={form.brand ?? ""} onChange={(e) => update("brand", e.target.value || null)} className="form-input" placeholder="Brand" />
            </FieldGroup>
            <FieldGroup label="Model" aiLabel>
              <input type="text" value={form.model ?? ""} onChange={(e) => update("model", e.target.value || null)} className="form-input" placeholder="Model" />
            </FieldGroup>
          </div>

          <FieldGroup label="AI-Generated Description" aiLabel>
            <textarea value={form.ai_description || form.description} onChange={(e) => update("ai_description", e.target.value)} className="form-input min-h-[100px] resize-none" rows={4} placeholder="AI description" />
          </FieldGroup>

          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Category" aiLabel>
              <select value={form.category} onChange={(e) => update("category", e.target.value)} className="form-input">
                {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>))}
              </select>
            </FieldGroup>
            <FieldGroup label="Condition" aiLabel>
              <select value={form.condition} onChange={(e) => update("condition", e.target.value)} className="form-input">
                {CONDITIONS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* SPECTRUM PRICING — Stitch style full-width */}
      <div className="bg-[#f7f3ef] rounded-2xl p-6 sm:p-8 border border-[#e6e2de]/30">
        <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-[#ae3200]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Spectrum Pricing
        </h3>

        <div className="space-y-4">
          {/* Lend for Free */}
          <div className={`p-5 bg-white rounded-xl shadow-sm transition-all ${form.borrow_available ? "border-2 border-[#526442]/30" : "border border-[#e6e2de]"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${form.borrow_available ? "bg-[#d2e6bc] text-[#526442]" : "bg-[#ebe7e4] text-[#8f7067]"}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21" /></svg>
                </div>
                <div><p className="font-['Plus_Jakarta_Sans'] font-bold">Lend for Free</p><p className="text-xs text-[#8f7067]">Community favor</p></div>
              </div>
              <Toggle checked={form.borrow_available} onChange={() => toggleMode("borrow_available")} />
            </div>
          </div>

          {/* Rent Daily */}
          <div className={`p-5 bg-white rounded-xl shadow-sm transition-all ${form.rent_available ? "border-2 border-[#ff5a1f]" : "border border-[#e6e2de]"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${form.rent_available ? "bg-[#ff5a1f] text-white" : "bg-[#ebe7e4] text-[#8f7067]"}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>
                </div>
                <div><p className="font-['Plus_Jakarta_Sans'] font-bold">Rent Daily</p><p className="text-xs text-[#8f7067]">Generate passive income</p></div>
              </div>
              <div className="flex items-center gap-2">
                {form.rent_available && (
                  <MoneyInput value={form.rent_price_day_cents ? Math.round(form.rent_price_day_cents / 100) : 0}
                    onChange={(v) => update("rent_price_day_cents", Math.round(v * 100))} />
                )}
                <Toggle checked={form.rent_available} onChange={() => toggleMode("rent_available")} />
              </div>
            </div>
          </div>

          {/* Buy */}
          <div className={`p-5 bg-white rounded-xl shadow-sm transition-all ${form.sell_available ? "border-2 border-[#ae3200]/30" : "border border-[#e6e2de]"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${form.sell_available ? "bg-[#ae3200]/10 text-[#ae3200]" : "bg-[#ebe7e4] text-[#8f7067]"}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
                </div>
                <div><p className="font-['Plus_Jakarta_Sans'] font-bold">Buy</p><p className="text-xs text-[#8f7067]">Sell to a neighbor</p></div>
              </div>
              <Toggle checked={form.sell_available} onChange={() => toggleMode("sell_available")} />
            </div>
          </div>

          {/* Security Deposit */}
          <div className="space-y-2">
            <h4 className="font-['Plus_Jakarta_Sans'] font-bold italic text-base">Security Deposit</h4>
            <MoneyInput value={Math.round(form.suggested_deposit_cents / 100)}
              onChange={(v) => update("suggested_deposit_cents", Math.round(v * 100))}
              placeholder={suggested.deposit ? `Suggested: $${(suggested.deposit / 100).toFixed(0)}` : "Suggested: $150"} />
            <p className="text-[10px] text-[#8f7067] uppercase tracking-[0.15em] font-bold font-['Plus_Jakarta_Sans']">Recommended for high-value items</p>
          </div>

          {/* Rent-to-Own */}
          {showRentToOwn && (
            <div className="p-4 rounded-xl bg-[#e2dfff]/20 border border-[#4e4ccf]/20">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#4e4ccf]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
                <div>
                  <p className="text-xs font-bold text-[#4e4ccf] font-['Plus_Jakarta_Sans']">Rent-to-Own Eligible</p>
                  <p className="text-[10px] text-[#5b4038]">80% of rental fees apply toward the purchase price.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rules */}
      <FieldGroup label="Rules or Care Instructions" aiLabel>
        <textarea value={form.rules} onChange={(e) => update("rules", e.target.value)}
          className="form-input min-h-[60px] resize-none" rows={2}
          placeholder="e.g., 'Please clean after use' or 'Don't use with oily beans'" />
      </FieldGroup>

      {/* Publish */}
      <div className="pt-2">
        <button onClick={handleSubmit} disabled={isSubmitting || !form.title}
          className={`w-full py-5 rounded-full font-['Plus_Jakarta_Sans'] font-extrabold text-xl transition-all flex items-center justify-center gap-3 ${
            isSubmitting || !form.title
              ? "bg-[#ebe7e4] text-[#8f7067] cursor-not-allowed"
              : "bg-[#ff5a1f] text-white hover:brightness-110 active:scale-[0.98] shadow-[0_20px_40px_rgba(255,90,31,0.25)]"
          }`}>
          {isSubmitting ? (
            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Publishing...</>
          ) : (
            <>Publish Item <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" /></svg></>
          )}
        </button>
        <p className="text-center text-[#5b4038] text-sm mt-4 font-['Be_Vietnam_Pro']">
          Visible to everyone in <span className="font-bold">{buildingName}</span>
        </p>
        <p className="text-center text-[#8f7067] text-xs mt-2 font-['Be_Vietnam_Pro']">
          Proxie is AI and can make mistakes. Please double-check all details before publishing.
        </p>
      </div>
    </div>
  );
}
