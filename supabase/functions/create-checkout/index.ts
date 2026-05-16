import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: any) => {
  console.log(`[CREATE-CHECKOUT] ${step}`, details ? JSON.stringify(details) : "");
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
    log("Started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    log("User authenticated", { email: user.email });

    let referralCode = "";
    // Planes soportados:
    //  - "training" | "full"          → suscripción mensual con trial 7 días
    //  - "yearly"                     → legacy anual (mantener compat)
    //  - "monthly" (legacy)           → mapeado a "full"
    let plan: "training" | "full" | "yearly" = "full";
    try {
      const body = await req.json();
      referralCode = body.referral_code || "";
      const p = String(body.plan || "").toLowerCase();
      if (p === "training") plan = "training";
      else if (p === "full") plan = "full";
      else if (p === "yearly") plan = "yearly";
      else if (p === "monthly") plan = "full";
    } catch { /* no body */ }
    log("Request params", { referralCode, plan });

    // Read all settings from DB
    const { data: settings } = await supabaseClient
      .from("settings")
      .select("*")
      .limit(1)
      .single();

    const paymentMode = settings?.payment_mode || "test";
    log("Payment mode", { paymentMode });

    const stripeKey = paymentMode === "live"
      ? Deno.env.get("STRIPE_LIVE_SECRET_KEY")
      : Deno.env.get("STRIPE_TEST_SECRET_KEY");
    if (!stripeKey) throw new Error(`Stripe ${paymentMode} secret key not configured`);

    const isLive = paymentMode === "live";
    const s: any = settings || {};
    const pickPrice = () => {
      if (plan === "training") {
        return isLive ? (s.price_id_training_live || "") : (s.price_id_training_test || "");
      }
      if (plan === "yearly") {
        return isLive ? (s.price_id_yearly_live || "") : (s.price_id_yearly_test || "");
      }
      // full → preferir price_id_full_*, fallback a price_id_* legacy (compat)
      const fullId = isLive ? (s.price_id_full_live || "") : (s.price_id_full_test || "");
      if (fullId) return fullId;
      return isLive ? (s.price_id_live || "") : (s.price_id_test || "");
    };
    const PRICE_ID = pickPrice();
    const PAYMENT_LINK = plan === "yearly"
      ? (isLive ? (s.payment_link_yearly_live || "") : (s.payment_link_yearly_test || ""))
      : (isLive ? (s.payment_link_live || "") : (s.payment_link_test || ""));
    log("Price config", {
      plan,
      priceId: PRICE_ID || "missing",
      hasPaymentLink: Boolean(PAYMENT_LINK),
    });

    let REFERRAL_COUPON_ID = settings?.referral_coupon_id || "";

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Auto-create referral coupon if missing AND a referral code was provided
    const ensureReferralCoupon = async (): Promise<string> => {
      if (REFERRAL_COUPON_ID) {
        try {
          await stripe.coupons.retrieve(REFERRAL_COUPON_ID);
          return REFERRAL_COUPON_ID;
        } catch {
          log("Stored coupon not found in Stripe, creating new one");
        }
      }
      const coupon = await stripe.coupons.create({
        percent_off: 20,
        duration: "once",
        name: "Referido Autopilot 20%",
        metadata: { source: "autopilot_referral" },
      });
      log("Created new referral coupon", { id: coupon.id });
      await supabaseClient
        .from("settings")
        .update({ referral_coupon_id: coupon.id })
        .eq("id", (await supabaseClient.from("settings").select("id").limit(1).single()).data?.id);
      return coupon.id;
    };

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }
    log("Customer lookup", { customerId: customerId || "new" });

    const origin = req.headers.get("origin") || "https://autopilotv2.lovable.app";

    const discounts: Array<{ coupon: string }> = [];
    if (referralCode) {
      const { data: referrerProfile } = await supabaseClient
        .from("profiles")
        .select("user_id")
        .eq("referral_code", referralCode)
        .single();

      if (referrerProfile && referrerProfile.user_id !== user.id) {
        const couponId = await ensureReferralCoupon();
        discounts.push({ coupon: couponId });
        await supabaseClient.from("referrals").insert({
          referrer_user_id: referrerProfile.user_id,
          referral_code: referralCode,
          referred_email: user.email,
          referred_user_id: user.id,
          status: "checkout",
          reward_applied: false,
        });
      }
    }

    if (!PRICE_ID) {
      if (PAYMENT_LINK) {
        log("Using payment link fallback because price ID is missing", { paymentMode });
        return new Response(JSON.stringify({ url: PAYMENT_LINK, fallback: "payment_link" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Price ID for ${paymentMode} mode not configured in settings`);
    }

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/payment-success`,
      cancel_url: `${origin}/signup`,
      metadata: { user_id: user.id, tier: plan, plan },
      subscription_data: {
        trial_period_days: plan === "yearly" ? 0 : 7,
        metadata: { user_id: user.id, tier: plan, plan },
      },
    };

    if (discounts.length > 0) {
      sessionParams.discounts = discounts;
    }

    try {
      const session = await stripe.checkout.sessions.create(sessionParams);
      log("Session created", { url: session.url });

      await supabaseClient
        .from("profiles")
        .update({ subscription_tier: "personal" })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (stripeError) {
      const message = stripeError instanceof Error ? stripeError.message : String(stripeError);
      const canFallback = PAYMENT_LINK && /no such price|similar object exists in live mode/i.test(message);

      if (canFallback) {
        log("Using payment link fallback because checkout session failed", {
          paymentMode,
          message,
        });

        return new Response(JSON.stringify({ url: PAYMENT_LINK, fallback: "payment_link" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw stripeError;
    }
  } catch (error) {
    log("ERROR", { message: error.message, stack: error.stack });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
