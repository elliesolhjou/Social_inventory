import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ChecklistQuestion {
  id: string;
  question: string;
  component: string;
}

/** Categories that trigger automatic checklist prompting */
export const HIGH_RISK_CATEGORIES = [
  "electronics",
  "power tools",
  "kitchen appliances",
  "sporting goods",
  "musical instruments",
  "camera equipment",
  "audio equipment",
];

export function shouldPromptChecklist(category: string): boolean {
  const normalized = category.toLowerCase().trim();
  return HIGH_RISK_CATEGORIES.some(
    (c) => normalized.includes(c) || c.includes(normalized)
  );
}

export async function generateConditionChecklist(
  itemName: string,
  category: string
): Promise<ChecklistQuestion[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const prompt = `You identified this item as a "${itemName}" in the "${category}" category.
Generate a condition checklist with 4-8 yes/no questions specific to this item type.
Each question should cover a distinct physical component or functional aspect that could be damaged during lending.
Include a final question for accessories/included items.
Respond ONLY in JSON array format, no markdown, no backticks, no explanation:
[{"id": "string", "question": "string", "component": "string"}]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown fences if present
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Gemini returned invalid checklist format");
  }

  return parsed.map((q: { id?: string; question: string; component: string }, i: number) => ({
    id: q.id || `q${i}`,
    question: q.question,
    component: q.component,
  }));
}
