"use client";

import { useState, useMemo } from "react";

export interface ItemFormData {
  title: string;
  category: string;
  subcategory: string;
  description: string;
  ai_description: string;
  condition: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  original_price_cents: number | null;
  suggested_deposit_cents: number;
  max_borrow_days: number;
  rules: string;
  confidence: number;
  // Spectrum Pricing fields
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
}

const CATEGORIES = [
  "electronics",
  "kitchen",
  "outdoor",
  "sports",
  "tools",
  "entertainment",
  "home",
  "wellness",
  "travel",
  "creative",
  "beauty",
  "clothing",
  "baby_kids",
  "music",
  "automotive",
];

const CONDITIONS = [
  {
    value: "like_new",
    label: "Like New",
    desc: "No visible wear",
    multiplier: 0.8,
  },
  {
    value: "good",
    label: "Good",
    desc: "Minor signs of use",
    multiplier: 0.65,
  },
  {
    value: "fair",
    label: "Fair",
    desc: "Noticeable wear but functional",
    multiplier: 0.5,
  },
  { value: "worn", label: "Worn", desc: "Significant wear", multiplier: 0.35 },
];

function getConditionMultiplier(condition: string): number {
  return CONDITIONS.find((c) => c.value === condition)?.multiplier ?? 0.65;
}

function calculatePricing(
  originalPriceCents: number | null,
  condition: string,
) {
  if (!originalPriceCents || originalPriceCents <= 0) {
    return {
      marketValue: 0,
      deposit: 0,
      rentDay: 0,
      rentMonth: 0,
      sellPrice: 0,
    };
  }
  const multiplier = getConditionMultiplier(condition);
  const marketValue = Math.round(originalPriceCents * multiplier);
  return {
    marketValue,
    deposit: Math.round(marketValue * 0.15),
    rentDay: Math.round(marketValue * 0.03),
    rentMonth: Math.round(marketValue * 0.03 * 22), // 30% monthly discount
    sellPrice: marketValue,
  };
}

