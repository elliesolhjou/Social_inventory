"use client";

import { useState, useEffect } from "react";

// ── Sustainable Living Card ───────────────────────────────────────────

interface ImpactData {
  user: {
    borrows_completed: number;
    lends_completed: number;
    waste_avoided_kg: number;
    co2_avoided_kg: number;
  };
  building: {
    total_borrows: number;
    waste_avoided_kg: number;
    co2_avoided_kg: number;
    unique_items_shared: number;
    active_sharers: number;
  } | null;
}

export function SustainableLivingCard() {
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/impact")
      .then((r) => r.json())
      .then(setImpact)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-inventory-100 rounded w-1/3 mb-4" />
        <div className="h-20 bg-inventory-100 rounded" />
      </div>
    );
  }

  if (!impact) return null;

  const buildingWaste = impact.building?.waste_avoided_kg ?? 0;
  const userWaste = impact.user.waste_avoided_kg;
  const totalTransactions =
    impact.user.borrows_completed + impact.user.lends_completed;

  return (
    <div className="glass rounded-2xl p-5 border border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-green-50/30">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🌱</span>
        <h3 className="font-display text-xs font-bold text-emerald-700 uppercase tracking-widest">
          Sustainable Living
        </h3>
      </div>

      {/* Building impact — hero stat */}
      <div className="text-center mb-4">
        <p className="font-display text-3xl font-bold text-emerald-800">
          {buildingWaste >= 1000
            ? `${(buildingWaste / 1000).toFixed(1)} tons`
            : `${buildingWaste.toFixed(1)} kg`}
        </p>
        <p className="text-xs text-emerald-600 mt-1">
          estimated manufacturing waste avoided by your building
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-xl bg-white/60">
          <p className="font-display text-lg font-bold text-emerald-700">
            {totalTransactions}
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            your transactions
          </p>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/60">
          <p className="font-display text-lg font-bold text-emerald-700">
            {userWaste.toFixed(1)} kg
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            your impact
          </p>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/60">
          <p className="font-display text-lg font-bold text-emerald-700">
            {impact.building?.active_sharers ?? 0}
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            active sharers
          </p>
        </div>
      </div>

      {/* Methodology note */}
      <p className="text-[10px] text-emerald-500 mt-3 text-center">
        Based on EPA product lifecycle estimates.{" "}
        <span className="underline cursor-pointer">Methodology</span>
      </p>
    </div>
  );
}

// ── Neighbor Points Card ──────────────────────────────────────────────

interface PointsData {
  balance: number;
  history: Array<{
    id: string;
    action: string;
    points: number;
    description: string;
    created_at: string;
  }>;
  leaderboard: Array<{
    user_id: string;
    display_name: string;
    total_points: number;
  }>;
}

const ACTION_LABELS: Record<string, string> = {
  complete_lend: "Completed a lend",
  complete_borrow: "Completed a borrow",
  first_listing: "Listed first item",
  referral: "Referred a neighbor",
  five_star_review: "Received 5-star review",
  weekly_streak: "Weekly streak bonus",
  redeem_gift_card: "Redeemed gift card",
  redeem_priority: "Priority listing",
  redeem_deposit_reduction: "Deposit reduction",
};

// Spending tiers from the ecosystem diagram
const SPEND_TIERS = [
  { points: 200, label: "Priority Listing", icon: "⭐", desc: "7 days visibility boost" },
  { points: 500, label: "$5 Gift Card", icon: "🎁", desc: "Via Tremendous" },
  { points: 750, label: "Reduced Deposit", icon: "🛡️", desc: "25% off next borrow" },
  { points: 1000, label: "Local Partner Perk", icon: "☕", desc: "Neighborhood business" },
];

export function NeighborPointsCard() {
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetch("/api/points")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-inventory-100 rounded w-1/3 mb-4" />
        <div className="h-20 bg-inventory-100 rounded" />
      </div>
    );
  }

  if (!data) return null;

  // Find next tier the user can reach
  const nextTier = SPEND_TIERS.find((t) => t.points > data.balance) ?? SPEND_TIERS[SPEND_TIERS.length - 1];
  const progressToNext = Math.min(
    (data.balance / nextTier.points) * 100,
    100
  );

  return (
    <div className="glass rounded-2xl p-5 border border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏅</span>
          <h3 className="font-display text-xs font-bold text-amber-700 uppercase tracking-widest">
            Neighbor Points
          </h3>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-amber-600 underline"
        >
          {showDetails ? "Hide" : "Details"}
        </button>
      </div>

      {/* Balance — hero */}
      <div className="text-center mb-4">
        <p className="font-display text-4xl font-bold text-amber-800">
          {data.balance}
        </p>
        <p className="text-xs text-amber-600 mt-1">points earned</p>
      </div>

      {/* Progress to next tier */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-amber-600 mb-1">
          <span>Next: {nextTier.icon} {nextTier.label}</span>
          <span>{nextTier.points - data.balance} pts to go</span>
        </div>
        <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
            style={{ width: `${progressToNext}%` }}
          />
        </div>
      </div>

      {/* Spend tiers — compact */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {SPEND_TIERS.map((tier) => (
          <div
            key={tier.points}
            className={`text-center p-2 rounded-xl text-[10px] ${
              data.balance >= tier.points
                ? "bg-amber-200/60 text-amber-800"
                : "bg-white/40 text-amber-400"
            }`}
          >
            <span className="text-base block">{tier.icon}</span>
            <span className="font-bold">{tier.points}</span>
          </div>
        ))}
      </div>

      {/* Details panel */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-amber-200/50 space-y-4">
          {/* Recent history */}
          {data.history.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-amber-700 mb-2">Recent Activity</h4>
              <div className="space-y-1.5">
                {data.history.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex justify-between items-center text-xs">
                    <span className="text-amber-700">
                      {ACTION_LABELS[entry.action] ?? entry.description ?? entry.action}
                    </span>
                    <span className="font-bold text-amber-600">
                      +{entry.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Building leaderboard */}
          {data.leaderboard.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-amber-700 mb-2">Building Leaderboard</h4>
              <div className="space-y-1.5">
                {data.leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={entry.user_id} className="flex justify-between items-center text-xs">
                    <span className="text-amber-700">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}{" "}
                      {entry.display_name ?? "Neighbor"}
                    </span>
                    <span className="font-bold text-amber-600">
                      {entry.total_points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.history.length === 0 && data.leaderboard.length === 0 && (
            <p className="text-xs text-amber-500 text-center">
              Start sharing to earn your first points!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
