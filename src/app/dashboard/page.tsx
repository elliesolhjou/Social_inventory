import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import TimeGreeting from "@/components/TimeGreeting";

export default async function Dashboard() {
  const supabase = await createServerSupabase();

  const { data: items } = await supabase
    .from("items")
    .select(
      "*, owner:profiles(username, display_name, trust_score, reputation_tags)",
    )
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("trust_score", { ascending: false })
    .limit(10);

  const { data: stats } = await supabase
    .from("transactions")
    .select("id", { count: "exact" });

  const categories = [...new Set(items?.map((i) => i.category) ?? [])];

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-inventory-200/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight"
          >
            The Social Inventory
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/upload"
              className="px-4 py-2 bg-accent text-white rounded-xl font-display font-semibold text-sm hover:bg-accent-dark transition-colors flex items-center gap-1.5"
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
              Magic Upload
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

      <div className="max-w-6xl mx-auto px-6 pt-8">
        {/* Welcome + Stats */}
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold mb-2">
            <TimeGreeting />
          </h1>
          <p className="text-inventory-500">
            {items?.length ?? 0} items available · {stats?.length ?? 0} total
            transactions · {profiles?.length ?? 0} trusted neighbors
          </p>
        </div>

        {/* Trending Categories */}
        <section className="mb-10">
          <h2 className="font-display text-sm font-bold text-inventory-400 uppercase tracking-widest mb-4">
            Categories
          </h2>
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <span
                key={cat}
                className="px-4 py-2 rounded-full bg-inventory-100 text-inventory-700 text-sm font-medium hover:bg-accent hover:text-white transition-colors cursor-pointer"
              >
                {cat}
              </span>
            ))}
          </div>
        </section>

        {/* Items Grid */}
        <section className="mb-12">
          <h2 className="font-display text-sm font-bold text-inventory-400 uppercase tracking-widest mb-4">
            Available Now
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items?.map((item) => (
              <Link
                href={`/item/${item.id}`}
                key={item.id}
                className="glass rounded-2xl overflow-hidden card-hover group block"
              >
                {/* Placeholder image */}
                <div className="h-40 bg-gradient-to-br from-inventory-100 to-inventory-200 flex items-center justify-center">
                  <span className="text-4xl opacity-50">
                    {getCategoryEmoji(item.category)}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-display font-bold text-base leading-tight">
                      {item.title}
                    </h3>
                    {item.deposit_cents > 0 && (
                      <span className="text-xs text-inventory-400 font-mono whitespace-nowrap ml-2">
                        ${(item.deposit_cents / 100).toFixed(0)} dep
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-inventory-100 text-inventory-600">
                      {item.category}
                    </span>
                    {item.subcategory && (
                      <span className="text-xs text-inventory-400">
                        {item.subcategory.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>

                  {/* Owner info */}
                  {item.owner && (
                    <div className="flex items-center justify-between pt-3 border-t border-inventory-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-inventory-200 flex items-center justify-center">
                          <span className="text-xs font-bold text-inventory-600">
                            {(item.owner as any).display_name?.[0] ?? "?"}
                          </span>
                        </div>
                        <span className="text-sm text-inventory-500">
                          {(item.owner as any).username}
                        </span>
                      </div>
                      <TrustBadge score={(item.owner as any).trust_score} />
                    </div>
                  )}

                  {item.metadata?.brand && (
                    <p className="text-xs text-inventory-400 mt-2 font-mono">
                      {item.metadata.brand} {item.metadata.model ?? ""}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Top Neighbors */}
        <section>
          <h2 className="font-display text-sm font-bold text-inventory-400 uppercase tracking-widest mb-4">
            Most Trusted Neighbors
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {profiles?.map((p, i) => (
              <div
                key={p.id}
                className="glass rounded-2xl p-4 text-center card-hover"
              >
                <div className="w-12 h-12 rounded-full bg-inventory-200 flex items-center justify-center mx-auto mb-3">
                  <span className="font-display font-bold text-inventory-600">
                    {p.display_name?.[0] ?? "?"}
                  </span>
                </div>
                <p className="font-display font-bold text-sm truncate">
                  {p.display_name}
                </p>
                <p className="text-xs text-inventory-400 mb-2">
                  Unit {p.unit_number}
                </p>
                <TrustBadge score={p.trust_score} />
                {p.reputation_tags?.length > 0 && (
                  <p className="text-xs text-inventory-400 mt-2 truncate">
                    {p.reputation_tags[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

// --- Helper components ---

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
