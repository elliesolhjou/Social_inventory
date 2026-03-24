import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .single();

  // Check if user already has a Stripe Connect account
  const { data: existingMethod } = await supabase
    .from("payout_methods")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .eq("method", "stripe_connect")
    .single();

  let accountId = existingMethod?.stripe_account_id;

  if (!accountId) {
    // Create a new Express Connect account
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: profile?.email ?? user.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: {
        proxe_user_id: user.id,
      },
    });

    accountId = account.id;

    // Save to payout_methods
    const { count } = await supabase
      .from("payout_methods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    await supabase
      .from("payout_methods")
      .insert({
        user_id: user.id,
        method: "stripe_connect",
        handle: "stripe_connect",
        stripe_account_id: accountId,
        is_default: (count ?? 0) === 0,
        verified: false,
      });
  }

  // Create Account Link for onboarding
  const origin = req.headers.get("origin") || "http://localhost:3000";

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/payouts?refresh=true`,
    return_url: `${origin}/payouts?stripe_connected=true`,
    type: "account_onboarding",
  });

  return NextResponse.json({
    url: accountLink.url,
    account_id: accountId,
  });
}
