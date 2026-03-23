import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/points
 *
 * Returns the logged-in user's points balance and recent history.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Use service role for RPC calls
    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return []; }, setAll() {} } }
    );

    // Get balance
    const { data: balance } = await serviceSupabase.rpc("get_points_balance", {
      p_user_id: user.id,
    });

    // Get recent history (last 20 entries)
    const { data: history } = await serviceSupabase
      .from("points_ledger")
      .select("id, action, points, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get building leaderboard
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("building_id")
      .eq("id", user.id)
      .single();

    let leaderboard: any[] = [];
    if (profile?.building_id) {
      const { data: lb } = await serviceSupabase
        .from("points_leaderboard")
        .select("*")
        .eq("building_id", profile.building_id)
        .limit(10);
      leaderboard = lb ?? [];
    }

    return NextResponse.json({
      balance: balance ?? 0,
      history: history ?? [],
      leaderboard,
    });
  } catch (error: any) {
    console.error("Points API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch points" },
      { status: 500 }
    );
  }
}
