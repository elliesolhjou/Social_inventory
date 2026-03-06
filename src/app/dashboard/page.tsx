"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SearchBar from "@/components/SearchBar";

type Item = {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  deposit_cents: number;
  times_borrowed: number;
  status: string;
  metadata?: { brand?: string; model?: string };
  owner: {
    username: string;
    display_name: string;
    trust_score: number;
    reputation_tags: string[];
  };
};

type Profile = {
  id: string;
  display_name: string;
  unit_number: string;
  trust_score: number;
  reputation_tags: string[];
};

function TrustBadge({ score }: { score: number }) {
  const level = score >= 85 ? "high" : score >= 60 ? "medium" : "low";
  const colors = {
    high: "bg-trust-high/10 text-trust-high",
    medium: "bg-trust-medium/10 text-trust-medium",
    low: "bg-trust-low/10 text-trust-low",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${colors[level]}`}
    >
      {score.toFixed(0)}
    </span>
  );
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    electronics: "📱",
    kitchen: "🍳",
    outdoor: "⛺",
    sports: "🏋️",
    tools: "🔧",
    entertainment: "🎮",
    home: "🏠",
    wellness: "🧘",
    travel: "✈️",
    creative: "🎨",
    beauty: "💇",
    clothing: "👗",
    baby_kids: "🧸",
    music: "🎵",
    automotive: "🚗",
  };
  return map[category] ?? "📦";
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// ── Search filter logic ───────────────────────────────────────────────────────
function matchesSearch(item: Item, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    item.title?.toLowerCase().includes(q) ||
    item.description?.toLowerCase().includes(q) ||
    item.category?.toLowerCase().includes(q) ||
    item.subcategory?.toLowerCase().includes(q) ||
    item.metadata?.brand?.toLowerCase().includes(q) ||
    item.metadata?.model?.toLowerCase().includes(q) ||
    (item.owner as any)?.display_name?.toLowerCase().includes(q) ||
    (item.owner as any)?.username?.toLowerCase().includes(q) ||
    false
  );
}

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [transactionCount, setTransactionCount] = useState(0);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const [itemsRes, profilesRes, statsRes] = await Promise.all([
        supabase
          .from("items")
          .select(
            "*, owner:profiles(username, display_name, trust_score, reputation_tags)",
          )
          .eq("status", "available")
          .order("times_borrowed", { ascending: false })
          .limit(50),
        supabase
          .from("profiles")
          .select("*")
          .order("trust_score", { ascending: false })
          .limit(10),
        supabase.from("transactions").select("id", { count: "exact" }),
      ]);
      setItems(itemsRes.data ?? []);
      setProfiles(profilesRes.data ?? []);
      setTransactionCount(statsRes.data?.length ?? 0);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setActiveCategory("All"); // reset category when searching
  }, []);

  const categories = [
    "All",
    ...Array.from(new Set(items.map((i) => i.category))),
  ];

  // Apply both search + category filter
  const filteredItems = items.filter((item) => {
    const categoryMatch =
      activeCategory === "All" || item.category === activeCategory;
    const searchMatch = matchesSearch(item, searchQuery);
    return categoryMatch && searchMatch;
  });

  const isSearching = searchQuery.trim().length > 0;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-inventory-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight flex-shrink-0"
          >
            The Social Inventory
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/upload"
              className="px-3 sm:px-4 py-2 bg-accent text-white rounded-xl font-display font-semibold text-sm hover:bg-accent-dark transition-colors flex items-center gap-1.5"
            >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="hidden sm:inline">Magic Upload</span>
              <span className="sm:hidden">Add</span>
            </Link>
            <span className="text-sm text-inventory-500 hidden sm:block">
              The Meridian
            </span>
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-accent text-xs font-bold">M</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold mb-2">
            Good {getTimeOfDay()} 👋
          </h1>
          <p className="text-inventory-500 text-sm sm:text-base">
            {items.length} items available · {transactionCount} transactions ·{" "}
            {profiles.length} trusted neighbors
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar onSearch={handleSearch} />
        </div>

        {/* Category chips — hide while searching */}
        {!isSearching && (
          <section className="mb-8">
            <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-3">
              Categories
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-accent text-white shadow-md scale-105"
                        : "bg-inventory-100 text-inventory-700 hover:bg-inventory-200"
                    }`}
                  >
                    {cat !== "All" && (
                      <span className="text-base leading-none">
                        {getCategoryEmoji(cat)}
                      </span>
                    )}
                    <span className="capitalize">{cat}</span>
                    {isActive && cat !== "All" && (
                      <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {filteredItems.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Items Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest">
              {isSearching
                ? `Results for "${searchQuery}"`
                : activeCategory === "All"
                  ? "Available Now"
                  : activeCategory}
            </h2>
            <span className="text-xs text-inventory-400">
              {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="text-5xl mb-4">
                {isSearching ? "🔍" : getCategoryEmoji(activeCategory)}
              </span>
              <p className="font-display font-bold text-inventory-700 mb-1">
                {isSearching
                  ? `No results for "${searchQuery}"`
                  : `No ${activeCategory} items yet`}
              </p>
              <p className="text-sm text-inventory-400 mb-6">
                {isSearching
                  ? "Try a different search term"
                  : "Be the first to add one"}
              </p>
              {!isSearching && (
                <Link
                  href="/upload"
                  className="px-5 py-2.5 bg-accent text-white rounded-xl font-display font-semibold text-sm hover:bg-accent-dark transition-colors"
                >
                  Magic Upload →
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredItems.map((item) => (
                <Link
                  href={`/item/${item.id}`}
                  key={item.id}
                  className="glass rounded-2xl overflow-hidden card-hover group block"
                >
                  <div className="h-36 sm:h-40 bg-gradient-to-br from-inventory-100 to-inventory-200 flex items-center justify-center">
                    <span className="text-4xl opacity-50">
                      {getCategoryEmoji(item.category)}
                    </span>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-display font-bold text-sm sm:text-base leading-tight line-clamp-2">
                        {/* Highlight search match in title */}
                        {isSearching
                          ? highlightMatch(item.title, searchQuery)
                          : item.title}
                      </h3>
                      {item.deposit_cents > 0 && (
                        <span className="text-xs text-inventory-400 font-mono whitespace-nowrap ml-2 mt-0.5">
                          ${(item.deposit_cents / 100).toFixed(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-inventory-100 text-inventory-600 capitalize">
                        {item.category}
                      </span>
                      {item.subcategory && (
                        <span className="text-xs text-inventory-400 truncate">
                          {item.subcategory.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    {item.owner && (
                      <div className="flex items-center justify-between pt-3 border-t border-inventory-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-inventory-200 flex-shrink-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-inventory-600">
                              {(item.owner as any).display_name?.[0] ?? "?"}
                            </span>
                          </div>
                          <span className="text-sm text-inventory-500 truncate">
                            {(item.owner as any).username}
                          </span>
                        </div>
                        <TrustBadge score={(item.owner as any).trust_score} />
                      </div>
                    )}
                    {item.metadata?.brand && (
                      <p className="text-xs text-inventory-400 mt-2 font-mono truncate">
                        {item.metadata.brand} {item.metadata.model ?? ""}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Top Neighbors — hide while searching */}
        {!isSearching && (
          <section className="mb-8">
            <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-4">
              Most Trusted Neighbors
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="glass rounded-2xl p-3 sm:p-4 text-center card-hover"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-inventory-200 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <span className="font-display font-bold text-inventory-600 text-sm sm:text-base">
                      {p.display_name?.[0] ?? "?"}
                    </span>
                  </div>
                  <p className="font-display font-bold text-xs sm:text-sm truncate">
                    {p.display_name}
                  </p>
                  <p className="text-xs text-inventory-400 mb-2">
                    Unit {p.unit_number}
                  </p>
                  <TrustBadge score={p.trust_score} />
                  {p.reputation_tags?.length > 0 && (
                    <p className="text-xs text-inventory-400 mt-1.5 truncate">
                      {p.reputation_tags[0]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

// Highlight matching text in titles
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-accent/20 text-accent rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
