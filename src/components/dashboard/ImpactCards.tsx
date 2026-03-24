"use client";

import { useState, useEffect } from "react";

// ── Sustainable Living Card (compact, matches Stitch right-side panel) ──

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
      <div className="bg-[#f7f3ef] rounded-2xl p-5 animate-pulse border border-[#e6e2de]/30">
        <div className="h-4 bg-[#ebe7e4] rounded w-2/3 mb-2" />
        <div className="h-4 bg-[#ebe7e4] rounded w-full" />
      </div>
    );
  }

  if (!impact) return null;

  const co2 = impact.user.co2_avoided_kg;

  return (
    <div className="bg-[#f7f3ef] rounded-2xl p-5 border border-[#e6e2de]/30 flex items-center gap-4">
      {/* Leaf icon */}
      <div className="flex-shrink-0 p-3 bg-[#d2e6bc] rounded-xl text-[#526442]">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292M6.115 5.19A9 9 0 1017.18 4.64M6.115 5.19A8.965 8.965 0 0112 3c1.929 0 3.716.607 5.18 1.64" />
        </svg>
      </div>
      {/* Text */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5b4038] font-['Plus_Jakarta_Sans'] mb-0.5">
          Sustainability
        </p>
        <p className="text-sm text-[#1c1b1a] font-['Be_Vietnam_Pro']">
          You saved <span className="text-[#526442] font-bold">{co2.toFixed(0)}kg of CO2</span> this month by borrowing.
        </p>
      </div>
    </div>
  );
}

// ── Neighbor Points Card (matches Stitch screenshot exactly) ──────────

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

const SPEND_TIERS = [
  { points: 200, label: "Priority Listing" },
  { points: 500, label: "$5 Gift Card" },
  { points: 750, label: "Reduced Deposit" },
  { points: 1000, label: "Local Partner Perk" },
];

/* SVG tier icons — no emojis */
function TierIcon({ index, className = "w-5 h-5" }: { index: number; className?: string }) {
  switch (index) {
    case 0: // star — priority listing
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
      );
    case 1: // gift — gift card
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M9.375 3a1.875 1.875 0 0 0 0 3.75h1.875v4.5H3.375A1.875 1.875 0 0 1 1.5 9.375v-.75c0-1.036.84-1.875 1.875-1.875h3.193A3.375 3.375 0 0 1 12 2.753a3.375 3.375 0 0 1 5.432 3.997h3.193c1.035 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875H12.75v-4.5h1.875a1.875 1.875 0 1 0-1.875-1.875V6.75h-1.5V4.875C11.25 3.839 10.41 3 9.375 3ZM11.25 12.75H3v6.75a2.25 2.25 0 0 0 2.25 2.25h6v-9ZM12.75 12.75v9h6A2.25 2.25 0 0 0 21 19.5v-6.75h-8.25Z" />
        </svg>
      );
    case 2: // shield — deposit reduction
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
        </svg>
      );
    case 3: // coffee cup — local perk
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75h1.125a2.625 2.625 0 0 1 0 5.25H15.75M3.75 3.75h12v8.25a5.25 5.25 0 0 1-5.25 5.25H9a5.25 5.25 0 0 1-5.25-5.25V3.75ZM3.75 20.25h12.75" />
        </svg>
      );
    default:
      return null;
  }
}

