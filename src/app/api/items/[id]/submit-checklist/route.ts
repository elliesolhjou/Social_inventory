import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
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

  const body = await request.json();
  const { answers } = body;

  if (!answers || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "answers must be an array of {id, answer, note?}" },
      { status: 400 }
    );
  }

  // Fetch item
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, owner_id, condition_checklist_json")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (item.owner_id !== user.id) {
    return NextResponse.json({ error: "Only the owner can certify" }, { status: 403 });
  }

  const checklist = item.condition_checklist_json;
  if (!checklist || !checklist.questions) {
    return NextResponse.json(
      { error: "No checklist generated. Call generate-checklist first." },
      { status: 400 }
    );
  }
  if (checklist.certified_at) {
    return NextResponse.json(
      { error: "Checklist already certified and locked." },
      { status: 409 }
    );
  }

  // Validate all questions are answered
  const questionIds = new Set(checklist.questions.map((q: { id: string }) => q.id));
  for (const a of answers) {
    if (!questionIds.has(a.id)) {
      return NextResponse.json(
        { error: `Unknown question id: ${a.id}` },
        { status: 400 }
      );
    }
  }

  const updatedChecklist = {
    ...checklist,
    answers,
    certified_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("items")
    .update({ condition_checklist_json: updatedChecklist })
    .eq("id", itemId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save certification", detail: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, checklist: updatedChecklist });
}
