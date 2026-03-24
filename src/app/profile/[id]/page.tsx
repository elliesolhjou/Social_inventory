"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  ai_condition: string;
  status: string;
  times_borrowed: number;
};

type BorrowedItem = {
  id: string;
  state: string;
  requested_at: string;
  picked_up_at: string | null;
  due_at: string | null;
  returned_at: string | null;
  item: {
    id: string;
    title: string;
    category: string;
    thumbnail_url: string | null;
  };
  owner: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
};

type Tab = "items" | "borrowed";

function TrustBadge({ score }: { score: number }) {
  const level = score >= 85 ? "high" : score >= 60 ? "medium" : "low";
  const colors = {
    high: "bg-trust-high/10 text-trust-high border-trust-high/20",
    medium: "bg-trust-medium/10 text-trust-medium border-trust-medium/20",
    low: "bg-inventory-100 text-inventory-500 border-inventory-200",
  };
  const labels = { high: "Highly Trusted", medium: "Good Standing", low: "New Member" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${colors[level]}`}>
      <span className="w-2 h-2 rounded-full bg-current" />
      {labels[level]} · {score.toFixed(0)}
    </span>
  );
}

function getCategoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    electronics: "📱", kitchen: "🍳", outdoor: "⛺", sports: "🏋️",
    tools: "🔧", entertainment: "🎮", home: "🏠", wellness: "🧘",
    travel: "✈️", creative: "🎨", clothing: "👗", music: "🎵",
  };
  return map[cat] ?? "📦";
}

function getMemberDuration(createdAt: string): string {
  const months = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (months < 1) return "New member";
  if (months === 1) return "1 month";
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? "s" : ""}`;
}

function getStateLabel(state: string) {
  const map: Record<string, { label: string; color: string }> = {
    requested: { label: "Requested", color: "text-inventory-500 bg-inventory-100" },
    approved: { label: "Approved", color: "text-blue-600 bg-blue-50" },
    picked_up: { label: "Active", color: "text-accent bg-accent-muted" },
    returned: { label: "Returned", color: "text-trust-high bg-trust-high/10" },
    disputed: { label: "Disputed", color: "text-red-500 bg-red-50" },
    resolved: { label: "Resolved", color: "text-inventory-500 bg-inventory-100" },
  };
  return map[state] ?? { label: state, color: "text-inventory-500 bg-inventory-100" };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [borrowedItems, setBorrowedItems] = useState<BorrowedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMe, setIsMe] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("items");
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const [profileRes, userRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", params.id).single(),
        supabase.auth.getUser(),
      ]);

      if (profileRes.error || !profileRes.data) { router.push("/dashboard"); return; }
      setProfile(profileRes.data);
      const me = userRes.data.user?.id === profileRes.data.id;
      setIsMe(me);

      // Fetch owned items
      const { data: itemsData } = await supabase
        .from("items")
        .select("id, title, category, deposit_cents, ai_condition, status, times_borrowed")
        .eq("owner_id", params.id)
        .order("times_borrowed", { ascending: false });
      setItems(itemsData ?? []);

      // Fetch borrowed items (only for own profile)
      if (me) {
        const { data: txData } = await supabase
          .from("transactions")
          .select(`
            id, state, requested_at, picked_up_at, due_at, returned_at,
            item:items!transactions_item_id_fkey(id, title, category, thumbnail_url),
            owner:profiles!transactions_owner_id_fkey(id, display_name, avatar_url)
          `)
          .eq("borrower_id", params.id)
          .order("requested_at", { ascending: false });
        setBorrowedItems((txData as any) ?? []);
      }

      setLoading(false);
    };
    load();
  }, [params.id]);

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
    </main>
  );
  if (!profile) return null;

  const availableItems = items.filter(i => i.status === "available");
  const totalBorrows = items.reduce((sum, i) => sum + (i.times_borrowed || 0), 0);
  const activeBorrows = borrowedItems.filter(b => ["requested", "approved", "picked_up"].includes(b.state));
  const pastBorrows = borrowedItems.filter(b => ["returned", "resolved"].includes(b.state));

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-inventory-200/50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-inventory-500 hover:text-inventory-900 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-display font-bold text-base flex-1">{profile.display_name}</h1>
          {isMe && (
            <Link href="/profile/me" className="px-4 py-1.5 rounded-xl border-2 border-accent text-accent font-display font-bold text-sm hover:bg-accent hover:text-white transition-colors">
              Edit Profile
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">
        {/* Profile card */}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <span className="font-display font-black text-3xl text-accent">
                  {profile.display_name?.[0] ?? "?"}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-2xl">{profile.display_name}</h2>
              <p className="text-inventory-400 text-sm mt-0.5">@{profile.username}</p>
              <div className="mt-3">
                <TrustBadge score={profile.trust_score} />
              </div>
            </div>
          </div>

          {profile.bio && (
            <p className="mt-5 pt-5 border-t border-inventory-100 text-inventory-600 text-sm leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-inventory-100">
            <div className="text-center">
              <p className="font-display font-bold text-xl">{availableItems.length}</p>
              <p className="text-xs text-inventory-400 mt-0.5">Items listed</p>
            </div>
            <div className="text-center border-x border-inventory-100">
              <p className="font-display font-bold text-xl">{totalBorrows}</p>
              <p className="text-xs text-inventory-400 mt-0.5">Times lent</p>
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-xl">{getMemberDuration(profile.created_at)}</p>
              <p className="text-xs text-inventory-400 mt-0.5">Member</p>
            </div>
          </div>

          {/* Reputation tags */}
          {profile.reputation_tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-inventory-100">
              {profile.reputation_tags.map((tag) => (
                <span key={tag} className="text-xs px-3 py-1.5 rounded-full bg-inventory-100 text-inventory-600 font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs — only show if viewing own profile */}
        {isMe ? (
          <>
            <div className="flex rounded-2xl bg-inventory-100 p-1">
              {([
                { key: "items" as Tab, label: "My Items", count: items.length },
                { key: "borrowed" as Tab, label: "Borrowed", count: borrowedItems.length },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-display font-semibold transition-all flex items-center justify-center gap-2 ${
                    activeTab === tab.key
                      ? "bg-white shadow-sm text-inventory-900"
                      : "text-inventory-500 hover:text-inventory-700"
                  }`}
                >
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key ? "bg-accent/10 text-accent" : "bg-inventory-200 text-inventory-400"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* My Items tab */}
            {activeTab === "items" && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest">
                    My Items ({items.length})
                  </h2>
                  {items.length > 0 && (
                    <Link
                      href="/upload"
                      className="px-4 py-1.5 rounded-xl bg-accent text-white font-display font-bold text-sm hover:bg-accent-dark transition-colors flex items-center gap-1.5"
                    >
                      <span>+</span> Add Item
                    </Link>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="glass rounded-2xl p-10 text-center">
                    <p className="text-3xl mb-3">📦</p>
                    <p className="font-display font-bold text-inventory-700">No items listed yet</p>
                    <Link
                      href="/upload"
                      className="inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-2xl bg-accent text-white font-display font-bold text-sm hover:bg-accent-dark transition-colors"
                    >
                      <span className="text-lg">✨</span> Upload Your First Item
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/item/${item.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4 card-hover block"
                      >
                        <div className="w-12 h-12 rounded-xl bg-inventory-100 flex items-center justify-center flex-shrink-0 text-xl overflow-hidden">
                          {item.thumbnail_url ? (
                            <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            getCategoryEmoji(item.category)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-bold text-sm truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-inventory-100 text-inventory-500 capitalize">{item.category}</span>
                            {item.times_borrowed > 0 && (
                              <span className="text-xs text-inventory-400">Borrowed {item.times_borrowed}×</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-accent">
                            {item.deposit_cents > 0 ? `$${(item.deposit_cents / 100).toFixed(0)}` : "Free"}
                          </p>
                          <span className={`text-xs font-medium ${item.status === "available" ? "text-trust-high" : "text-inventory-400"}`}>
                            {item.status === "available" ? "Available" : "Lent out"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Borrowed Items tab */}
            {activeTab === "borrowed" && (
              <section className="space-y-6">
                {/* Active borrows */}
                {activeBorrows.length > 0 && (
                  <div>
                    <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-4">
                      Active ({activeBorrows.length})
                    </h2>
                    <div className="space-y-3">
                      {activeBorrows.map((tx) => {
                        const stateInfo = getStateLabel(tx.state);
                        const item = tx.item as any;
                        const owner = tx.owner as any;
                        return (
                          <Link
                            key={tx.id}
                            href={`/item/${item?.id}`}
                            className="glass rounded-2xl p-4 flex items-center gap-4 card-hover block"
                          >
                            <div className="w-12 h-12 rounded-xl bg-inventory-100 flex items-center justify-center flex-shrink-0 text-xl overflow-hidden">
                              {item?.thumbnail_url ? (
                                <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                getCategoryEmoji(item?.category ?? "")
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-display font-bold text-sm truncate">{item?.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-inventory-400">
                                  from {owner?.display_name}
                                </span>
                                {tx.due_at && (
                                  <span className="text-xs text-inventory-400">
                                    · due {new Date(tx.due_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${stateInfo.color}`}>
                                {stateInfo.label}
                              </span>
                              <p className="text-xs text-inventory-400 mt-1">{timeAgo(tx.requested_at)}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Past borrows */}
                {pastBorrows.length > 0 && (
                  <div>
                    <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-4">
                      History ({pastBorrows.length})
                    </h2>
                    <div className="space-y-3">
                      {pastBorrows.map((tx) => {
                        const stateInfo = getStateLabel(tx.state);
                        const item = tx.item as any;
                        const owner = tx.owner as any;
                        return (
                          <Link
                            key={tx.id}
                            href={`/item/${item?.id}`}
                            className="glass rounded-2xl p-4 flex items-center gap-4 card-hover block opacity-75 hover:opacity-100 transition-opacity"
                          >
                            <div className="w-12 h-12 rounded-xl bg-inventory-100 flex items-center justify-center flex-shrink-0 text-xl overflow-hidden">
                              {item?.thumbnail_url ? (
                                <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                getCategoryEmoji(item?.category ?? "")
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-display font-bold text-sm truncate">{item?.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-inventory-400">
                                  from {owner?.display_name}
                                </span>
                                {tx.returned_at && (
                                  <span className="text-xs text-inventory-400">
                                    · returned {new Date(tx.returned_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${stateInfo.color}`}>
                                {stateInfo.label}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {borrowedItems.length === 0 && (
                  <div className="glass rounded-2xl p-10 text-center">
                    <p className="text-3xl mb-3">🤲</p>
                    <p className="font-display font-bold text-inventory-700">No borrows yet</p>
                    <p className="text-sm text-inventory-400 mt-2">
                      Browse your building's inventory and borrow something!
                    </p>
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-2xl bg-accent text-white font-display font-bold text-sm hover:bg-accent-dark transition-colors"
                    >
                      Browse Items
                    </Link>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          /* Public view — no tabs, just items */
          <section>
            <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-4">
              {profile.display_name.split(" ")[0]}'s Items ({items.length})
            </h2>

            {items.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center">
                <p className="text-3xl mb-3">📦</p>
                <p className="font-display font-bold text-inventory-700">No items listed yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/item/${item.id}`}
                    className="glass rounded-2xl p-4 flex items-center gap-4 card-hover block"
                  >
                    <div className="w-12 h-12 rounded-xl bg-inventory-100 flex items-center justify-center flex-shrink-0 text-xl overflow-hidden">
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        getCategoryEmoji(item.category)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-inventory-100 text-inventory-500 capitalize">{item.category}</span>
                        {item.times_borrowed > 0 && (
                          <span className="text-xs text-inventory-400">Borrowed {item.times_borrowed}×</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-accent">
                        {item.deposit_cents > 0 ? `$${(item.deposit_cents / 100).toFixed(0)}` : "Free"}
                      </p>
                      <span className={`text-xs font-medium ${item.status === "available" ? "text-trust-high" : "text-inventory-400"}`}>
                        {item.status === "available" ? "Available" : "Lent out"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
