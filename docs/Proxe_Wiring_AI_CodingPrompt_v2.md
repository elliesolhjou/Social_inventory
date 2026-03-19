## Coding Agent Prompt · March 20, 2026

You are an experience judge for damage property cases and wiring the dispute resolution system into Proxe's existing transaction flows AND building the AI damage comparison pipeline. The schema is migrated. The API routes and components are built and committed. Your job is to integrate them into the existing UI and build the Gemini comparison flow.

---

## CRITICAL CONTEXT

**Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + pgvector), Stripe (stripe@20.4.1, manual capture), Tailwind CSS v4, Gemini 2.5 Pro

**Project root:** `/Users/ellie/Projects/social-inventory`

**DB conventions:** `owner_id` (NOT lender_id), `state` column (enum), `approved` (NOT accepted), `deposit_cents` (NOT deposit_amount_cents). No `active` enum — use `picked_up`.

**Supabase:** Multi-FK joins fail client-side. Use no-join flat-fetch pattern.

**File naming:** Underscores not hyphens. Quotes around paths with brackets in `cp` commands.

**Stripe:** `session.payment_status` returns `'unpaid'` even after auth. Check PaymentIntent for `'requires_capture'`.

**Remove all `console.log` before committing.**

---

## STATE MACHINE

```
requested → pending → approved → deposit_held → picked_up → return_submitted → completed
                                                                ↓                  ↓
                                                             disputed ←──────── disputed
                                                                ↓
                                                             completed
```

**Owner confirms return** sets `inspection_deadline` (24hr) but does NOT change state. Transaction stays in `return_submitted`. Three outcomes:
- Owner taps "Item looks good — release deposit" → calls `/api/transactions/[id]/complete` → Stripe released → `completed`
- Owner taps "Report damage — hold deposit" → records V3 → Gemini compares → AI result shown → both accept or escalate
- Owner does nothing for 24hrs → cron auto-releases deposit → `completed`

---

## WHAT EXISTS (already committed — DO NOT recreate)

### API Routes (all at `src/app/api/`)
- `transactions/[id]/evidence/route.ts` — POST (upload V1/V2/V3 video) + GET (list evidence)
- `transactions/[id]/submit-return/route.ts` — POST (borrower submits return photos, state → return_submitted)
- `transactions/[id]/confirm-return/route.ts` — POST (owner confirms receipt, sets 24hr inspection_deadline)
- `transactions/[id]/complete/route.ts` — POST (owner says item is fine, cancels Stripe hold, state → completed, notifies both)
- `transactions/[id]/confirm-pickup/route.ts` — POST (dual pickup confirmation)
- `items/[id]/generate-checklist/route.ts` — POST (Gemini generates condition questions)
- `items/[id]/submit-checklist/route.ts` — POST (owner certifies answers)
- `disputes/file/route.ts` — POST (file dispute, requires V3)
- `disputes/[id]/route.ts` — GET (full dispute detail)
- `disputes/[id]/resolve/route.ts` — POST (resolve with Stripe capture/cancel)
- `disputes/transaction/[txId]/route.ts` — GET (dispute by transaction ID)
- `cron/auto-release/route.ts` — GET (cron: finds expired 24hr windows, cancels Stripe, completes, notifies)

### Components (all at `src/components/`)
- `transactions/VideoCapture.tsx` — Has `mode` prop ('upload'|'V1'|'V2'|'V3'), `onVideoBlob`, `onSkip`
- `disputes/DisputeFileForm.tsx` — Owner files dispute (reason picker, V3 gate)
- `disputes/DisputeEvidenceViewer.tsx` — Video player + frames grid + checklist
- `disputes/DisputeResolveForm.tsx` — Founder resolution form
- `disputes/DisputeStatusCard.tsx` — Dispute state badge
- `items/ConditionChecklist.tsx` — Generate/certify/read-only condition report

### Prompts (at `src/lib/prompts/`)
- `condition_checklist.ts` — Gemini prompt + `shouldPromptChecklist()` + `HIGH_RISK_CATEGORIES`
- `frame_extraction.ts` — Gemini frame identification + async pipeline