/* Medal icons for leaderboard */
function MedalIcon({ rank }: { rank: number }) {
  const colors = ["text-[#d4a017]", "text-[#8f8f8f]", "text-[#b87333]"];
  if (rank > 2) return <span className="text-xs text-[#5b4038] font-bold w-5 text-center">{rank + 1}.</span>;
  return (
    <svg className={`w-4 h-4 ${colors[rank]}`} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 0 0-.584.859 6.753 6.753 0 0 0 6.138 5.6 6.73 6.73 0 0 0 2.743 1.346A6.707 6.707 0 0 1 9.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a.75.75 0 0 0 0 1.5h12.17a.75.75 0 0 0 0-1.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.707 6.707 0 0 1-1.112-3.173 6.73 6.73 0 0 0 2.743-1.347 6.753 6.753 0 0 0 6.139-5.6.75.75 0 0 0-.585-.858 47.077 47.077 0 0 0-3.07-.543V2.62a.75.75 0 0 0-.658-.744 49.22 49.22 0 0 0-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 0 0-.657.744Z" clipRule="evenodd" />
    </svg>
  );
}

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
      <div className="bg-white rounded-2xl p-6 animate-pulse border border-[#e6e2de]/30 shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
        <div className="h-4 bg-[#ebe7e4] rounded w-1/3 mb-4" />
        <div className="h-10 bg-[#ebe7e4] rounded w-1/2" />
      </div>
    );
  }

  if (!data) return null;

  const nextTier = SPEND_TIERS.find((t) => t.points > data.balance) ?? SPEND_TIERS[SPEND_TIERS.length - 1];
  const progressToNext = Math.min((data.balance / nextTier.points) * 100, 100);
  const nextTierIndex = SPEND_TIERS.indexOf(nextTier);

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#e6e2de]/30 shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
      {/* Header row: icon + label + balance + detail link */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-3">
          {/* Star icon */}
          <div className="w-10 h-10 bg-[#ae3200]/10 rounded-full flex items-center justify-center text-[#ae3200]">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
          </div>
          <div>
            <p className="text-[#5b4038] text-xs font-medium font-['Be_Vietnam_Pro']">Neighbor Points</p>
            <p className="text-3xl font-black text-[#1c1b1a] font-['Plus_Jakarta_Sans'] leading-none mt-0.5">
              {data.balance.toLocaleString()}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-[#ae3200] font-bold hover:underline font-['Plus_Jakarta_Sans'] mt-1"
        >
          {showDetails ? "Hide" : "Detail"}
        </button>
      </div>

      {/* Details panel — only visible when expanded */}
      {showDetails && (
        <div className="mt-5 space-y-5">
          {/* Progress to next tier */}
          <div>
            <div className="flex justify-between text-xs text-[#5b4038] mb-2 font-['Be_Vietnam_Pro']">
              <span className="flex items-center gap-1.5">
                Next: <TierIcon index={nextTierIndex} className="w-3.5 h-3.5 text-[#ae3200]" /> {nextTier.label}
              </span>
              <span>{Math.max(nextTier.points - data.balance, 0)} pts to go</span>
            </div>
            <div className="h-2.5 rounded-full bg-[#ebe7e4] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ae3200] to-[#ff5a1f] transition-all duration-500"
                style={{ width: `${progressToNext}%` }}
              />
            </div>
          </div>

          {/* Spend tiers — 4-column grid with SVG icons */}
          <div className="grid grid-cols-4 gap-2.5">
            {SPEND_TIERS.map((tier, i) => (
              <div
                key={tier.points}
                className={`text-center p-3 rounded-xl transition-colors ${
                  data.balance >= tier.points
                    ? "bg-[#ae3200]/10 text-[#ae3200]"
                    : "bg-[#f7f3ef] text-[#8f7067]"
                }`}
              >
                <div className="flex justify-center mb-1">
                  <TierIcon index={i} className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold font-['Plus_Jakarta_Sans']">{tier.points}</span>
              </div>
            ))}
          </div>

          {/* Recent history */}
          {data.history.length > 0 && (
            <div className="pt-4 border-t border-[#ebe7e4]">
              <h4 className="text-xs font-bold text-[#1c1b1a] mb-3 font-['Plus_Jakarta_Sans']">Recent Activity</h4>
              <div className="space-y-2">
                {data.history.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex justify-between items-center text-sm font-['Be_Vietnam_Pro']">
                    <span className="text-[#5b4038]">
                      {ACTION_LABELS[entry.action] ?? entry.description ?? entry.action}
                    </span>
                    <span className="font-bold text-[#ae3200]">
                      +{entry.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Building leaderboard */}
          {data.leaderboard.length > 0 && (
            <div className="pt-4 border-t border-[#ebe7e4]">
              <h4 className="text-xs font-bold text-[#1c1b1a] mb-3 font-['Plus_Jakarta_Sans']">Building Leaderboard</h4>
              <div className="space-y-2">
                {data.leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={entry.user_id} className="flex justify-between items-center text-sm font-['Be_Vietnam_Pro']">
                    <span className="flex items-center gap-2 text-[#5b4038]">
                      <MedalIcon rank={i} />
                      {entry.display_name ?? "Neighbor"}
                    </span>
                    <span className="font-bold text-[#ae3200]">
                      {entry.total_points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.history.length === 0 && data.leaderboard.length === 0 && (
            <p className="text-xs text-[#8f7067] text-center font-['Be_Vietnam_Pro'] pt-2">
              Start sharing to earn your first points!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
