"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SearchBar from "@/components/SearchBar";
import UserMenu from "@/components/UserMenu";
import VisualSearchModal from "@/components/search/VisualSearchModal";
import {
  SustainableLivingCard,
  NeighborPointsCard,
} from "@/components/dashboard/ImpactCards";

type Item = {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  deposit_cents: number;
  times_borrowed: number;
  thumbnail_url?: string;
  status: string;
  metadata?: { brand?: string; model?: string };
  owner: {
    id: string;
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


function CategoryIcon({ category, className = "w-4 h-4" }: { category: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    electronics: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
    ),
    kitchen: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" /></svg>
    ),
    tools: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" /></svg>
    ),
    outdoor: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>
    ),
    sports: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.996.428-1.944.914-2.85 1.443m17.35-1.443a21.306 21.306 0 0 1 2.85 1.443" /></svg>
    ),
    entertainment: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
    ),
    home: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
    ),
    wellness: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
    ),
    travel: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>
    ),
    creative: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" /></svg>
    ),
  };
  const fallback = (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
  );
  return <>{icons[category] ?? fallback}</>;
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

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
  const [buildingName, setBuildingName] = useState("My Building");
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [transactionCount, setTransactionCount] = useState(0);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [broadcastCount, setBroadcastCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [showVisualSearch, setShowVisualSearch] = useState(false);
  const [semanticResults, setSemanticResults] = useState<any[]>([]);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      let userBuildingId: string | null = null;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("building_id")
          .eq("id", user.id)
          .single();
        if (profile?.building_id) {
          userBuildingId = profile.building_id;
          const { data: building } = await supabase
            .from("buildings")
            .select("name")
            .eq("id", profile.building_id)
            .single();
          if (building) setBuildingName(building.name);
        }
      }
      const itemSelect =
        "*, owner:profiles(id, username, display_name, trust_score, reputation_tags)";
      
      let communityQuery = supabase
        .from("items")
        .select(itemSelect)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(100);

      if (userBuildingId) {
        communityQuery = communityQuery.or(
          `building_id.eq.${userBuildingId},owner_id.eq.00000000-0000-0000-0000-000000000002`
        );
      }
      const [communityRes, myItemsRes, profilesRes, statsRes] =
        await Promise.all([
          communityQuery,
          user
            ? supabase
                .from("items")
                .select(itemSelect)
                .eq("owner_id", user.id)
                .eq("status", "available")
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
          supabase
            .from("profiles")
            .select("*")
            .neq("id", "00000000-0000-0000-0000-000000000001")
            .order("trust_score", { ascending: false })
            .limit(10),
          supabase.from("transactions").select("id", { count: "exact" }),
        ]);

      const myItems = myItemsRes.data ?? [];
      const community = communityRes.data ?? [];
      const myIds = new Set(myItems.map((i: any) => i.id));
      const merged = [
        ...myItems,
        ...community.filter((i: any) => !myIds.has(i.id)),
      ];

      setItems(merged);
      setProfiles(profilesRes.data ?? []);
      setTransactionCount(statsRes.data?.length ?? 0);

      if (user) {
        const { data: unread } = await supabase
          .from("messages")
          .select("id", { count: "exact" })
          .eq("recipient_id", user.id)
          .is("read_at", null);
        setUnreadCount(unread?.length ?? 0);

        const { data: bcast } = await supabase
          .from("broadcasts")
          .select("id", { count: "exact" })
          .neq("sender_id", user.id)
          .gt("expires_at", new Date().toISOString());
        setBroadcastCount(bcast?.length ?? 0);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("dashboard-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` },
        () => setUnreadCount((c) => c + 1),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "broadcasts" },
        (payload: any) => {
          if (payload.new.sender_id !== userId) setBroadcastCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const close = () => setFilterOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [filterOpen]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setActiveCategory("All");
    setSemanticResults([]);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      setSemanticResults([]);
      return;
    }
    setSemanticLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/search/semantic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery.trim() }),
        });
        if (res.ok) {
          const data = await res.json();
          setSemanticResults(data.results || []);
        }
      } catch (err) {
        console.error("Semantic search error:", err);
      } finally {
        setSemanticLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const categories = ["All", ...Array.from(new Set(items.map((i) => i.category)))];

  const textFilteredItems = items.filter((item) => {
    const categoryMatch = activeCategory === "All" || item.category === activeCategory;
    const searchMatch = matchesSearch(item, searchQuery);
    return categoryMatch && searchMatch;
  });

  const filteredItems = (() => {
    if (!searchQuery.trim()) return textFilteredItems;
    if (semanticResults.length > 0) {
      const topScore = semanticResults[0].similarity;
      const cutoff = topScore * 0.85;
      const relevant = semanticResults.filter((r: any) => r.similarity >= cutoff);
      return relevant.map((r: any) => items.find((i) => i.id === r.id)).filter(Boolean) as typeof items;
    }
    return textFilteredItems;
  })();

  const isSearching = searchQuery.trim().length > 0;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fdf9f5]">
        <div className="w-10 h-10 border-4 border-[#ae3200]/20 border-t-[#ae3200] rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28 md:pb-20 bg-[#fdf9f5] text-[#1c1b1a] font-['Be_Vietnam_Pro']">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#fdf9f5] transition-all duration-300">
        <div className="flex justify-between items-center w-full px-4 sm:px-8 py-4 sm:py-5 max-w-7xl mx-auto">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#ae3200] uppercase opacity-70 font-['Plus_Jakarta_Sans']">Resident Dashboard</span>
            <Link href="/" className="text-lg sm:text-2xl font-black text-[#ae3200] tracking-tight font-['Plus_Jakarta_Sans'] truncate">{buildingName}</Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <nav className="hidden md:flex gap-6 items-center">
              <span className="text-[#ae3200] border-b-2 border-[#ae3200] pb-1 font-bold text-sm font-['Plus_Jakarta_Sans'] cursor-default">Dashboard</span>
              <Link href="/profile/me" className="text-[#5b4038] font-medium text-sm hover:text-[#ff5a1f] transition-colors font-['Plus_Jakarta_Sans']">My Items</Link>
              <Link href="/inbox" className="text-[#5b4038] font-medium text-sm hover:text-[#ff5a1f] transition-colors font-['Plus_Jakarta_Sans'] relative">
                Inbox
                {unreadCount > 0 && (<span className="absolute -top-2 -right-4 w-4 h-4 rounded-full bg-[#ae3200] text-white text-[9px] font-bold flex items-center justify-center">{unreadCount}</span>)}
              </Link>
            </nav>
            <Link href="/notifications" className="relative p-2 hover:bg-[#ebe7e4] rounded-full transition-all">
              <svg className="w-5 h-5 text-[#5b4038]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {broadcastCount > 0 && (<span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#ff5a1f] text-white text-[9px] font-bold flex items-center justify-center">{broadcastCount}</span>)}
            </Link>
            <UserMenu />
          </div>
        </div>
        <div className="bg-[#f7f3ef] h-px w-full opacity-50" />
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 space-y-10 sm:space-y-12">
        {/* Editorial Greeting */}
        {!isSearching && (
          <section className="space-y-2">
            <p className="text-[#ae3200] font-bold text-xs tracking-[0.2em] uppercase font-['Plus_Jakarta_Sans']">Community Pulse</p>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter text-[#1c1b1a] font-['Plus_Jakarta_Sans'] leading-[1.05]">
              Good {getTimeOfDay()} — {items.length} items available in your building today.
            </h2>
          </section>
        )}

        {/* Search Bar */}
        <div><SearchBar onSearch={handleSearch} onVisualSearch={() => setShowVisualSearch(true)} /></div>

        {/* Bento Grid: Proxie AI + Impact Cards */}
        {!isSearching && (
          <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 relative overflow-hidden bg-[#d2e6bc] rounded-[3rem] p-6 sm:p-8 flex flex-col justify-between group">
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#526442]" fill="currentColor" viewBox="0 0 24 24"><path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg>
                  <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#526442] uppercase tracking-[0.15em] text-xs">Proxie AI Insight</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-[#3b4c2c] leading-tight max-w-xl font-['Plus_Jakarta_Sans']">
                  {items.length} items shared across {profiles.length} neighbors. {transactionCount > 0 ? `${transactionCount} transactions completed so far!` : "Start sharing to build your community!"}
                </p>
                <Link href="/upload" className="inline-flex bg-[#526442] text-white px-6 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-[#526442]/20 font-['Plus_Jakarta_Sans']">List an item</Link>
              </div>
              {/* Decorative leaf */}
              <span
                className="material-symbols-outlined absolute right-8 top-1/2 -translate-y-1/2 text-[#526442] opacity-20 pointer-events-none select-none"
                style={{ fontSize: "180px", fontVariationSettings: "'FILL' 0, 'wght' 400" }}
              >
                eco
              </span>
              <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/20 rounded-full blur-3xl group-hover:bg-white/30 transition-all duration-700 pointer-events-none" />
            </div>
            <div className="md:col-span-4 flex flex-col gap-6">
              <NeighborPointsCard />
              <SustainableLivingCard />
            </div>
          </section>
        )}

        {/* Category Filter Pills */}
        {!isSearching && (
          <section className="flex flex-wrap items-center gap-3">
            {categories.slice(0, 6).map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button key={cat} onClick={() => { setActiveCategory(cat); setShowAllItems(false); setFilterOpen(false); }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-6 py-3 rounded-full font-bold text-sm whitespace-nowrap transition-all font-['Plus_Jakarta_Sans'] ${isActive ? "bg-[#ae3200] text-white shadow-xl shadow-[#ae3200]/20" : "bg-[#e6e2de] text-[#5b4038] hover:bg-[#ebe7e4]"}`}>
                  <span className="capitalize">{cat}</span>
                  {isActive && cat !== "All" && (<span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{filteredItems.length}</span>)}
                </button>
              );
            })}
            {categories.length > 6 && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setFilterOpen((o) => !o); }}
                  className={`flex items-center gap-1.5 px-6 py-3 rounded-full font-bold text-sm whitespace-nowrap transition-all font-['Plus_Jakarta_Sans'] ${
                    categories.slice(6).includes(activeCategory)
                      ? "bg-[#ae3200] text-white shadow-xl shadow-[#ae3200]/20"
                      : "bg-[#e6e2de] text-[#5b4038] hover:bg-[#ebe7e4]"
                  }`}
                >
                  <span>{categories.slice(6).includes(activeCategory) ? activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1) : "Filter"}</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={filterOpen ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
                  </svg>
                </button>
                {filterOpen && (
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-xl border border-[#e6e2de]/50 py-2 min-w-[180px] z-30">
                    {categories.slice(6).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setActiveCategory(cat); setShowAllItems(false); setFilterOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-['Plus_Jakarta_Sans'] capitalize transition-colors ${
                          activeCategory === cat
                            ? "text-[#ae3200] font-bold bg-[#ae3200]/5"
                            : "text-[#5b4038] hover:bg-[#f7f3ef]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Items Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-[#5b4038] uppercase tracking-[0.2em]">
              {isSearching ? (semanticResults.length > 0 ? `AI results for "${searchQuery}"` : semanticLoading ? `Searching "${searchQuery}"...` : `Results for "${searchQuery}"`) : activeCategory === "All" ? "Available Now" : activeCategory}
            </h2>
            <span className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">{filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#ebe7e4] flex items-center justify-center mb-4">
                {isSearching ? (
                  <svg className="w-7 h-7 text-[#8f7067]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                ) : (
                  <CategoryIcon category={activeCategory} className="w-7 h-7 text-[#8f7067]" />
                )}
              </div>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] mb-1">{isSearching ? `No results for "${searchQuery}"` : `No ${activeCategory} items yet`}</p>
              <p className="text-sm text-[#8f7067] mb-6 font-['Be_Vietnam_Pro']">{isSearching ? "Try a different search term" : "Be the first to add one"}</p>
              {!isSearching && (<Link href="/upload" className="px-6 py-3 bg-[#ae3200] text-white rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:brightness-110 transition-all">Magic Upload</Link>)}
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {(showAllItems || isSearching ? filteredItems : filteredItems.slice(0, 9)).map((item) => (
                <Link href={`/item/${item.id}`} key={item.id} className="group bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] block">
                  <div className="relative h-48 sm:h-56 overflow-hidden rounded-2xl">
                    {(item as any).thumbnail_url ? (
                      <img src={(item as any).thumbnail_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#f1edea] to-[#e6e2de] flex items-center justify-center">
                        <CategoryIcon category={item.category} className="w-12 h-12 text-[#8f7067] opacity-40" />
                      </div>
                    )}
                    {item.subcategory && (
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full shadow-sm">
                        <span className="text-[10px] font-black uppercase text-[#526442] font-['Plus_Jakarta_Sans']">{item.subcategory.replace(/_/g, " ")}</span>
                      </div>
                    )}
                    {item.owner && (item.owner as any).trust_score >= 80 && (
                      <div className="absolute top-4 right-4 bg-[#ae3200] px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>
                        <span className="text-[10px] font-black uppercase text-white font-['Plus_Jakarta_Sans']">{(item.owner as any).trust_score.toFixed(0)} Trusted</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight font-['Plus_Jakarta_Sans'] leading-snug line-clamp-2">{isSearching ? highlightMatch(item.title, searchQuery) : item.title}</h3>
                      {item.owner && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#e6e2de] overflow-hidden flex items-center justify-center">
                            <span className="text-[10px] font-bold text-[#5b4038]">{(item.owner as any).display_name?.[0] ?? "?"}</span>
                          </div>
                          <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile/${(item.owner as any).id}`); }}
                            className="text-sm text-[#5b4038] hover:text-[#ae3200] transition-colors cursor-pointer font-['Be_Vietnam_Pro']">
                            Lent by {(item.owner as any).display_name ?? (item.owner as any).username}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.deposit_cents > 0 && (<span className="bg-[#d2e6bc]/50 text-[#526442] px-3 py-1 rounded-full text-[11px] font-bold font-['Plus_Jakarta_Sans']">Borrow Free</span>)}
                      {(item as any).rent_price_day_cents > 0 && (<span className="bg-[#e2dfff] text-[#3530b6] px-3 py-1 rounded-full text-[11px] font-bold font-['Plus_Jakarta_Sans']">Rent ${((item as any).rent_price_day_cents / 100).toFixed(0)}/day</span>)}
                      {(item as any).sell_price_cents > 0 && (<span className="bg-[#ffdbd0] text-[#852400] px-3 py-1 rounded-full text-[11px] font-bold font-['Plus_Jakarta_Sans']">Buy ${((item as any).sell_price_cents / 100).toFixed(0)}</span>)}
                      {item.deposit_cents > 0 && !(item as any).rent_price_day_cents && !(item as any).sell_price_cents && (<span className="text-[11px] text-[#8f7067] font-['Be_Vietnam_Pro']">${(item.deposit_cents / 100).toFixed(0)} deposit</span>)}
                    </div>
                    {item.metadata?.brand && (<p className="text-xs text-[#8f7067] font-mono truncate">{item.metadata.brand} {item.metadata.model ?? ""}</p>)}
                  </div>
                </Link>
              ))}
            </div>
            {!showAllItems && !isSearching && filteredItems.length > 9 && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => setShowAllItems(true)}
                  className="px-8 py-3.5 bg-white border border-[#e6e2de] text-[#1c1b1a] rounded-full font-['Plus_Jakarta_Sans'] font-bold text-sm hover:border-[#ae3200]/30 hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all"
                >
                  Show all {filteredItems.length} items
                </button>
              </div>
            )}
            </>
          )}
        </section>

        {/* Proxe Concierge Banner */}
        {!isSearching && (
          <section className="mb-12">
            <div className="relative bg-[#1c1b1a] rounded-2xl p-8 sm:p-12 md:p-16 overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-center md:text-left">
                  <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2 font-['Plus_Jakarta_Sans']">Can&apos;t find what you need?</h2>
                  <p className="text-[#e6e2de] text-base sm:text-lg max-w-md font-['Be_Vietnam_Pro']">Proxe Concierge has moving carts, party supplies, cleaning equipment and more — delivered to your door.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => { const event = new CustomEvent("open-miles"); window.dispatchEvent(event); }}
                    className="bg-[#ff5a1f] text-white px-8 sm:px-10 py-4 rounded-full font-bold text-sm sm:text-base hover:scale-105 transition-all shadow-xl shadow-[#ff5a1f]/20 font-['Plus_Jakarta_Sans'] whitespace-nowrap">Ask Proxe Concierge</button>
                  <Link href="/profile/00000000-0000-0000-0000-000000000002"
                    className="bg-white/15 text-white px-8 sm:px-10 py-4 rounded-full font-bold text-sm sm:text-base hover:bg-white/25 transition-all font-['Plus_Jakarta_Sans'] text-center whitespace-nowrap border border-white/20">See What&apos;s Available</Link>
                </div>
              </div>
              <div className="absolute right-0 top-0 w-1/3 h-full bg-[#ae3200]/10 -skew-x-12 transform origin-top pointer-events-none" />
            </div>
          </section>
        )}

        {/* Top Neighbors */}
        {!isSearching && (
          <section className="mb-12">
            <h2 className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-[#5b4038] uppercase tracking-[0.2em] mb-5">Your Neighbors</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {profiles
                .filter((p) => p.id !== "00000000-0000-0000-0000-000000000002")
                .map((p) => {
                const itemCount = items.filter((i) => (i.owner as any)?.id === p.id).length;
                return (
                  <Link key={p.id} href={`/profile/${p.id}`}
                    className="bg-white rounded-2xl p-4 sm:p-5 text-center hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all block border border-[#e6e2de]/30">
                    <div className="w-12 h-12 rounded-full bg-[#e6e2de] flex items-center justify-center mx-auto mb-3">
                      <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#5b4038] text-base">{p.display_name?.[0] ?? "?"}</span>
                    </div>
                    <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm truncate text-[#1c1b1a]">{p.display_name}</p>
                    {(p as any).show_unit_number !== false && p.unit_number && (
                      <p className="text-xs text-[#8f7067] mb-2 font-['Be_Vietnam_Pro']">Unit {p.unit_number}</p>
                    )}
                    {itemCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#d2e6bc]/40 text-[#526442] font-['Plus_Jakarta_Sans']">
                        {itemCount} item{itemCount !== 1 ? "s" : ""} shared
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-end px-4 pb-5 pt-2 bg-[#fdf9f5]/80 backdrop-blur-xl shadow-[0_-10px_40px_rgba(174,50,0,0.04)] rounded-t-[2rem] border-t border-[#ae3200]/10 md:hidden">
        <Link href="/dashboard" className="flex flex-col items-center justify-center bg-[#ff5a1f] text-white rounded-full p-3.5 -mt-4 shadow-lg">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>
        </Link>
        <Link href="/upload" className="flex flex-col items-center justify-center text-[#526442] p-2 hover:bg-[#d2e6bc]/30 rounded-full transition-all">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
          <span className="font-['Plus_Jakarta_Sans'] text-[10px] font-bold mt-0.5">Lend</span>
        </Link>
        <button onClick={() => { const event = new CustomEvent("open-miles"); window.dispatchEvent(event); }}
          className="flex flex-col items-center justify-center text-[#526442] p-2 hover:bg-[#d2e6bc]/30 rounded-full transition-all">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg>
          <span className="font-['Plus_Jakarta_Sans'] text-[10px] font-bold mt-0.5">Proxie</span>
        </button>
        <Link href="/inbox" className="flex flex-col items-center justify-center text-[#526442] p-2 hover:bg-[#d2e6bc]/30 rounded-full transition-all relative">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>
          <span className="font-['Plus_Jakarta_Sans'] text-[10px] font-bold mt-0.5">Community</span>
          {unreadCount > 0 && (<span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-[#ae3200] text-white text-[8px] font-bold flex items-center justify-center">{unreadCount}</span>)}
        </Link>
        <Link href="/profile/me" className="flex flex-col items-center justify-center text-[#526442] p-2 hover:bg-[#d2e6bc]/30 rounded-full transition-all">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
          <span className="font-['Plus_Jakarta_Sans'] text-[10px] font-bold mt-0.5">Profile</span>
        </Link>
      </nav>

      <VisualSearchModal isOpen={showVisualSearch} onClose={() => setShowVisualSearch(false)} />
    </main>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (<mark key={i} className="bg-[#ae3200]/20 text-[#ae3200] rounded px-0.5">{part}</mark>) : (part),
      )}
    </>
  );
}
