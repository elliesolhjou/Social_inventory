import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateTextEmbedding } from "@/lib/embeddings";

/**
 * POST /api/search/semantic
 *
 * Semantic text search — resident types a natural language query,
 * Miles finds matching items using text embeddings + pgvector.
 *
 * "something to clean my floors" → matches "Dyson V11 Cordless Vacuum"
 * "camping gear" → matches "REI Tent", "Sleeping Bag", "Camp Stove"
 *
 * Uses the same embedding model + pgvector index as visual search.
 * Both text and image descriptions live in the same 768-dim vector space.
 *
 * Patent alignment: Extends Claim 3 (Fig. 5) — same pipeline, text input instead of image.
 *
 * Body: { query: string }
 */

// Composite ranking weights (same as visual search)
const W_SIMILARITY = 0.60;
const W_TRUST = 0.25;
const W_RECENCY = 0.15;
const DEFAULT_TRUST = 4.0;
const MAX_TRUST = 5.0;
const RECENCY_WINDOW_DAYS = 90;

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "No query provided. Send { query: string }" },
        { status: 400 }
      );
    }

    // Auth — get user's building_id
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's building_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("building_id")
      .eq("id", user.id)
      .single();

    if (!profile?.building_id) {
      return NextResponse.json(
        { error: "No building associated with your profile" },
        { status: 400 }
      );
    }

    // Generate text embedding (same vector space as item image embeddings)
    const queryEmbedding = await generateTextEmbedding(query.trim());

    // pgvector cosine similarity search (reuses same RPC as visual search)
    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return []; },
          setAll() {},
        },
      }
    );

    const { data: searchResults, error: searchError } = await serviceSupabase.rpc(
      "search_items_by_image",
      {
        query_embedding: JSON.stringify(queryEmbedding),
        search_building_id: profile.building_id,
        filter_category: null,
        match_threshold: 0.5,
        match_count: 12,
      }
    );

    if (searchError) {
      console.error("Semantic search error:", searchError);
      return NextResponse.json(
        { error: "Search failed: " + searchError.message },
        { status: 500 }
      );
    }

    if (!searchResults || searchResults.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        query: query.trim(),
      });
    }

    // Composite ranking (same as visual search)
    const ownerIds = [...new Set(searchResults.map((r: any) => r.owner_id))];
    const { data: ownerProfiles } = await serviceSupabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ownerIds);

    const profileMap = new Map(
      (ownerProfiles ?? []).map((p: any) => [p.id, p])
    );

    const now = Date.now();
    const ranked = searchResults
      .map((item: any) => {
        const daysSinceListed =
          (now - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 1 - daysSinceListed / RECENCY_WINDOW_DAYS);
        const trustScore = DEFAULT_TRUST / MAX_TRUST;

        const compositeScore =
          W_SIMILARITY * item.similarity +
          W_TRUST * trustScore +
          W_RECENCY * recencyScore;

        const owner = profileMap.get(item.owner_id);

        return {
          id: item.id,
          title: item.title,
          thumbnail_url: item.thumbnail_url,
          category: item.category,
          ai_condition: item.ai_condition,
          deposit_cents: item.deposit_cents,
          similarity: Math.round(item.similarity * 100) / 100,
          composite_score: Math.round(compositeScore * 1000) / 1000,
          owner: {
            id: item.owner_id,
            name: owner?.display_name ?? "A neighbor",
            avatar_url: owner?.avatar_url ?? null,
          },
        };
      })
      .sort((a: any, b: any) => b.composite_score - a.composite_score);

    return NextResponse.json({
      success: true,
      results: ranked,
      query: query.trim(),
    });
  } catch (error: any) {
    console.error("Semantic search error:", error);
    return NextResponse.json(
      { error: error.message || "Semantic search failed" },
      { status: 500 }
    );
  }
}
