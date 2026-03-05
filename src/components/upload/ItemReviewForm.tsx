"use client";

import { useState } from "react";

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
  { value: "like_new", label: "Like New", desc: "No visible wear" },
  { value: "good", label: "Good", desc: "Minor signs of use" },
  { value: "fair", label: "Fair", desc: "Noticeable wear but functional" },
  { value: "worn", label: "Worn", desc: "Significant wear" },
];

export default function ItemReviewForm({
  data,
  onSubmit,
  onBack,
  isSubmitting,
}: ItemReviewFormProps) {
  const [form, setForm] = useState<ItemFormData>(data);

  const update = (field: keyof ItemFormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

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

        {/* Deposit + Max Borrow */}
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Refundable Deposit" aiLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-inventory-400 font-mono text-sm">
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
                className="form-input pl-7"
                min={0}
              />
            </div>
          </FieldGroup>

          <FieldGroup label="Max Borrow Days">
            <input
              type="number"
              value={form.max_borrow_days}
              onChange={(e) =>
                update("max_borrow_days", Number(e.target.value))
              }
              className="form-input"
              min={1}
              max={30}
            />
          </FieldGroup>
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
