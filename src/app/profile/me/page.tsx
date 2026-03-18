"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  unit_number: string;
  trust_score: number;
  reputation_tags: string[];
  bio: string | null;
  created_at: string;
};

type Item = {
  id: string;
  title: string;
  category: string;
  deposit_cents: number;
  status: string;
  ai_condition: string | null;
};

type BorrowingTransaction = {
  id: string;
  item_id: string;
  owner_id: string;
  state: string;
  due_at: string | null;
  picked_up_at: string | null;
  item: {
    title: string;
    category: string;
    deposit_cents: number;
  };
  owner: {
    display_name: string;
    avatar_url: string | null;
  };
};

type HistoryTransaction = {
  id: string;
  item_id: string;
  state: string;
  returned_at: string | null;
  created_at: string;
  item: {
    title: string;
    category: string;
  };
};

type Tab = "items" | "borrowing" | "history";

function getDaysRemaining(dueAt: string | null): {
  text: string;
  urgent: boolean;
  overdue: boolean;
} {
  if (!dueAt) return { text: "No due date", urgent: false, overdue: false };
  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""}`,
      urgent: true,
      overdue: true,
    };
  } else if (diffDays === 0) {
    return { text: "Due today", urgent: true, overdue: false };
  } else if (diffDays === 1) {
    return { text: "Due tomorrow", urgent: true, overdue: false };
  } else {
    return {
      text: `${diffDays} days left`,
      urgent: diffDays <= 3,
      overdue: false,
    };
  }
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    Electronics: "🔌",
    Clothing: "👗",
    Kitchen: "🍳",
    Tools: "🔧",
    Sports: "⚽",
    Books: "📚",
    Furniture: "🪑",
    Games: "🎮",
    Music: "🎵",
    Office: "💼",
    Outdoor: "🏕️",
    Travel: "✈️",
  };
  return map[category] || "📦";
}

export default function MyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    unit_number: "",
    bio: "",
  });

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("items");
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [borrowing, setBorrowing] = useState<BorrowingTransaction[]>([]);
  const [history, setHistory] = useState<HistoryTransaction[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [borrowingCount, setBorrowingCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);

  const supabase = createClient();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingAvatar(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${profile.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);
      setAvatarUrl(publicUrl);
      setProfile({ ...profile, avatar_url: publicUrl });
    } catch (err) {
      console.error("Avatar upload error:", err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Load profile + counts
  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfile(data);
        setAvatarUrl(data.avatar_url);
        setForm({
          display_name: data.display_name ?? "",
          username: data.username ?? "",
          unit_number: data.unit_number ?? "",
          bio: data.bio ?? "",
        });
      }

      // Fetch counts in parallel
      const [itemsRes, borrowingRes, historyRes] = await Promise.all([
        supabase
          .from("items")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("borrower_id", user.id)
          .in("state", [
            "requested",
            "pending",
            "approved",
            "deposit_held",
            "picked_up",
            "return_submitted",
            "inspection_pending",
          ]),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("borrower_id", user.id)
          .in("state", [
            "completed",
            "returned",
            "auto_released",
            "resolved",
            "cancelled",
            "declined",
            "expired",
          ]),
      ]);

      setItemCount(itemsRes.count ?? 0);
      setBorrowingCount(borrowingRes.count ?? 0);
      setHistoryCount(historyRes.count ?? 0);

      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load tab data on tab change
  useEffect(() => {
    if (!profile) return;

    const loadTabData = async () => {
      setTabLoading(true);

      if (activeTab === "items" && myItems.length === 0) {
        const { data } = await supabase
          .from("items")
          .select("id, title, category, deposit_cents, status, ai_condition")
          .eq("owner_id", profile.id)
          .order("created_at", { ascending: false });
        setMyItems(data ?? []);
      }

      if (activeTab === "borrowing" && borrowing.length === 0) {
        // Fetch transactions without joins (avoids FK ambiguity issues)
        const { data: txns, error: txnError } = await supabase
          .from("transactions")
          .select("id, item_id, owner_id, state, due_at, picked_up_at")
          .eq("borrower_id", profile.id)
          .in("state", [
            "requested",
            "pending",
            "approved",
            "deposit_held",
            "picked_up",
            "return_submitted",
            "inspection_pending",
          ])
          .order("created_at", { ascending: false });

        console.log("BORROWING ERROR:", txnError);
        console.log("BORROWING RAW DATA:", JSON.stringify(txns));

        if (txns && txns.length > 0) {
          // Fetch items and owners separately
          const itemIds = [...new Set(txns.map((t) => t.item_id))];
          const ownerIds = [...new Set(txns.map((t) => t.owner_id))];

          const [{ data: itemsData }, { data: ownersData }] = await Promise.all([
            supabase
              .from("items")
              .select("id, title, category, deposit_cents")
              .in("id", itemIds),
            supabase
              .from("profiles")
              .select("id, display_name, avatar_url")
              .in("id", ownerIds),
          ]);

          const itemMap = Object.fromEntries(
            (itemsData ?? []).map((i) => [i.id, i])
          );
          const ownerMap = Object.fromEntries(
            (ownersData ?? []).map((o) => [o.id, o])
          );

          const mapped = txns.map((t) => ({
            id: t.id,
            item_id: t.item_id,
            owner_id: t.owner_id,
            state: t.state,
            due_at: t.due_at,
            picked_up_at: t.picked_up_at,
            item: {
              title: itemMap[t.item_id]?.title ?? "Unknown item",
              category: itemMap[t.item_id]?.category ?? "Other",
              deposit_cents: itemMap[t.item_id]?.deposit_cents ?? 0,
            },
            owner: {
              display_name: ownerMap[t.owner_id]?.display_name ?? "Neighbor",
              avatar_url: ownerMap[t.owner_id]?.avatar_url ?? null,
            },
          }));
          setBorrowing(mapped);
        } else {
          setBorrowing([]);
        }
      }

      if (activeTab === "history" && history.length === 0) {
        const { data: txns } = await supabase
          .from("transactions")
          .select("id, item_id, state, returned_at, created_at")
          .eq("borrower_id", profile.id)
          .in("state", [
            "completed",
            "returned",
            "auto_released",
            "resolved",
            "cancelled",
            "declined",
            "expired",
          ])
          .order("created_at", { ascending: false })
          .limit(50);

        if (txns && txns.length > 0) {
          const itemIds = [...new Set(txns.map((t) => t.item_id))];
          const { data: itemsData } = await supabase
            .from("items")
            .select("id, title, category")
            .in("id", itemIds);

          const itemMap = Object.fromEntries(
            (itemsData ?? []).map((i) => [i.id, i])
          );

          const mapped = txns.map((t) => ({
            id: t.id,
            item_id: t.item_id,
            state: t.state,
            returned_at: t.returned_at,
            created_at: t.created_at,
            item: {
              title: itemMap[t.item_id]?.title ?? "Unknown item",
              category: itemMap[t.item_id]?.category ?? "Other",
            },
          }));
          setHistory(mapped);
        } else {
          setHistory([]);
        }
      }

      setTabLoading(false);
    };

    loadTabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (!error) {
      setSaved(true);
      setProfile({ ...profile, ...form });
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
      </main>
    );

  if (!profile) return null;

  const trustLevel =
    profile.trust_score >= 85
      ? "high"
      : profile.trust_score >= 60
        ? "medium"
        : "low";
  const trustColors = {
    high: "text-trust-high bg-trust-high/10",
    medium: "text-trust-medium bg-trust-medium/10",
    low: "text-inventory-500 bg-inventory-100",
  };
  const trustLabels = {
    high: "Highly Trusted",
    medium: "Good Standing",
    low: "New Member",
  };

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-inventory-200/50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
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
          <h1 className="font-display font-bold text-base flex-1">
            My Profile
          </h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">
        {/* Avatar + trust */}
        <div className="glass rounded-3xl p-6 flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={form.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display font-black text-3xl text-accent">
                  {form.display_name?.[0] ?? "?"}
                </span>
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center shadow-md hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {uploadingAvatar ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <p className="font-display font-bold text-lg">
              {form.display_name || "Your Name"}
            </p>
            <p className="text-inventory-400 text-sm">
              @{form.username} · Unit {form.unit_number}
            </p>
            <span
              className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold ${trustColors[trustLevel]}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {trustLabels[trustLevel]} · {profile.trust_score.toFixed(0)}
            </span>
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────── */}
        <div className="glass rounded-3xl p-5">
          <div className="grid grid-cols-3 text-center">
            <div>
              <p className="font-display font-black text-2xl text-inventory-900">
                {itemCount}
              </p>
              <p className="text-xs text-inventory-400 mt-0.5">Items listed</p>
            </div>
            <div className="border-x border-inventory-100">
              <p className="font-display font-black text-2xl text-inventory-900">
                {borrowingCount}
              </p>
              <p className="text-xs text-inventory-400 mt-0.5">Borrowing</p>
            </div>
            <div>
              <p className="font-display font-black text-2xl text-inventory-900">
                {historyCount}
              </p>
              <p className="text-xs text-inventory-400 mt-0.5">Completed</p>
            </div>
          </div>
        </div>

        {/* ── Three-tab section ──────────────────────────────────── */}
        <div className="glass rounded-3xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-inventory-100">
            {(
              [
                { key: "items", label: "My Items", count: itemCount },
                { key: "borrowing", label: "Borrowing", count: borrowingCount },
                { key: "history", label: "History", count: historyCount },
              ] as { key: Tab; label: string; count: number }[]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3.5 text-sm font-display font-semibold transition-all relative ${
                  activeTab === tab.key
                    ? "text-accent"
                    : "text-inventory-400 hover:text-inventory-600"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === tab.key
                        ? "bg-accent/10 text-accent"
                        : "bg-inventory-100 text-inventory-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-accent rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4 min-h-[200px]">
            {tabLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-inventory-200 border-t-accent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* ── My Items tab ─────────────────────────────── */}
                {activeTab === "items" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-inventory-400 uppercase tracking-widest">
                        My Items ({myItems.length})
                      </p>
                      <Link
                        href="/upload"
                        className="text-sm text-white bg-accent px-4 py-1.5 rounded-full font-display font-semibold hover:bg-accent-dark transition-colors"
                      >
                        + Add Item
                      </Link>
                    </div>

                    {myItems.length === 0 ? (
                      <div className="text-center py-12">
                        <span className="text-4xl mb-3 block">📦</span>
                        <p className="text-inventory-500 text-sm mb-4">
                          No items listed yet
                        </p>
                        <Link
                          href="/upload"
                          className="inline-flex items-center gap-2 py-2.5 px-6 bg-accent text-white rounded-2xl font-display font-semibold text-sm"
                        >
                          List your first item
                        </Link>
                      </div>
                    ) : (
                      myItems.map((item) => (
                        <Link
                          key={item.id}
                          href={`/item/${item.id}`}
                          className="flex items-center gap-4 p-4 rounded-2xl border border-inventory-100 hover:border-inventory-200 transition-colors"
                        >
                          <div className="w-12 h-12 rounded-xl bg-inventory-50 flex items-center justify-center text-xl">
                            {getCategoryEmoji(item.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-display font-semibold text-sm truncate">
                              {item.title}
                            </p>
                            <span className="text-xs text-inventory-400 bg-inventory-50 px-2 py-0.5 rounded-full">
                              {item.category}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-display font-bold text-sm text-accent">
                              ${(item.deposit_cents / 100).toFixed(0)}
                            </p>
                            <span
                              className={`text-xs font-medium ${
                                item.status === "available"
                                  ? "text-trust-high"
                                  : item.status === "borrowed"
                                    ? "text-amber-500"
                                    : "text-inventory-400"
                              }`}
                            >
                              {item.status === "available"
                                ? "Available"
                                : item.status === "borrowed"
                                  ? "Borrowed"
                                  : item.status}
                            </span>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                )}

                {/* ── Borrowing tab (active loans) ────────────── */}
                {activeTab === "borrowing" && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-inventory-400 uppercase tracking-widest mb-2">
                      Currently Borrowing ({borrowing.length})
                    </p>

                    {borrowing.length === 0 ? (
                      <div className="text-center py-12">
                        <span className="text-4xl mb-3 block">🤝</span>
                        <p className="text-inventory-500 text-sm mb-1">
                          Nothing borrowed right now
                        </p>
                        <p className="text-inventory-400 text-xs">
                          Browse your building&apos;s inventory to find
                          something
                        </p>
                      </div>
                    ) : (
                      borrowing.map((txn) => {
                        const due = getDaysRemaining(txn.due_at);
                        const stateLabels: Record<
                          string,
                          { label: string; color: string }
                        > = {
                          requested: {
                            label: "Waiting for response",
                            color: "text-blue-600 bg-blue-50",
                          },
                          pending: {
                            label: "Owner is considering",
                            color: "text-amber-600 bg-amber-50",
                          },
                          approved: {
                            label: "Confirm deposit",
                            color: "text-teal-700 bg-teal-50",
                          },
                          deposit_held: {
                            label: "Deposit held — coordinate pickup",
                            color: "text-purple-600 bg-purple-50",
                          },
                          picked_up: {
                            label: "With you now",
                            color: "text-green-700 bg-green-50",
                          },
                          active: {
                            color: "text-green-700 bg-green-50",
                          },
                          return_submitted: {
                            label: "Return in progress",
                            color: "text-blue-600 bg-blue-50",
                          },
                          inspection_pending: {
                            label: "Lender inspecting",
                            color: "text-amber-600 bg-amber-50",
                          },
                        };
                        const stateInfo = stateLabels[txn.state] ?? {
                          label: txn.state,
                          color: "text-inventory-500 bg-inventory-50",
                        };
                        const showReturnButton = [
                          "picked_up",
                        ].includes(txn.state);
                        const showDueDate = [
                          "picked_up",
                          "deposit_held",
                        ].includes(txn.state);
                        return (
                          <div
                            key={txn.id}
                            className={`p-4 rounded-2xl border transition-colors ${
                              due.overdue
                                ? "border-red-200 bg-red-50/50"
                                : due.urgent
                                  ? "border-amber-200 bg-amber-50/30"
                                  : "border-inventory-100"
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-inventory-50 flex items-center justify-center text-xl flex-shrink-0">
                                {getCategoryEmoji(txn.item.category)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-display font-semibold text-sm truncate">
                                  {txn.item.title}
                                </p>
                                <p className="text-xs text-inventory-400 mt-0.5">
                                  From{" "}
                                  <span className="font-medium text-inventory-600">
                                    {txn.owner.display_name}
                                  </span>
                                </p>

                                {/* State badge */}
                                <span
                                  className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1.5 ${stateInfo.color}`}
                                >
                                  {stateInfo.label}
                                </span>

                                {/* Due date countdown (only when relevant) */}
                                {showDueDate && (
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <svg
                                      className={`w-3.5 h-3.5 ${
                                        due.overdue
                                          ? "text-red-500"
                                          : due.urgent
                                            ? "text-amber-500"
                                            : "text-inventory-400"
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <span
                                      className={`text-xs font-semibold ${
                                        due.overdue
                                          ? "text-red-600"
                                          : due.urgent
                                            ? "text-amber-600"
                                            : "text-inventory-500"
                                      }`}
                                    >
                                      {due.text}
                                    </span>
                                  </div>
                                )}

                                {/* Deposit info */}
                                <p className="text-xs text-inventory-400 mt-1">
                                  Deposit held:{" "}
                                  <span className="font-medium">
                                    ${(txn.item.deposit_cents / 100).toFixed(0)}
                                  </span>
                                </p>
                              </div>

                              {/* Return Now button (only for picked_up/active) */}
                              {showReturnButton ? (
                                <Link
                                  href={`/return/${txn.id}`}
                                  className="flex-shrink-0 py-2 px-4 bg-accent text-white rounded-xl font-display font-bold text-xs hover:bg-accent-dark transition-colors flex items-center gap-1.5"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                    />
                                  </svg>
                                  Return Now
                                </Link>
                              ) : txn.state === "approved" ? (
                                <Link
                                  href="/inbox"
                                  className="flex-shrink-0 py-2 px-4 bg-teal-700 text-white rounded-xl font-display font-bold text-xs hover:bg-teal-600 transition-colors"
                                >
                                  Pay Deposit
                                </Link>
                              ) : txn.state === "deposit_held" ? (
                                <Link
                                  href="/inbox"
                                  className="flex-shrink-0 py-2 px-4 bg-purple-600 text-white rounded-xl font-display font-bold text-xs hover:bg-purple-500 transition-colors"
                                >
                                  Coordinate
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ── History tab ─────────────────────────────── */}
                {activeTab === "history" && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-inventory-400 uppercase tracking-widest mb-2">
                      Transaction History ({history.length})
                    </p>

                    {history.length === 0 ? (
                      <div className="text-center py-12">
                        <span className="text-4xl mb-3 block">📋</span>
                        <p className="text-inventory-500 text-sm">
                          No transaction history yet
                        </p>
                      </div>
                    ) : (
                      history.map((txn) => {
                        const stateLabels: Record<
                          string,
                          { label: string; color: string }
                        > = {
                          completed: {
                            label: "Completed",
                            color: "text-trust-high",
                          },
                          returned: {
                            label: "Returned",
                            color: "text-trust-high",
                          },
                          auto_released: {
                            label: "Auto-released",
                            color: "text-blue-500",
                          },
                          resolved: {
                            label: "Resolved",
                            color: "text-inventory-500",
                          },
                          cancelled: {
                            label: "Cancelled",
                            color: "text-inventory-400",
                          },
                          declined: {
                            label: "Declined",
                            color: "text-red-400",
                          },
                          expired: {
                            label: "Expired",
                            color: "text-inventory-400",
                          },
                        };
                        const stateInfo = stateLabels[txn.state] ?? {
                          label: txn.state,
                          color: "text-inventory-400",
                        };
                        const date = txn.returned_at ?? txn.created_at;
                        const formattedDate = date
                          ? new Date(date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "";

                        return (
                          <div
                            key={txn.id}
                            className="flex items-center gap-4 p-4 rounded-2xl border border-inventory-100"
                          >
                            <div className="w-10 h-10 rounded-xl bg-inventory-50 flex items-center justify-center text-lg">
                              {getCategoryEmoji(txn.item.category)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-display font-semibold text-sm truncate">
                                {txn.item.title}
                              </p>
                              <p className="text-xs text-inventory-400">
                                {formattedDate}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-semibold ${stateInfo.color}`}
                            >
                              {stateInfo.label}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Edit form */}
        <div className="glass rounded-3xl p-6 space-y-5">
          <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest">
            Profile Info
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
                className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-inventory-400 text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      username: e.target.value.toLowerCase().replace(/\s/g, ""),
                    })
                  }
                  className="w-full pl-8 pr-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                  placeholder="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                Unit Number
              </label>
              <input
                type="text"
                value={form.unit_number}
                onChange={(e) =>
                  setForm({ ...form, unit_number: e.target.value })
                }
                className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                placeholder="e.g. 4B"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm resize-none transition-colors"
                placeholder="Tell your neighbors a bit about yourself..."
              />
              <p className="text-xs text-inventory-400 mt-1">
                {form.bio.length}/200 characters
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: saved
                ? "var(--color-trust-high)"
                : "var(--color-accent)",
              color: "white",
            }}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>✓ Profile saved!</>
            ) : (
              <>Save Changes</>
            )}
          </button>
        </div>

        {/* Reputation tags (read-only) */}
        {profile.reputation_tags?.length > 0 && (
          <div className="glass rounded-3xl p-6">
            <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-4">
              Reputation Tags
            </h2>
            <p className="text-xs text-inventory-400 mb-3">
              Earned from your lending activity
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.reputation_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-sm px-3 py-1.5 rounded-full bg-inventory-100 text-inventory-600 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trust score info */}
        <div className="glass rounded-3xl p-6">
          <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-4">
            Trust Score
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-display font-black text-accent">
              {profile.trust_score.toFixed(0)}
            </div>
            <div>
              <p className="font-display font-bold text-sm">
                {trustLabels[trustLevel]}
              </p>
              <p className="text-xs text-inventory-400 mt-0.5">
                Based on your lending history
              </p>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-inventory-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${profile.trust_score}%` }}
            />
          </div>
          <p className="text-xs text-inventory-400 mt-3">
            Complete more transactions to increase your score.
          </p>
        </div>
      </div>
    </main>
  );
}
