/**
 * AI Damage Comparison Prompt — Proxe Damage Verification Pipeline
 * Patent Claims 3 + 4: AI Damage Verification Pipeline + Dark Inventory Activation
 *
 * This prompt is sent to Gemini 2.5 Pro along with before/after images.
 * The VisionAgent compares pre-lending vs post-return photos and returns
 * a structured damage assessment with confidence score.
 *
 * Adaptive thresholds (Step 404) inject category-specific normal wear
 * descriptions so the AI knows what to ignore per item type.
 */

export interface DamageAssessment {
  damage_detected: boolean;
  confidence: number;
  summary: string;
  findings: {
    component: string;
    issue: string;
    severity: "none" | "minor" | "moderate" | "severe";
  }[];
  recommendation:
    | "release_deposit"
    | "capture_full"
    | "capture_partial"
    | "needs_human_review";
  recommended_capture_percent: number | null;
}

interface PromptParams {
  itemTitle: string;
  category: string;
  normalWearDescription: string;
  taskDescription: string;
  checklistContext?: string;
  deviceMetadataContext?: string;
}

/**
 * Build the damage comparison prompt for Gemini.
 *
 * The prompt follows Patent Fig. 4, Steps 403-404:
 * - Step 403: VisionAgent compares images, generates confidence score
 * - Step 404: Adaptive threshold injects category-specific rules
 */
export function buildDamageComparisonPrompt(params: PromptParams): string {
  const {
    itemTitle,
    category,
    normalWearDescription,
    taskDescription,
    checklistContext = "",
    deviceMetadataContext = "",
  } = params;

  return `You are a damage assessment AI for Proxe, a peer-to-peer lending platform. You are an experienced judge for damage property cases. Your assessment will be shown to both the item owner and the borrower, and may be used to determine whether a deposit is released or captured.

ITEM: "${itemTitle}"
CATEGORY: ${category}
${checklistContext}
${deviceMetadataContext}

TASK: ${taskDescription}

ASSESSMENT FRAMEWORK:
1. First, identify the item in both sets of photos. If the item is not clearly visible, note this and lower confidence.
2. Compare each visible surface, component, and accessory between before and after.
3. For each difference found, classify severity:
   - none: No change detected
   - minor: Cosmetic only, does not affect function or value
   - moderate: Visible damage that affects appearance or minor function
   - severe: Structural damage, missing parts, or significant functional impact

CATEGORY-SPECIFIC RULES:
- For ${category}, normal wear includes: "${normalWearDescription}"
- Do NOT flag normal wear as damage. This is critical for fairness.

GENERAL RULES:
- Only flag CLEAR, VISIBLE differences or damage.
- If you cannot clearly see damage or the photos are ambiguous, set confidence below 70 and recommend needs_human_review.
- Be specific about WHAT changed and WHERE on the item.
- Be fair to both parties — the borrower should not be penalized for normal use, and the owner should be compensated for genuine damage.
- If only one set of photos is available, assess what you can see but lower your confidence significantly.
- Consider photo quality, lighting, and angle differences before concluding damage exists.

DEVICE METADATA VALIDATION:
- If device metadata is provided, check for timestamp consistency (photos should be taken within the transaction window).
- Flag if timestamps appear manipulated or inconsistent.

Respond ONLY in JSON, no markdown, no backticks:
{
  "damage_detected": boolean,
  "confidence": number (0-100),
  "summary": "1-2 sentence plain English summary accessible to both parties",
  "findings": [{"component": "string", "issue": "string", "severity": "none|minor|moderate|severe"}],
  "recommendation": "release_deposit|capture_full|capture_partial|needs_human_review",
  "recommended_capture_percent": number or null
}`;
}

/**
 * Build the task description based on what images are available.
 */
export function buildTaskDescription(
  comparisonMode: "full" | "after_only" | "before_only",
  sourceLabel: string
): string {
  if (comparisonMode === "full") {
    return `Compare the BEFORE photos (${sourceLabel}) with the AFTER photos (item after return from borrower). Identify any new damage, missing parts, or condition changes that occurred during the borrowing period.`;
  }
  if (comparisonMode === "after_only") {
    return `Assess the condition of the item in these AFTER photos (item after return from borrower). No before photos are available for comparison. Look for any visible damage, wear, or issues. Note that without before photos, confidence should be significantly lower as you cannot determine what is new damage vs pre-existing condition.`;
  }
  return `These are BEFORE photos of the item. No after photos are available yet. Document the current condition as a baseline for future comparison.`;
}

/**
 * Build context string from device metadata for prompt injection.
 */
export function buildDeviceMetadataContext(
  beforeMetadata?: Record<string, unknown>[] | null,
  afterMetadata?: Record<string, unknown>[] | null
): string {
  if (!beforeMetadata?.length && !afterMetadata?.length) return "";

  const lines: string[] = ["\nDEVICE METADATA:"];

  if (beforeMetadata?.length) {
    const m = beforeMetadata[0];
    lines.push(
      `Before photos — captured: ${m.captured_at ?? "unknown"}, device: ${m.platform ?? "unknown"}, timezone: ${m.timezone ?? "unknown"}`
    );
  }

  if (afterMetadata?.length) {
    const m = afterMetadata[0];
    lines.push(
      `After photos — captured: ${m.captured_at ?? "unknown"}, device: ${m.platform ?? "unknown"}, timezone: ${m.timezone ?? "unknown"}`
    );
  }

  return lines.join("\n");
}
