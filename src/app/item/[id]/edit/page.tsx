"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type ItemData = {
  id: string;
  title: string;
  description: string;
  ai_description: string;
  category: string;
  subcategory: string;
  ai_condition: string;
  deposit_cents: number;
  max_borrow_days: number;
  rules: string;
  status: string;
  borrow_available: boolean;
  rent_available: boolean;
  sell_available: boolean;
  rent_price_day_cents: number | null;
  rent_price_month_cents: number | null;
  sell_price_cents: number | null;
  estimated_market_value_cents: number | null;
  thumbnail_url: string | null;
  owner_id: string;
  metadata: {
    brand?: string;
    model?: string;
    color?: string;
    year?: number;
    original_price_cents?: number;
  };
};

const CATEGORIES = [
  "Electronics", "Kitchen", "Tools", "Home", "Outdoor", "Sports",
  "Entertainment", "Travel", "Creative", "Clothing", "Beauty",
  "Wellness", "Baby_kids", "Music",
];

const CONDITIONS = [
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "well_used", label: "Well Used" },
];

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const [form, setForm] = useState<ItemData | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }

      const { data: item, error: itemError } = await supabase
        .from("items")
        .select("*")
        .eq("id", itemId)
        .single();

      if (itemError || !item) {
        router.push("/dashboard");
        return;
      }

      // Verify ownership
      if (item.owner_id !== user.id) {
        router.push(`/item/${itemId}`);
        return;
      }

      setForm(item);
      setLoading(false);
    };
    load();
  }, [itemId]);

  const update = (key: string, value: any) => {
    if (!form) return;
    setForm({ ...form, [key]: value });
  };

  const updateMeta = (key: string, value: any) => {
    if (!form) return;
    setForm({ ...form, metadata: { ...form.metadata, [key]: value } });
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("items")
      .update({
        title: form.title,
        description: form.description,
        category: form.category.toLowerCase(),
        subcategory: form.subcategory,
        ai_condition: form.ai_condition,
        deposit_cents: form.deposit_cents,
        max_borrow_days: form.max_borrow_days,
        rules: form.rules,
        status: form.status,
        borrow_available: form.borrow_available,
        rent_available: form.rent_available,
        sell_available: form.sell_available,
        rent_price_day_cents: form.rent_price_day_cents,
        rent_price_month_cents: form.rent_price_month_cents,
        sell_price_cents: form.sell_price_cents,
        estimated_market_value_cents: form.estimated_market_value_cents,
        metadata: form.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", form.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push(`/item/${itemId}`), 1000);
    }
  };

  const handleDelete = async () => {
    if (!form) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this item? This cannot be undone."
    );
    if (!confirmed) return;

    await supabase
      .from("items")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", form.id);

    router.push("/profile/me");
  };

  if (loading || !form) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fdf9f5]">
        <div className="w-6 h-6 border-2 border-[#e6e2de] border-t-[#ae3200] rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fdf9f5] pt-6 pb-20 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/item/${itemId}`}
            className="w-9 h-9 rounded-full bg-[#ebe7e4] flex items-center justify-center hover:bg-[#e6e2de] transition-colors"
          >
            <svg className="w-4 h-4 text-[#5b4038]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="font-display font-bold text-xl">Edit Item</h1>
            <p className="text-xs text-[#8f7067]">{form.title}</p>
          </div>
          {form.thumbnail_url && (
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#ebe7e4]">
              <img src={form.thumbnail_url} alt={form.title} className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Success */}
        {success && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 mb-4">
            <span className="text-xl">✅</span>
            <p className="text-sm font-bold text-emerald-800">Item updated! Redirecting...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-100 mb-4">
            <span className="text-red-500 text-xs mt-0.5">⚠</span>
            <p className="text-red-600 text-xs">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-[#5b4038] mb-1.5">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm bg-white transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-[#5b4038] mb-1.5">Description</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm bg-white resize-none transition-colors"
            />
          </div>

          {/* Category + Condition */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5b4038] mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm bg-white transition-colors"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c.toLowerCase()}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5b4038] mb-1.5">Condition</label>
              <select
                value={form.ai_condition}
                onChange={(e) => update("ai_condition", e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm bg-white transition-colors"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Brand + Model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5b4038] mb-1.5">Brand</label>
              <input
                type="text"
                value={form.metadata?.brand ?? ""}
                onChange={(e) => updateMeta("brand", e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5b4038] mb-1.5">Model</label>
              <input
                type="text"
                value={form.metadata?.model ?? ""}
                onChange={(e) => updateMeta("model", e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm bg-white transition-colors"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#e6e2de] my-2" />

          {/* Deposit + Max Days */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5b4038] mb-1.5">Deposit ($)</label>
              <input
                type="number"
                value={Math.round(form.deposit_cents / 100)}
                onChange={(e) => update("deposit_cents", Math.round(Number(e.target.value) * 100))}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm bg-white transition-colors"
                min={0}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5b4038] mb-1.5">Max Borrow Days</label>
              <input
                type="number"
                value={form.max_borrow_days}
                onChange={(e) => update("max_borrow_days", Number(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm bg-white transition-colors"
                min={1}
              />
            </div>
          </div>

          {/* Pricing Modes */}
          <div>
            <label className="block text-xs font-bold text-[#5b4038] mb-3">Pricing Modes</label>
            <div className="space-y-3">
              {/* Borrow */}
              <div className={`p-4 rounded-2xl border-2 transition-colors ${form.borrow_available ? "border-emerald-300 bg-emerald-50" : "border-[#e6e2de] bg-white"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🤝</span>
                    <span className="font-display font-bold text-sm">Borrow</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">Free</span>
                  </div>
                  <button
                    onClick={() => update("borrow_available", !form.borrow_available)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${form.borrow_available ? "bg-emerald-500" : "bg-[#e6e2de]"}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${form.borrow_available ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

              {/* Rent */}
              <div className={`p-4 rounded-2xl border-2 transition-colors ${form.rent_available ? "border-blue-300 bg-blue-50" : "border-[#e6e2de] bg-white"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📅</span>
                    <span className="font-display font-bold text-sm">Rent</span>
                  </div>
                  <button
                    onClick={() => update("rent_available", !form.rent_available)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${form.rent_available ? "bg-blue-500" : "bg-[#e6e2de]"}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${form.rent_available ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {form.rent_available && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-[10px] text-[#8f7067] uppercase font-bold">Per Day ($)</label>
                      <input
                        type="number"
                        value={Math.round((form.rent_price_day_cents ?? 0) / 100)}
                        onChange={(e) => update("rent_price_day_cents", Math.round(Number(e.target.value) * 100))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-[#e6e2de] focus:border-blue-400 outline-none text-sm bg-white mt-1"
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#8f7067] uppercase font-bold">Per Month ($)</label>
                      <input
                        type="number"
                        value={Math.round((form.rent_price_month_cents ?? 0) / 100)}
                        onChange={(e) => update("rent_price_month_cents", Math.round(Number(e.target.value) * 100))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-[#e6e2de] focus:border-blue-400 outline-none text-sm bg-white mt-1"
                        min={0}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Buy */}
              <div className={`p-4 rounded-2xl border-2 transition-colors ${form.sell_available ? "border-purple-300 bg-purple-50" : "border-[#e6e2de] bg-white"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🏷️</span>
                    <span className="font-display font-bold text-sm">Buy</span>
                  </div>
                  <button
                    onClick={() => update("sell_available", !form.sell_available)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${form.sell_available ? "bg-purple-500" : "bg-[#e6e2de]"}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${form.sell_available ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {form.sell_available && (
                  <div className="mt-3">
                    <label className="text-[10px] text-[#8f7067] uppercase font-bold">Sell Price ($)</label>
                    <input
                      type="number"
                      value={Math.round((form.sell_price_cents ?? 0) / 100)}
                      onChange={(e) => update("sell_price_cents", Math.round(Number(e.target.value) * 100))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-[#e6e2de] focus:border-purple-400 outline-none text-sm bg-white mt-1"
                      min={0}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rules */}
          <div>
            <label className="block text-xs font-bold text-[#5b4038] mb-1.5">Care Instructions / Rules</label>
            <textarea
              value={form.rules ?? ""}
              onChange={(e) => update("rules", e.target.value)}
              rows={2}
              placeholder="Handle with care, keep lens caps on, etc."
              className="w-full px-4 py-3 rounded-2xl border-2 border-[#e6e2de] focus:border-[#ae3200] outline-none text-sm bg-white resize-none transition-colors"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-[#5b4038] mb-1.5">Status</label>
            <div className="flex gap-2">
              {["available", "unavailable"].map((s) => (
                <button
                  key={s}
                  onClick={() => update("status", s)}
                  className={`flex-1 py-2.5 rounded-xl font-display font-bold text-xs transition-all ${
                    form.status === s
                      ? s === "available"
                        ? "bg-emerald-500 text-white"
                        : "bg-[#ae3200] text-white"
                      : "bg-[#ebe7e4] text-[#5b4038]"
                  }`}
                >
                  {s === "available" ? "Available" : "Unavailable"}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#e6e2de] my-2" />

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="w-full py-3.5 bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white rounded-2xl font-display font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : "Save Changes"}
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="w-full py-3 text-red-500 font-display font-bold text-xs hover:bg-red-50 rounded-2xl transition-colors"
          >
            Delete Item
          </button>
        </div>
      </div>
    </main>
  );
}
