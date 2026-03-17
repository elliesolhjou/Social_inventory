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

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMe, setIsMe] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetch = async () => {
      const [profileRes, userRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", params.id).single(),
        supabase.auth.getUser(),
      ]);

      if (profileRes.error || !profileRes.data) { router.push("/dashboard"); return; }
      setProfile(profileRes.data);
      setIsMe(userRes.data.user?.id === profileRes.data.id);

      const { data: itemsData } = await supabase
        .from("items")
        .select("id, title, category, deposit_cents, ai_condition, status, times_borrowed")
        .eq("owner_id", params.id)
        .order("times_borrowed", { ascending: false });

      setItems(itemsData ?? []);
      setLoading(false);
    };
    fetch();
  }, [params.id]);

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
    </main>
  );
  if (!profile) return null;

  const availableItems = items.filter(i => i.status === "available");
  const totalBorrows = items.reduce((sum, i) => sum + (i.times_borrowed || 0), 0);

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
            {/* Avatar */}
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
              <p className="text-inventory-400 text-sm mt-0.5">@{profile.username} · </p>
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

        {/* Items */}
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
                  <div className="w-12 h-12 rounded-xl bg-inventory-100 flex items-center justify-center flex-shrink-0 text-xl">
                    {getCategoryEmoji(item.category)}
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
      </div>
    </main>
  );
}
