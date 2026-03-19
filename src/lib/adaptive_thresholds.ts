/**
 * Adaptive Threshold System for AI Damage Verification
 * Patent Step 404: Level 1 = Category threshold, Level 2 = Condition calibration
 *
 * Different item categories have different damage tolerance levels.
 * Electronics are strict (small scratches matter). Household items are lenient
 * (minor wear is expected). The condition at listing time further calibrates:
 * a "like new" item has tighter thresholds than a "well used" one.
 */

export interface ThresholdConfig {
  /** Category display name */
  category: string;
  /** Minimum AI confidence to auto-resolve (below this → needs_human_review) */
  auto_resolve_confidence: number;
  /** Below this confidence, always escalate to human */
  human_review_threshold: number;
  /** Severity levels that trigger deposit capture for this category */
  capture_severities: ("minor" | "moderate" | "severe")[];
  /** Description of what counts as "normal wear" for this category */
  normal_wear_description: string;
}

/**
 * Level 1: Category-based thresholds
 */
const CATEGORY_THRESHOLDS: Record<string, ThresholdConfig> = {
  // Strict categories — small damage matters
  electronics: {
    category: "Electronics",
    auto_resolve_confidence: 85,
    human_review_threshold: 60,
    capture_severities: ["moderate", "severe"],
    normal_wear_description: "Minor fingerprints, light dust, faint surface marks from normal handling",
  },
  camera_equipment: {
    category: "Camera Equipment",
    auto_resolve_confidence: 90,
    human_review_threshold: 65,
    capture_severities: ["moderate", "severe"],
    normal_wear_description: "Light body wear, minor cosmetic marks that don't affect lens or sensor",
  },
  musical_instruments: {
    category: "Musical Instruments",
    auto_resolve_confidence: 85,
    human_review_threshold: 60,
    capture_severities: ["moderate", "severe"],
    normal_wear_description: "Light pick marks on guitars, minor surface wear from playing",
  },
  audio_equipment: {
    category: "Audio Equipment",
    auto_resolve_confidence: 85,
    human_review_threshold: 60,
    capture_severities: ["moderate", "severe"],
    normal_wear_description: "Light cable wear, minor cosmetic marks on headband or ear cups",
  },

  // Medium categories — moderate tolerance
  power_tools: {
    category: "Power Tools",
    auto_resolve_confidence: 75,
    human_review_threshold: 50,
    capture_severities: ["moderate", "severe"],
    normal_wear_description: "Surface scratches on housing, dust accumulation, minor grip wear",
  },
  sporting_goods: {
    category: "Sporting Goods",
    auto_resolve_confidence: 75,
    human_review_threshold: 50,
    capture_severities: ["moderate", "severe"],
    normal_wear_description: "Scuff marks, dirt, minor wear from intended athletic use",
  },
  kitchen_appliances: {
    category: "Kitchen Appliances",
    auto_resolve_confidence: 75,
    human_review_threshold: 50,
    capture_severities: ["moderate", "severe"],
    normal_wear_description: "Light food residue (cleaned), minor surface marks, slight discoloration from heat",
  },
  luggage: {
    category: "Luggage",
    auto_resolve_confidence: 70,
    human_review_threshold: 45,
    capture_severities: ["severe"],
    normal_wear_description: "Scuffs, minor zipper marks, surface dirt from travel — all expected",
  },

  // Lenient categories — high tolerance for wear
  household: {
    category: "Household",
    auto_resolve_confidence: 65,
    human_review_threshold: 40,
    capture_severities: ["severe"],
    normal_wear_description: "General wear from normal household use, minor marks, light stains",
  },
  furniture: {
    category: "Furniture",
    auto_resolve_confidence: 65,
    human_review_threshold: 40,
    capture_severities: ["severe"],
    normal_wear_description: "Minor surface marks, light pressure marks, dust accumulation",
  },
  clothing: {
    category: "Clothing",
    auto_resolve_confidence: 70,
    human_review_threshold: 45,
    capture_severities: ["moderate", "severe"],
    normal_wear_description: "Light wrinkles, minor pilling from one wear",
  },
  books: {
    category: "Books",
    auto_resolve_confidence: 60,
    human_review_threshold: 35,
    capture_severities: ["severe"],
    normal_wear_description: "Slight spine crease from reading, minor corner wear, fingerprints",
  },
  games: {
    category: "Games & Toys",
    auto_resolve_confidence: 65,
    human_review_threshold: 40,
    capture_severities: ["severe"],
    normal_wear_description: "Minor box wear, light surface marks from handling during play",
  },
};

