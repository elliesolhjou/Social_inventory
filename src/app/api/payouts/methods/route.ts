import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET - list user's payout methods
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: methods } = await supabase
    .from("payout_methods")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false });

  return NextResponse.json({ methods: methods ?? [] });
}

// POST - add a payout method
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { method, handle } = await req.json();

  if (!method || !["paypal", "venmo", "zelle", "stripe_connect"].includes(method)) {
    return NextResponse.json({ error: "Invalid payout method" }, { status: 400 });
  }

  if (method !== "stripe_connect" && !handle) {
    return NextResponse.json({ error: "Handle/email is required" }, { status: 400 });
  }

  // Check if method already exists
  const { data: existing } = await supabase
    .from("payout_methods")
    .select("id")
    .eq("user_id", user.id)
    .eq("method", method)
    .single();

  if (existing) {
    // Update existing
    const { data: updated, error } = await supabase
      .from("payout_methods")
      .update({
        handle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ method: updated });
  }

  // Check if this is the first method — make it default
  const { count } = await supabase
    .from("payout_methods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const isFirst = (count ?? 0) === 0;

  const { data: newMethod, error } = await supabase
    .from("payout_methods")
    .insert({
      user_id: user.id,
      method,
      handle,
      is_default: isFirst,
      verified: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ method: newMethod });
}

// DELETE - remove a payout method
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();

  const { error } = await supabase
    .from("payout_methods")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
