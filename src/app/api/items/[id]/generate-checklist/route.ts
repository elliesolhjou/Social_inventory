import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateConditionChecklist } from "@/lib/prompts/condition_checklist";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: itemId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch item — must be the owner
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, owner_id, title, category, ai_category, condition_checklist_json")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (item.owner_id !== user.id) {
    return NextResponse.json({ error: "Only the owner can generate a checklist" }, { status: 403 });
  }

  // Don't regenerate if already certified
  if (item.condition_checklist_json?.certified_at) {
    return NextResponse.json(
      { error: "Checklist already certified. Cannot regenerate." },
      { status: 409 }
    );
  }

  const category = item.ai_category || item.category || "general";
  const itemName = item.title || "item";

  try {
    const questions = await generateConditionChecklist(itemName, category);

    const checklistData = {
      generated_at: new Date().toISOString(),
      checklist_version: "1.0",
      questions,
      answers: null,
      certified_at: null,
    };

    const { error: updateError } = await supabase
      .from("items")
      .update({ condition_checklist_json: checklistData })
      .eq("id", itemId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save checklist", detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, checklist: checklistData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Checklist generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
