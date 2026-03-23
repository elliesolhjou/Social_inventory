import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/impact
 *
 * Returns sustainable living impact metrics for the user and their building.
 * Waste avoided = completed borrows × category weight × manufacturing multiplier
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

    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return []; }, setAll() {} } }
    );

    // Get user's building
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("building_id")
      .eq("id", user.id)
      .single();

    // User impact
    const { data: userImpact } = await serviceSupabase.rpc("get_user_impact", {
      p_user_id: user.id,
    });

    // Building impact
    let buildingImpact = null;
    if (profile?.building_id) {
      const { data: bi } = await serviceSupabase.rpc("get_building_impact", {
        p_building_id: profile.building_id,
      });
      buildingImpact = bi?.[0] ?? bi ?? null;
    }

    // Format for display
    const userStats = Array.isArray(userImpact) ? userImpact[0] : userImpact;

    return NextResponse.json({
      user: {
        borrows_completed: userStats?.borrows_completed ?? 0,
        lends_completed: userStats?.lends_completed ?? 0,
        waste_avoided_kg: Math.round((userStats?.waste_avoided_kg ?? 0) * 10) / 10,
        co2_avoided_kg: Math.round((userStats?.co2_avoided_kg ?? 0) * 10) / 10,
      },
      building: buildingImpact
        ? {
            total_borrows: buildingImpact.total_borrows ?? 0,
            waste_avoided_kg: Math.round((buildingImpact.waste_avoided_kg ?? 0) * 10) / 10,
            co2_avoided_kg: Math.round((buildingImpact.co2_avoided_kg ?? 0) * 10) / 10,
            unique_items_shared: buildingImpact.unique_items_shared ?? 0,
            active_sharers: buildingImpact.active_sharers ?? 0,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Impact API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch impact" },
      { status: 500 }
    );
  }
}