export default function ItemReviewForm({
  data,
  onSubmit,
  onBack,
  isSubmitting,
}: ItemReviewFormProps) {
  const [form, setForm] = useState<ItemFormData>({
    ...data,
    borrow_available: data.borrow_available ?? true,
    rent_available: data.rent_available ?? false,
    sell_available: data.sell_available ?? false,
    rent_price_day_cents: data.rent_price_day_cents ?? null,
    rent_price_month_cents: data.rent_price_month_cents ?? null,
    sell_price_cents: data.sell_price_cents ?? null,
    estimated_market_value_cents:
      data.estimated_market_value_cents ?? data.original_price_cents ?? null,
  });

  // Auto-calculate suggested prices when condition or retail price changes
  const suggested = useMemo(
    () => calculatePricing(form.original_price_cents, form.condition),
    [form.original_price_cents, form.condition],
  );

  const update = (field: keyof ItemFormData, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      // When condition changes, recalculate suggested prices if user hasn't manually edited
      if (field === "condition" || field === "original_price_cents") {
        const newSuggested = calculatePricing(
          field === "original_price_cents" ? value : next.original_price_cents,
          field === "condition" ? value : next.condition,
        );
        next.suggested_deposit_cents = newSuggested.deposit;
        next.estimated_market_value_cents = newSuggested.marketValue;
        if (next.rent_available) {
          next.rent_price_day_cents = newSuggested.rentDay;
          next.rent_price_month_cents = newSuggested.rentMonth;
        }
        if (next.sell_available) {
          next.sell_price_cents = newSuggested.sellPrice;
        }
      }

      return next;
    });
  };

  // Toggle pricing mode with auto-fill
  const toggleMode = (
    mode: "borrow_available" | "rent_available" | "sell_available",
  ) => {
    setForm((prev) => {
      const next = { ...prev, [mode]: !prev[mode] };
      // Auto-fill prices when toggling on
      if (!prev[mode]) {
        if (mode === "rent_available") {
          next.rent_price_day_cents =
            next.rent_price_day_cents ?? suggested.rentDay;
          next.rent_price_month_cents =
            next.rent_price_month_cents ?? suggested.rentMonth;
        }
        if (mode === "sell_available") {
          next.sell_price_cents = next.sell_price_cents ?? suggested.sellPrice;
        }
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const showRentToOwn = form.rent_available && form.sell_available;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Confidence indicator */}
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
            form.confidence >= 0.8
              ? "bg-trust-high/10 text-trust-high"
              : form.confidence >= 0.5
                ? "bg-trust-medium/10 text-trust-medium"
                : "bg-trust-low/10 text-trust-low"
          }`}
        >
          {form.confidence >= 0.8 ? "✓" : form.confidence >= 0.5 ? "?" : "!"}
        </div>
        <div className="flex-1">
          <p className="font-display font-bold text-sm">
            {form.confidence >= 0.8
              ? "High confidence identification"
              : form.confidence >= 0.5
                ? "Moderate confidence — please review"
                : "Low confidence — please edit details"}
          </p>
          <p className="text-xs text-inventory-400">
            AI confidence: {(form.confidence * 100).toFixed(0)}% · Review and
            edit anything below before publishing
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Title */}
        <FieldGroup label="Item Name" aiLabel>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="form-input"
            placeholder="What is this item?"
          />
        </FieldGroup>

        {/* Category + Subcategory */}
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Category" aiLabel>
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className="form-input"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup label="Subcategory" aiLabel>
            <input
              type="text"
              value={form.subcategory}
              onChange={(e) => update("subcategory", e.target.value)}
              className="form-input"
              placeholder="e.g. drone, stand_mixer"
            />
          </FieldGroup>
        </div>

        {/* Description */}
        <FieldGroup label="Description" aiLabel>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className="form-input min-h-[80px] resize-none"
            rows={3}
            placeholder="A friendly description for your neighbors"
          />
        </FieldGroup>

        {/* AI Technical Description */}
        <FieldGroup label="AI Technical Notes" aiLabel>
          <div className="p-3 rounded-xl bg-inventory-50 border border-inventory-100 text-sm text-inventory-600">
            {form.ai_description}
          </div>
        </FieldGroup>

        {/* Condition */}
        <FieldGroup label="Condition" aiLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => update("condition", c.value)}
                className={`p-3 rounded-xl text-center transition-all ${
                  form.condition === c.value
                    ? "bg-accent text-white ring-2 ring-accent ring-offset-2"
                    : "bg-inventory-50 text-inventory-700 hover:bg-inventory-100"
                }`}
              >
                <span className="block font-display font-bold text-sm">
                  {c.label}
                </span>
                <span
                  className={`block text-xs mt-0.5 ${form.condition === c.value ? "text-white/80" : "text-inventory-400"}`}
                >
                  {c.desc}
                </span>
              </button>
            ))}
          </div>
        </FieldGroup>

        {/* Brand / Model / Color row */}
        <div className="grid grid-cols-3 gap-4">
          <FieldGroup label="Brand" aiLabel>
            <input
              type="text"
              value={form.brand ?? ""}
              onChange={(e) => update("brand", e.target.value || null)}
              className="form-input"
              placeholder="Brand"
            />
          </FieldGroup>
          <FieldGroup label="Model" aiLabel>
            <input
              type="text"
              value={form.model ?? ""}
              onChange={(e) => update("model", e.target.value || null)}
              className="form-input"
              placeholder="Model"
            />
          </FieldGroup>
          <FieldGroup label="Color" aiLabel>
            <input
              type="text"
              value={form.color ?? ""}
              onChange={(e) => update("color", e.target.value || null)}
              className="form-input"
              placeholder="Color"
            />
          </FieldGroup>
        </div>

        {/* Estimated Retail Price */}
        <FieldGroup label="Estimated Retail Price" aiLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-inventory-400 font-mono text-sm">
              $
            </span>
            <input
              type="number"
              value={
                form.original_price_cents
                  ? Math.round(form.original_price_cents / 100)
                  : ""
              }
              onChange={(e) =>
                update(
                  "original_price_cents",
                  e.target.value
                    ? Math.round(Number(e.target.value) * 100)
                    : null,
                )
              }
              className="form-input pl-7"
              min={0}
              placeholder="What does this cost new?"
            />
          </div>
          {form.original_price_cents && (
            <p className="text-[10px] text-inventory-400 mt-1">
              Market value ({form.condition.replace(/_/g, " ")}): $
              {(suggested.marketValue / 100).toFixed(0)}
            </p>
          )}
        </FieldGroup>

        {/* ════════════════════════════════════════════════════════════════
            SPECTRUM PRICING — Borrow / Rent / Buy toggles
            ════════════════════════════════════════════════════════════ */}
        <div className="glass rounded-2xl p-5 border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">💰</span>
            <h3 className="font-display text-xs font-bold text-accent uppercase tracking-widest">
              Pricing Modes
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-muted text-accent-dark font-mono font-bold ml-1">
              AI
            </span>
          </div>

          {!form.original_price_cents && (
            <p className="text-xs text-inventory-400 mb-4">
              Set an estimated retail price above to get AI-suggested pricing
              for all modes.
            </p>
          )}

          {/* BORROW */}
          <div className="space-y-4">
            <div
              className={`p-4 rounded-xl border-2 transition-all ${form.borrow_available ? "border-emerald-300 bg-emerald-50/50" : "border-inventory-100 bg-white/50"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>🤝</span>
                  <span className="font-display font-bold text-sm">Borrow</span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                    Free
                  </span>
                </div>
                <Toggle
                  checked={form.borrow_available}
                  onChange={() => toggleMode("borrow_available")}
                />
              </div>
              {form.borrow_available && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-[10px] text-inventory-400 uppercase font-bold">
                      Refundable Deposit
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-inventory-400 font-mono text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        value={Math.round(form.suggested_deposit_cents / 100)}
                        onChange={(e) =>
                          update(
                            "suggested_deposit_cents",
                            Math.round(Number(e.target.value) * 100),
                          )
                        }
                        className="form-input pl-6 text-sm py-2"
                        min={0}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-inventory-400 uppercase font-bold">
                      Max Days
                    </label>
                    <input
                      type="number"
                      value={form.max_borrow_days}
                      onChange={(e) =>
                        update("max_borrow_days", Number(e.target.value))
                      }
                      className="form-input text-sm py-2 mt-1"
                      min={1}
                      max={30}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* RENT */}
            <div
              className={`p-4 rounded-xl border-2 transition-all ${form.rent_available ? "border-blue-300 bg-blue-50/50" : "border-inventory-100 bg-white/50"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span className="font-display font-bold text-sm">Rent</span>
                </div>
                <Toggle
                  checked={form.rent_available}
                  onChange={() => toggleMode("rent_available")}
                />
              </div>
              {form.rent_available && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="text-[10px] text-inventory-400 uppercase font-bold">
                      Deposite
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-inventory-400 font-mono text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        value={
                          form.rent_price_day_cents
                            ? Math.round(form.rent_price_day_cents / 100)
                            : ""
                        }
                        onChange={(e) =>
                          update(
                            "rent_price_day_cents",
                            e.target.value
                              ? Math.round(Number(e.target.value) * 100)
                              : null,
                          )
                        }
                        className="form-input pl-6 text-sm py-2"
                        min={0}
                        placeholder={
                          suggested.rentDay
                            ? `~$${(suggested.rentDay / 100).toFixed(0)}`
                            : ""
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-inventory-400 uppercase font-bold">
                      Per Day
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-inventory-400 font-mono text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        value={
                          form.rent_price_day_cents
                            ? Math.round(form.rent_price_day_cents / 100)
                            : ""
                        }
                        onChange={(e) =>
                          update(
                            "rent_price_day_cents",
                            e.target.value
                              ? Math.round(Number(e.target.value) * 100)
                              : null,
                          )
                        }
                        className="form-input pl-6 text-sm py-2"
                        min={0}
                        placeholder={
                          suggested.rentDay
                            ? `~$${(suggested.rentDay / 100).toFixed(0)}`
                            : ""
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-inventory-400 uppercase font-bold">
                      Per Month
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-inventory-400 font-mono text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        value={
                          form.rent_price_month_cents
                            ? Math.round(form.rent_price_month_cents / 100)
                            : ""
                        }
                        onChange={(e) =>
                          update(
                            "rent_price_month_cents",
                            e.target.value
                              ? Math.round(Number(e.target.value) * 100)
                              : null,
                          )
                        }
                        className="form-input pl-6 text-sm py-2"
                        min={0}
                        placeholder={
                          suggested.rentMonth
                            ? `~$${(suggested.rentMonth / 100).toFixed(0)}`
                            : ""
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* BUY */}
            <div
              className={`p-4 rounded-xl border-2 transition-all ${form.sell_available ? "border-purple-300 bg-purple-50/50" : "border-inventory-100 bg-white/50"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>🏷️</span>
                  <span className="font-display font-bold text-sm">Buy</span>
                </div>
                <Toggle
                  checked={form.sell_available}
                  onChange={() => toggleMode("sell_available")}
                />
              </div>
              {form.sell_available && (
                <div className="mt-3">
                  <label className="text-[10px] text-inventory-400 uppercase font-bold">
                    Sale Price
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-inventory-400 font-mono text-xs">
                      $
                    </span>
                    <input
                      type="number"
                      value={
                        form.sell_price_cents
                          ? Math.round(form.sell_price_cents / 100)
                          : ""
                      }
                      onChange={(e) =>
                        update(
                          "sell_price_cents",
                          e.target.value
                            ? Math.round(Number(e.target.value) * 100)
                            : null,
                        )
                      }
                      className="form-input pl-6 text-sm py-2"
                      min={0}
                      placeholder={
                        suggested.sellPrice
                          ? `~$${(suggested.sellPrice / 100).toFixed(0)}`
                          : ""
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Rent-to-Own indicator */}
            {showRentToOwn && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50">
                <div className="flex items-center gap-2">
                  <span>🔄</span>
                  <div>
                    <p className="text-xs font-bold text-blue-800">
                      Rent-to-Own Eligible
                    </p>
                    <p className="text-[10px] text-blue-600">
                      80% of rental fees apply toward the purchase price.
                      {form.sell_price_cents && form.rent_price_day_cents
                        ? ` A renter could own this in ~${Math.ceil((form.sell_price_cents * 0.8) / (form.rent_price_day_cents * 0.8))} days.`
                        : ""}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Miles pricing summary */}
          {form.original_price_cents && (
            <div className="mt-4 p-3 rounded-xl bg-white/60 border border-inventory-100">
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">🤖</span>
                <p className="text-xs text-inventory-600">
                  <span className="font-bold">Miles says: </span>
                  Based on a retail value of $
                  {(form.original_price_cents / 100).toFixed(0)} in{" "}
                  {form.condition.replace(/_/g, " ")} condition, the market
                  value is ~${(suggested.marketValue / 100).toFixed(0)}.
                  {form.borrow_available &&
                    ` Borrow free with a $${(form.suggested_deposit_cents / 100).toFixed(0)} refundable deposit.`}
                  {form.rent_available &&
                    form.rent_price_day_cents &&
                    ` Rent for $${(form.rent_price_day_cents / 100).toFixed(0)}/day.`}
                  {form.sell_available &&
                    form.sell_price_cents &&
                    ` Buy for $${(form.sell_price_cents / 100).toFixed(0)}.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rules */}
        <FieldGroup label="Lending Rules" aiLabel>
          <textarea
            value={form.rules}
            onChange={(e) => update("rules", e.target.value)}
            className="form-input min-h-[60px] resize-none"
            rows={2}
            placeholder="Any rules for borrowers?"
          />
        </FieldGroup>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3.5 border-2 border-inventory-200 text-inventory-600 rounded-2xl font-display font-semibold text-sm hover:border-inventory-400 transition-colors"
        >
          ← Retake
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !form.title}
          className={`flex-[2] py-3.5 rounded-2xl font-display font-semibold text-lg transition-all ${
            isSubmitting || !form.title
              ? "bg-inventory-200 text-inventory-400 cursor-not-allowed"
              : "bg-inventory-950 text-white hover:bg-inventory-800 active:scale-[0.98]"
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Publishing...
            </span>
          ) : (
            "Publish to Building →"
          )}
        </button>
      </div>
    </div>
  );
}

// --- Toggle component ---

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-inventory-200"
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// --- Field wrapper ---

function FieldGroup({
  label,
  aiLabel,
  children,
}: {
  label: string;
  aiLabel?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-bold text-inventory-400 uppercase tracking-widest">
          {label}
        </span>
        {aiLabel && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-muted text-accent-dark font-mono font-bold">
            AI
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
