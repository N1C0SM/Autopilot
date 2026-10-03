import { syncStripeEntitlement } from "../_shared/sync-entitlement.ts";
import { loadPlanPrices } from "../_shared/stripe-plan-prices.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { hasCoaching, resolvePaidTier, subscriptionAllowsCoaching } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ subscribed: false, tier: "free", reason: "no_session" });
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user?.email) return json({ subscribed: false, tier: "free", reason: "no_session" });
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("payment_status, subscription_tier, subscription_status, subscription_end, stripe_payment_id, stripe_customer_id, plan_status")
      .eq("user_id", user.id).single();
    if (profileError) throw profileError;
    const { data: settings, error: settingsError } = await db.from("settings").select("*").limit(1).single();
    if (settingsError) throw settingsError;
    const mode = settings.payment_mode === "live" ? "live" : "test";
    const key = Deno.env.get(mode === "live" ? "STRIPE_LIVE_SECRET_KEY" : "STRIPE_TEST_SECRET_KEY");
    if (!key) throw new Error("Payment service is not configured");
    const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
    const prices = await loadPlanPrices(stripe, settings, mode);
    // Prefer the customer bound to the account. Do not select an arbitrary matching email.
    const customers = profile.stripe_customer_id
      ? [profile.stripe_customer_id]
      : (await stripe.customers.list({ email: user.email, limit: 100 })).data.map(c => c.id);
    let chosen: { sub: Stripe.Subscription; tier: string; customerId: string } | null = null;
    for (const customerId of customers) {
      for await (const sub of stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 })) {
        const tier = resolvePaidTier(sub.items.data[0]?.price.id, prices, mode);
        if (tier && subscriptionAllowsCoaching(sub.status)) {
          if (!chosen || sub.created > chosen.sub.created) chosen = { sub, tier, customerId };
        }
      }
    }
    if (chosen) {
      const { sub, tier, customerId } = chosen;
      const end = (sub as any).current_period_end ?? sub.items.data[0]?.current_period_end;
      const subscriptionEnd = end ? new Date(end * 1000).toISOString() : null;
      const updates: Record<string, unknown> = {
        payment_status: "paid", subscription_tier: tier, subscription_status: sub.status,
        subscription_end: subscriptionEnd, stripe_customer_id: customerId,
      };
      // A free routine is not a trainer-reviewed paid plan.
      if (!hasCoaching(profile)) updates.plan_status = "plan_pending";
      const { error } = await db.from("profiles").update(updates).eq("user_id", user.id);
      if (error) throw error;
      await syncStripeEntitlement(db, user.id, tier, sub.status, subscriptionEnd, sub.id);
      return json({ subscribed: true, tier, subscription_end: subscriptionEnd,
        plan: sub.items.data[0]?.price.recurring?.interval === "year" ? "yearly" : "monthly" });
    }
    // Preserve historical one-time coaching purchases; metadata/old free flags are not proof.
    if (profile.stripe_payment_id && hasCoaching(profile)) {
      return json({ subscribed: true, tier: profile.subscription_tier, subscription_end: null, plan: null });
    }
    // Plans granted by an admin (no Stripe customer on the account) are not Stripe-managed: never auto-downgrade them.
    if (!profile.stripe_customer_id && hasCoaching(profile)) {
      return json({ subscribed: true, tier: profile.subscription_tier, subscription_end: profile.subscription_end, plan: null, source: "manual" });
    }
    const { error } = await db.from("profiles").update({
      payment_status: "unpaid", subscription_tier: "free", subscription_status: "inactive", subscription_end: null,
    }).eq("user_id", user.id);
    if (error) throw error;
    await syncStripeEntitlement(db, user.id, "free", "inactive", null);
    return json({ subscribed: false, tier: "free", subscription_end: null, plan: null });
  } catch (error) {
    console.error("check-subscription failed", error);
    return json({ error: "No se ha podido verificar la suscripción. Vuelve a intentarlo." }, 500);
  }
});