---

## PART A: WIRING (UI integration — no new routes)

### Task 1: Wire Owner's Return Decision UI

**This is the most important task. It closes the transaction loop.**

**Where:** When the owner opens a transaction in `return_submitted` state. Find where the owner sees the return notification — likely in:
- `src/components/messages/MessageBubble.tsx` (message type router)
- `src/app/inbox/page.tsx`
- Or wherever `return_submitted` / `inspection_pending` message types render

**What the owner sees after return is submitted:**

```
┌─────────────────────────────────────────────────────┐
│  🔍 [Item Name] has been returned                   │
│                                                     │
│  Borrower submitted return photos.                  │
│  You have 24 hours to inspect your item.            │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  ✅  Item looks good — release deposit      │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  ⚠️  Report damage — hold deposit           │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Deposit auto-releases in 23h 14m if no action.     │
└─────────────────────────────────────────────────────┘
```

**Button 1: "Item looks good — release deposit"**
- Calls `POST /api/transactions/[id]/complete`
- On success: show confirmation "Deposit released. Transaction complete!"
- Transaction moves to `completed`, both parties notified (handled by route)

**Button 2: "Report damage — hold deposit"**
- Opens V3 video capture flow: `<VideoCapture mode="V3" onVideoBlob={handleV3Upload} />`
- After V3 is recorded: triggers AI comparison (see Part B)
- V3 is REQUIRED before damage report can proceed

**Countdown timer:**
- Show time remaining until auto-release: `inspection_deadline - now`
- Use the `inspection_deadline` from the transaction
- After deadline passes, show "Inspection window closed — deposit released"

**Implementation:**
```tsx
// "Item looks good — release deposit"
const handleConfirmGood = async () => {
  const res = await fetch(`/api/transactions/${transactionId}/complete`, {
    method: "POST",
  });
  // handle success/error
};

// "Report damage — hold deposit"  
const handleReportDamage = () => {
  setShowV3Capture(true);
  // After V3 captured → trigger AI comparison → show results
};
```

### Task 2: Wire V1 into Pickup Flow (Optional)

**Where:** After both parties confirm pickup and state = `picked_up`.

**Add:** A card AFTER successful pickup confirmation:
```
"Protect yourself — record a quick video of the item before you take it."
[Record Quick Scan]     [Skip for now]
```

- V1 is OPTIONAL. Never block pickup.
- Import `VideoCapture` with `mode="V1"`
- On capture: upload to `/api/transactions/[id]/evidence` with `evidence_type: "V1"`

### Task 3: Wire V2 into Return Flow (Optional)

**Where:** The return submission screen where borrower submits return photos.

**Add:** A quiet text link at the bottom — NOT a banner:
```
Record handback (optional)
```

- V2 is OPTIONAL. Most borrowers will ignore it.
- `text-inventory-500 text-sm` styling — understated.

### Task 4: Wire ConditionChecklist into Item Detail

**Where:** `src/app/item/[id]/page.tsx`

- Owner sees: editable form (if not certified) or read-only (if certified)
- Borrower sees: read-only before borrowing
- Show below item photos/description

```tsx
import ConditionChecklist from "@/components/items/ConditionChecklist";
import { shouldPromptChecklist } from "@/lib/prompts/condition_checklist";

// Only show for high-risk categories, or if checklist already exists
{(item.condition_checklist_json || shouldPromptChecklist(item.category)) && (
  <ConditionChecklist
    itemId={item.id}
    checklist={item.condition_checklist_json}
    isOwner={currentUser?.id === item.owner_id}
    hasActiveBorrow={hasActiveBorrows}
    onChecklistUpdated={(updated) => /* refresh item state */}
  />
)}
```

### Task 5: Wire DisputeStatusCard into Transaction Views

**Where:** Profile page lending/borrowing tabs, anywhere a transaction renders.

```tsx
import DisputeStatusCard from "@/components/disputes/DisputeStatusCard";

{transaction.state === 'disputed' && (
  <DisputeStatusCard
    transactionId={transaction.id}
    role={currentUser.id === transaction.owner_id ? 'owner' : 'borrower'}
    depositCents={transaction.deposit_cents}
  />
)}
```

