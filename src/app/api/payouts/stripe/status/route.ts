import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: method } = await supabase
    .from("payout_methods")
    .select("id, stripe_account_id, verified")
    .eq("user_id", user.id)
    .eq("method", "stripe_connect")
    .single();

  if (!method?.stripe_account_id) {
    return NextResponse.json({ connected: false });
  }

  // Check if onboarding is complete
  const account = await stripe.accounts.retrieve(method.stripe_account_id);

  const isReady = account.charges_enabled && account.payouts_enabled;

  // Update verified status if changed
  if (isReady && !method.verified) {
    await supabase
      .from("payout_methods")
      .update({ verified: true, updated_at: new Date().toISOString() })
      .eq("id", method.id);
  }

  return NextResponse.json({
    connected: true,
    verified: isReady,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    account_id: method.stripe_account_id,
  });
}