/** Default threshold for categories not explicitly listed */
const DEFAULT_THRESHOLD: ThresholdConfig = {
  category: "General",
  auto_resolve_confidence: 75,
  human_review_threshold: 50,
  capture_severities: ["moderate", "severe"],
  normal_wear_description: "Minor surface wear consistent with careful single use",
};

/**
 * Level 2: Condition calibration adjustments
 * Adjusts thresholds based on item's condition at listing time.
 * "Like new" items have tighter thresholds. "Well used" items are more lenient.
 */
const CONDITION_ADJUSTMENTS: Record<string, number> = {
  like_new: 10,       // +10 to confidence thresholds (stricter)
  good: 0,            // baseline
  fair: -10,          // -10 (more lenient)
  well_used: -20,     // -20 (most lenient)
};

/**
 * Get the adaptive threshold config for an item based on category + condition.
 * Patent Step 404: Level 1 (Category) → Level 2 (Condition calibration)
 */
export function getAdaptiveThreshold(
  category: string,
  condition?: string | null
): ThresholdConfig & { condition_adjustment: number; effective_auto_resolve: number } {
  // Level 1: Category lookup
  const normalized = category.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  const baseThreshold = CATEGORY_THRESHOLDS[normalized] ?? DEFAULT_THRESHOLD;

  // Level 2: Condition calibration
  const condNormalized = (condition ?? "good").toLowerCase().replace(/\s+/g, "_");
  const adjustment = CONDITION_ADJUSTMENTS[condNormalized] ?? 0;

  return {
    ...baseThreshold,
    condition_adjustment: adjustment,
    effective_auto_resolve: Math.min(
      Math.max(baseThreshold.auto_resolve_confidence + adjustment, 30),
      98
    ),
  };
}

/**
 * Apply adaptive threshold to an AI damage assessment.
 * Returns the final recommendation after threshold calibration.
 */
export function applyAdaptiveThreshold(
  assessment: {
    damage_detected: boolean;
    confidence: number;
    findings: { severity: string }[];
    recommendation: string;
  },
  category: string,
  condition?: string | null
): {
  original_recommendation: string;
  final_recommendation: string;
  threshold_applied: ThresholdConfig & { condition_adjustment: number; effective_auto_resolve: number };
  auto_resolved: boolean;
  reason: string;
} {
  const threshold = getAdaptiveThreshold(category, condition);

  // If AI confidence is below human review threshold → always escalate
  if (assessment.confidence < threshold.human_review_threshold) {
    return {
      original_recommendation: assessment.recommendation,
      final_recommendation: "needs_human_review",
      threshold_applied: threshold,
      auto_resolved: false,
      reason: `Confidence ${assessment.confidence}% is below human review threshold ${threshold.human_review_threshold}% for ${threshold.category}`,
    };
  }

  // If no damage detected and confidence above auto-resolve → release
  if (!assessment.damage_detected && assessment.confidence >= threshold.effective_auto_resolve) {
    return {
      original_recommendation: assessment.recommendation,
      final_recommendation: "release_deposit",
      threshold_applied: threshold,
      auto_resolved: true,
      reason: `No damage detected with ${assessment.confidence}% confidence (threshold: ${threshold.effective_auto_resolve}% for ${threshold.category})`,
    };
  }

  // If damage detected, check severities against category rules
  if (assessment.damage_detected) {
    const hasCapturable = assessment.findings.some((f) =>
      threshold.capture_severities.includes(f.severity as "minor" | "moderate" | "severe")
    );

    if (hasCapturable && assessment.confidence >= threshold.effective_auto_resolve) {
      return {
        original_recommendation: assessment.recommendation,
        final_recommendation: assessment.recommendation === "capture_partial" ? "capture_partial" : "capture_full",
        threshold_applied: threshold,
        auto_resolved: true,
        reason: `Damage with capturable severity detected at ${assessment.confidence}% confidence for ${threshold.category}`,
      };
    }

    // Damage detected but only minor (below capture threshold for this category)
    if (!hasCapturable) {
      return {
        original_recommendation: assessment.recommendation,
        final_recommendation: "release_deposit",
        threshold_applied: threshold,
        auto_resolved: true,
        reason: `Only minor damage detected — within normal wear tolerance for ${threshold.category}: "${threshold.normal_wear_description}"`,
      };
    }
  }

  // Default: not confident enough to auto-resolve
  return {
    original_recommendation: assessment.recommendation,
    final_recommendation: "needs_human_review",
    threshold_applied: threshold,
    auto_resolved: false,
    reason: `Confidence ${assessment.confidence}% below auto-resolve threshold ${threshold.effective_auto_resolve}% for ${threshold.category}`,
  };
}
