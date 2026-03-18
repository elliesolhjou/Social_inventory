import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recipient_id, content, message_type, topic, payload } = body;

  if (!recipient_id || !content) {
    return NextResponse.json(
      { error: "recipient_id and content are required" },
      { status: 400 }
    );
  }

  const { data: msg, error } = await supabase
    .from("messages")
    .insert({
      sender_id: user.id,
      recipient_id,
      content,
      message_type: message_type ?? "direct",
      topic: topic ?? null,
      payload: payload ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error("Message send failed:", error);
    return NextResponse.json(
      { error: "Failed to send message", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: msg });
}
