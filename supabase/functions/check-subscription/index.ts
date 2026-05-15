import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  console.log(`[CHECK-SUBSCRIPTION] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { data: settings } = await supabaseClient.from("settings").select("payment_mode").limit(1).single();
    const paymentMode = settings?.payment_mode || "test";

    // Read all price IDs to detect plan type later
    const { data: priceSettings } = await supabaseClient
      .from("settings")
      .select("price_id_test, price_id_live, price_id_yearly_test, price_id_yearly_live")
      .limit(1)
      .single();

    const stripeKey = paymentMode === "live"
      ? Deno.env.get("STRIPE_LIVE_SECRET_KEY")
      : Deno.env.get("STRIPE_TEST_SECRET_KEY");

    if (!stripeKey) throw new Error(`Stripe ${paymentMode} secret key not configured`);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check current profile to avoid overwriting free plan users
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("payment_status, subscription_status, plan_status")
      .eq("user_id", user.id)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      // DON'T overwrite payment_status if user has a free plan (payment_status already "paid")
      if (profile?.payment_status !== "paid") {
        await supabaseClient.from("profiles").update({
          subscription_status: "inactive",
        }).eq("user_id", user.id);
      }

      return new Response(JSON.stringify({
        subscribed: profile?.payment_status === "paid",
        subscription_end: null,
        tier: "personal",
        plan: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    await supabaseClient.from("profiles").update({
      stripe_customer_id: customerId,
    }).eq("user_id", user.id);

    const [activeSubs, trialSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
    ]);

    const sub = activeSubs.data[0] || trialSubs.data[0];
    const hasActiveSub = !!sub;
    let subscriptionEnd = null;
    let tier = "personal";
    let plan: "monthly" | "yearly" | null = null;

    if (hasActiveSub) {
      const periodEnd =
        (sub as any).current_period_end ??
        sub.items?.data?.[0]?.current_period_end ??
        null;
      subscriptionEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
      tier = sub.metadata?.tier || "personal";

      // Detect plan by comparing price_id
      const subPriceId = sub.items?.data?.[0]?.price?.id;
      const monthlyIds = [priceSettings?.price_id_test, priceSettings?.price_id_live].filter(Boolean);
      const yearlyIds = [priceSettings?.price_id_yearly_test, priceSettings?.price_id_yearly_live].filter(Boolean);
      if (subPriceId && yearlyIds.includes(subPriceId)) plan = "yearly";
      else if (subPriceId && monthlyIds.includes(subPriceId)) plan = "monthly";
      else plan = sub.metadata?.plan === "yearly" ? "yearly" : "monthly";

      logStep("Active subscription found", { endDate: subscriptionEnd, tier, status: sub.status, plan });

      const updateData: Record<string, string> = {
        subscription_status: sub.status,
        payment_status: "paid",
        subscription_tier: tier,
      };
      if (subscriptionEnd) updateData.subscription_end = subscriptionEnd;
      // Auto-activate: if user was onboarding, move to plan_pending
      if (profile?.plan_status === "onboarding") {
        updateData.plan_status = "plan_pending";
      }
      await supabaseClient.from("profiles").update(updateData).eq("user_id", user.id);
    } else {
      logStep("No active subscription");
      // Only update subscription_status, preserve payment_status for free plan users
      if (profile?.payment_status !== "paid") {
        await supabaseClient.from("profiles").update({
          subscription_status: "inactive",
          payment_status: "unpaid",
        }).eq("user_id", user.id);
      } else {
        await supabaseClient.from("profiles").update({
          subscription_status: "inactive",
        }).eq("user_id", user.id);
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub || profile?.payment_status === "paid",
      subscription_end: subscriptionEnd,
      tier,
      plan,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