---

## PART B: AI DAMAGE COMPARISON PIPELINE

This is triggered when the owner taps "Report damage — hold deposit" and records a V3 inspection video.

### Flow:

```
Owner records V3 video
        ↓
Upload V3 to /api/transactions/[id]/evidence
        ↓
Extract frames from V3 (already built in frame_extraction.ts)
        ↓
Send listing photos + V3 frames to Gemini for comparison
        ↓
Gemini returns: { damage_detected: boolean, confidence: number, findings: [...] }
        ↓
Show AI result to BOTH parties
        ↓
Both accept → auto-resolve (release or capture deposit)
Either disputes AI result → escalate to founder for manual review
```

### Task 6: Build AI Comparison Prompt

**Create:** `src/lib/prompts/damage_comparison.ts`

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface DamageAssessment {
  damage_detected: boolean;
  confidence: number;           // 0-100
  summary: string;              // 1-2 sentence plain English
  findings: {
    component: string;          // "screen", "body", "accessories"
    issue: string;              // "scratch on left side"
    severity: "none" | "minor" | "moderate" | "severe";
  }[];
  recommendation: "release_deposit" | "capture_full" | "capture_partial" | "needs_human_review";
  recommended_capture_percent?: number;  // 0-100, only if capture_partial
}

export async function compareDamage(
  listingPhotoBase64s: string[],
  inspectionFrameBase64s: string[],
  itemName: string,
  conditionChecklist?: any
): Promise<DamageAssessment> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const checklistContext = conditionChecklist?.answers
    ? `\nOwner's condition certification at listing time:\n${JSON.stringify(conditionChecklist.answers)}`
    : "";

  const prompt = `You are a damage assessment AI for a peer-to-peer lending platform.

ITEM: "${itemName}"
${checklistContext}

TASK: Compare the LISTING photos (item at time of listing) with the INSPECTION photos (item after return from borrower). Identify any new damage, missing parts, or condition changes.

RULES:
- Only flag CLEAR, VISIBLE differences between listing and inspection photos.
- Normal wear (minor scuffs, dust) is NOT damage.
- If you cannot clearly see damage or the photos are ambiguous, set confidence below 70 and recommend needs_human_review.
- Be specific about WHAT changed and WHERE on the item.

Respond ONLY in JSON, no markdown, no backticks:
{
  "damage_detected": boolean,
  "confidence": number (0-100),
  "summary": "string",
  "findings": [{"component": "string", "issue": "string", "severity": "none|minor|moderate|severe"}],
  "recommendation": "release_deposit|capture_full|capture_partial|needs_human_review",
  "recommended_capture_percent": number or null
}`;

  const listingParts = listingPhotoBase64s.map((b64) => ({
    inlineData: { mimeType: "image/jpeg" as const, data: b64 },
  }));

  const inspectionParts = inspectionFrameBase64s.map((b64) => ({
    inlineData: { mimeType: "image/jpeg" as const, data: b64 },
  }));

  const result = await model.generateContent([
    "LISTING PHOTOS (item when first listed):",
    ...listingParts,
    "INSPECTION PHOTOS (item after return from borrower):",
    ...inspectionParts,
    prompt,
  ]);

  const text = result.response.text().trim();
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}
```

### Task 7: Build AI Comparison API Route

**Create:** `src/app/api/transactions/[id]/compare-damage/route.ts`

This route:
1. Fetches listing photos from the item's `media_urls`
2. Fetches V3 evidence frames from `transaction_evidence`
3. Calls `compareDamage()` from the prompt file
4. Stores result in `transaction_evidence.ai_damage_report` on the V3 row
5. Returns the assessment to the client

```
POST /api/transactions/[id]/compare-damage
Auth: owner only
Requires: V3 evidence must exist
Returns: { assessment: DamageAssessment }
```

### Task 8: Build AIDamageResult Component

**Create:** `src/components/disputes/AIDamageResult.tsx`

Shows the Gemini assessment to both parties. Two states:

**State 1 — Awaiting acceptance:**
```
┌─────────────────────────────────────────────────────┐
│  🤖 AI Damage Assessment                           │
│                                                     │
│  "No significant damage detected. Minor scuff on    │
│   bottom corner consistent with normal use."        │
│                                                     │
│  Confidence: 92%                                    │
│  Recommendation: Release deposit                    │
│                                                     │
│  Findings:                                          │
│  • Body: minor scuff on bottom — severity: minor    │
│  • Screen: no damage — severity: none               │
│                                                     │
│  ┌───────────────────────────────────────────┐      │
│  │  ✅  Accept AI assessment                 │      │
│  └───────────────────────────────────────────┘      │
│  ┌───────────────────────────────────────────┐      │
│  │  🙋  I disagree — request human review    │      │
│  └───────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Shown to BOTH owner and borrower
- If BOTH tap "Accept AI assessment":
  - If recommendation = `release_deposit` → call `POST /api/transactions/[id]/complete` → deposit released
  - If recommendation = `capture_full` or `capture_partial` → auto-file dispute with AI assessment, auto-resolve in owner's favor with recommended capture amount
