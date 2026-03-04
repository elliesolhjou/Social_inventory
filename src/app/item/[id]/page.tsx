import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ItemDetail({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  // Fetch item with owner
  const { data: item } = await supabase
    .from("items")
    .select(
      "*, owner:profiles(id, username, display_name, trust_score, reputation_tags, bio, unit_number, avatar_url)",
    )
    .eq("id", id)
    .single();

  if (!item) return notFound();

  // Fetch recent transactions for this item
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, borrower:profiles(username, display_name, trust_score)")
    .eq("item_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch other items by same owner
  const { data: ownerItems } = await supabase
    .from("items")
    .select("id, title, category, deposit_cents, status")
    .eq("owner_id", item.owner_id)
    .neq("id", id)
    .eq("status", "available")
    .limit(4);

  const owner = item.owner as any;
  const meta = (item.metadata as any) ?? {};

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-inventory-200/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-inventory-500 hover:text-inventory-900 transition-colors"
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
            <span className="text-sm font-medium">Back</span>
          </Link>
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight"
          >
            The Social Inventory
          </Link>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Item info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero image placeholder */}
            <div className="relative h-64 sm:h-80 rounded-3xl bg-gradient-to-br from-inventory-100 to-inventory-200 flex items-center justify-center overflow-hidden">
              <span className="text-8xl opacity-30">
                {getCategoryEmoji(item.category)}
              </span>
              <div className="absolute top-4 right-4 flex gap-2">
                <StatusBadge status={item.status} />
              </div>
            </div>

            {/* Title & core info */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-accent-muted text-accent-dark font-medium">
                  {item.category}
                </span>
                {item.subcategory && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-inventory-100 text-inventory-600">
                    {item.subcategory.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight mb-2">
                {item.title}
              </h1>
              {item.description && (
                <p className="text-inventory-500 leading-relaxed">
                  {item.description}
                </p>
              )}
              {item.ai_description && (
                <div className="mt-3 p-3 rounded-xl bg-inventory-50 border border-inventory-100">
                  <span className="text-xs font-mono text-accent font-bold">
                    AI DESCRIPTION
                  </span>
                  <p className="text-sm text-inventory-600 mt-1">
                    {item.ai_description}
                  </p>
                </div>
              )}
            </div>

            {/* Metadata grid */}
            <div className="glass rounded-2xl p-6">
              <h2 className="font-display text-sm font-bold text-inventory-400 uppercase tracking-widest mb-4">
                Details
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {meta.brand && <DetailCell label="Brand" value={meta.brand} />}
                {meta.model && <DetailCell label="Model" value={meta.model} />}
                {meta.year && (
                  <DetailCell label="Year" value={meta.year.toString()} />
                )}
                {meta.color && <DetailCell label="Color" value={meta.color} />}
                {meta.original_price_cents && (
                  <DetailCell
                    label="Retail Price"
                    value={`$${(meta.original_price_cents / 100).toLocaleString()}`}
                  />
                )}
                <DetailCell
                  label="Max Borrow"
                  value={`${item.max_borrow_days} days`}
                />
                <DetailCell
                  label="Times Borrowed"
                  value={item.times_borrowed.toString()}
                />
                {item.deposit_cents > 0 && (
                  <DetailCell
                    label="Deposit"
                    value={`$${(item.deposit_cents / 100).toFixed(0)}`}
                    highlight
                  />
                )}
              </div>
              {item.rules && (
                <div className="mt-4 pt-4 border-t border-inventory-100">
                  <span className="text-xs font-bold text-inventory-400 uppercase tracking-widest">
                    Rules
                  </span>
                  <p className="text-sm text-inventory-600 mt-1">
                    {item.rules}
                  </p>
                </div>
              )}
            </div>

            {/* Transaction history */}
            {transactions && transactions.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="font-display text-sm font-bold text-inventory-400 uppercase tracking-widest mb-4">
                  Recent Activity
                </h2>
                <div className="space-y-3">
                  {transactions.map((tx: any) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2 border-b border-inventory-50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-inventory-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-inventory-500">
                            {tx.borrower?.display_name?.[0] ?? "?"}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm font-medium">
                            {tx.borrower?.display_name ?? "Unknown"}
                          </span>
                          <span className="text-xs text-inventory-400 ml-2">
                            {formatRelativeDate(tx.created_at)}
                          </span>
                        </div>
                      </div>
                      <TransactionStateBadge state={tx.state} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: Owner card + CTA */}
          <div className="space-y-6">
            {/* Borrow CTA */}
            <div className="glass rounded-2xl p-6 sticky top-24">
              {item.deposit_cents > 0 && (
                <div className="text-center mb-4">
                  <span className="text-sm text-inventory-400">
                    Refundable deposit
                  </span>
                  <p className="font-display text-3xl font-bold">
                    ${(item.deposit_cents / 100).toFixed(0)}
                  </p>
                </div>
              )}
              <button
                className={`w-full py-3.5 rounded-2xl font-display font-semibold text-lg transition-all ${
                  item.status === "available"
                    ? "bg-inventory-950 text-white hover:bg-inventory-800 active:scale-[0.98]"
                    : "bg-inventory-200 text-inventory-400 cursor-not-allowed"
                }`}
                disabled={item.status !== "available"}
              >
                {item.status === "available"
                  ? "Request to Borrow"
                  : "Unavailable"}
              </button>
              <p className="text-xs text-inventory-400 text-center mt-3">
                Up to {item.max_borrow_days} days · Deposit returned on safe
                return
              </p>
            </div>

            {/* Owner card */}
            {owner && (
              <div className="glass rounded-2xl p-6">
                <h2 className="font-display text-sm font-bold text-inventory-400 uppercase tracking-widest mb-4">
                  Owner
                </h2>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-inventory-200 flex items-center justify-center">
                    <span className="font-display font-bold text-lg text-inventory-600">
                      {owner.display_name?.[0] ?? "?"}
                    </span>
                  </div>
                  <div>
                    <p className="font-display font-bold">
                      {owner.display_name}
                    </p>
                    <p className="text-xs text-inventory-400">
                      Unit {owner.unit_number} · @{owner.username}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <TrustBadge score={owner.trust_score} />
                  <span className="text-xs text-inventory-400">
                    trust score
                  </span>
                </div>

                {owner.reputation_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {owner.reputation_tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-inventory-100 text-inventory-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {owner.bio && (
                  <p className="text-sm text-inventory-500 leading-relaxed">
                    {owner.bio}
                  </p>
                )}
              </div>
            )}

            {/* Other items by owner */}
            {ownerItems && ownerItems.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="font-display text-sm font-bold text-inventory-400 uppercase tracking-widest mb-4">
                  More from {owner?.display_name?.split(" ")[0] ?? "Owner"}
                </h2>
                <div className="space-y-2">
                  {ownerItems.map((oi: any) => (
                    <Link
                      key={oi.id}
                      href={`/item/${oi.id}`}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-inventory-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {getCategoryEmoji(oi.category)}
                        </span>
                        <span className="text-sm font-medium group-hover:text-accent transition-colors">
                          {oi.title}
                        </span>
                      </div>
                      {oi.deposit_cents > 0 && (
                        <span className="text-xs text-inventory-400 font-mono">
                          ${(oi.deposit_cents / 100).toFixed(0)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// --- Helper Components ---

function DetailCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <span className="text-xs text-inventory-400 uppercase tracking-wider">
        {label}
      </span>
      <p
        className={`text-sm font-medium mt-0.5 ${highlight ? "text-accent-dark" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function TrustBadge({ score }: { score: number }) {
  const level = score >= 85 ? "high" : score >= 60 ? "medium" : "low";
  const colors = {
    high: "bg-trust-high/10 text-trust-high",
    medium: "bg-trust-medium/10 text-trust-medium",
    low: "bg-trust-low/10 text-trust-low",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold ${colors[level]}`}
    >
      {score.toFixed(0)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    available: "bg-trust-high/90 text-white",
    borrowed: "bg-trust-medium/90 text-white",
    maintenance: "bg-inventory-400/90 text-white",
    retired: "bg-inventory-300/90 text-white",
    flagged: "bg-trust-low/90 text-white",
  };
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${colors[status] ?? "bg-inventory-200"}`}
    >
      {status}
    </span>
  );
}

function TransactionStateBadge({ state }: { state: string }) {
  const config: Record<string, { color: string; label: string }> = {
    requested: {
      color: "bg-inventory-200 text-inventory-600",
      label: "Requested",
    },
    approved: { color: "bg-blue-100 text-blue-700", label: "Approved" },
    picked_up: {
      color: "bg-trust-medium/10 text-trust-medium",
      label: "Borrowed",
    },
    returned: { color: "bg-trust-high/10 text-trust-high", label: "Returned" },
    disputed: { color: "bg-trust-low/10 text-trust-low", label: "Disputed" },
    resolved: {
      color: "bg-inventory-200 text-inventory-600",
      label: "Resolved",
    },
  };
  const c = config[state] ?? config.requested;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      {c.label}
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
  };
  return map[category] ?? "📦";
}

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