- If EITHER taps "I disagree — request human review":
  - File dispute with `description: "AI assessment disputed by [role]"`
  - State stays `disputed`, founder gets notified for manual review
  - Show DisputeStatusCard with "Under manual review"

**Track acceptance:**
- Add `ai_acceptance` JSONB column to disputes table (or use the existing `fraud_flags` field temporarily):
  ```json
  { "owner_accepted": true, "borrower_accepted": false }
  ```
- Or simpler: use messages with a new `message_type: "ai_assessment"` that includes accept/reject payload

### Task 9: Wire the Full Damage Report Flow

When owner taps "Report damage — hold deposit":

```
1. Show VideoCapture mode="V3"
2. On video captured → upload to /api/transactions/[id]/evidence (evidence_type: "V3")
3. Immediately call POST /api/transactions/[id]/compare-damage
4. Show loading: "AI is analyzing your inspection..."
5. Show AIDamageResult with Gemini's assessment
6. Owner taps "Accept" or "Disagree"
7. Send AI result + acceptance status to borrower via message
8. Borrower sees AIDamageResult in their inbox
9. Borrower taps "Accept" or "Disagree"
10. If both accept → auto-resolve
11. If either disagrees → escalate to founder
```

---

## VIDEO UPLOAD HELPER

Every place that uses VideoCapture for evidence needs this pattern:

```tsx
const handleVideoBlob = async (blob: Blob) => {
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = (reader.result as string).split(",")[1];
    await fetch(`/api/transactions/${transactionId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evidence_type: "V3", // or "V1" or "V2"
        video_base64: base64,
        duration_seconds: 10,
      }),
    });
  };
  reader.readAsDataURL(blob);
};
```

---

## IMPLEMENTATION ORDER (one commit per step)

1. Owner return decision UI — two buttons + countdown timer (MOST IMPORTANT)
2. AI comparison prompt (`damage_comparison.ts`)
3. AI comparison API route (`compare-damage/route.ts`)
4. AIDamageResult component
5. Wire damage report flow (V3 → compare → show result → accept/escalate)
6. V1 into pickup flow (optional, quick)
7. V2 into return flow (optional, quick)
8. ConditionChecklist into item detail page
9. DisputeStatusCard into transaction views

---

## HARD RULES

- "Item looks good — release deposit" and "Report damage — hold deposit" are the EXACT button labels. Do not change them.
- V1 and V2 are OPTIONAL. NEVER block a transaction because the user skipped.
- V3 is REQUIRED before AI comparison or dispute filing.
- 24-hour inspection window (not 48).
- AI comparison is the FIRST step when owner reports damage. Manual review is the FALLBACK when either party disagrees.
- `ai_damage_report` column on `transaction_evidence` stores the Gemini result on the V3 row.
- Remove all `console.log` before committing.
- `owner_id` not `lender_id`, `state` not `status`, `deposit_cents` not `deposit_amount_cents`.
- No-join flat-fetch pattern for multi-FK queries.
- File naming: underscores not hyphens.
