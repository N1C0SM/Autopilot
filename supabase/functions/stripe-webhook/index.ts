import { loadPlanPrices } from "../_shared/stripe-plan-prices.ts";
import { hasCoaching, resolvePaidTier, subscriptionAllowsCoaching } from "../_shared/entitlements.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the Stripe environment from the event itself (which webhook secret
    // verifies the signature + event.livemode), never from settings.payment_mode.
    const candidates = [
      { mode: "live" as const, secret: Deno.env.get("STRIPE_LIVE_WEBHOOK_SECRET"), key: Deno.env.get("STRIPE_LIVE_SECRET_KEY") },
      { mode: "test" as const, secret: Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET"), key: Deno.env.get("STRIPE_TEST_SECRET_KEY") },
    ].filter((c) => c.secret);

    if (candidates.length === 0) {
      console.error("Stripe webhook secret not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    let event: Stripe.Event | null = null;
    let verifiedMode: "live" | "test" | null = null;
    let lastErr = "";

    for (const c of candidates) {
      try {
        const verifier = new Stripe(c.key || "sk_placeholder", { apiVersion: "2025-08-27.basil" });
        event = await verifier.webhooks.constructEventAsync(
          body, signature, c.secret!, undefined, cryptoProvider
        );
        verifiedMode = c.mode;
        break;
      } catch (err) {
        lastErr = (err as Error).message;
      }
    }

    if (!event || !verifiedMode) {
      console.error("Invalid Stripe signature", lastErr);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // event.livemode is authoritative for which API key can resolve its object IDs.
    const paymentMode: "live" | "test" = event.livemode ? "live" : "test";
    if (paymentMode !== verifiedMode) {
      console.warn(`Webhook secret mode (${verifiedMode}) differs from event.livemode (${paymentMode}); using event.livemode`);
    }

    const stripeKey = paymentMode === "live"
      ? Deno.env.get("STRIPE_LIVE_SECRET_KEY")
      : Deno.env.get("STRIPE_TEST_SECRET_KEY");
    if (!stripeKey) throw new Error(`Stripe ${paymentMode} secret key not configured`);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    console.log(`Received Stripe event: ${event.type}`);

    // ─── REFERRAL REWARD: when referred user makes first real payment, credit referrer ───
    const applyReferralReward = async (referredEmail: string) => {
      try {
        const { data: referredProfile } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("email", referredEmail)
          .maybeSingle();
        if (!referredProfile) return;

        const { data: referral } = await supabaseAdmin
          .from("referrals")
          .select("id, referrer_user_id, reward_applied")
          .eq("referred_user_id", referredProfile.user_id)
          .eq("reward_applied", false)
          .maybeSingle();
        if (!referral) return;

        const { data: referrerProfile } = await supabaseAdmin
          .from("profiles")
          .select("stripe_customer_id, email")
          .eq("user_id", referral.referrer_user_id)
          .maybeSingle();

        let referrerCustomerId = referrerProfile?.stripe_customer_id;
        if (!referrerCustomerId && referrerProfile?.email) {
          const found = await stripe.customers.list({ email: referrerProfile.email, limit: 1 });
          if (found.data[0]) referrerCustomerId = found.data[0].id;
        }

        if (referrerCustomerId) {
          // Un mes de crédito en la próxima factura
          await stripe.customers.createBalanceTransaction(referrerCustomerId, {
            amount: -1900, // negative = credit (cents)
            currency: "eur",
            description: `Recompensa por referido: ${referredEmail}`,
          });
          console.log(`Applied referral credit to referrer ${referrerProfile.email}`);
        }

        await supabaseAdmin
          .from("referrals")
          .update({ reward_applied: true, status: "completed" })
          .eq("id", referral.id);

        // Notify referrer
        await supabaseAdmin.from("notifications").insert({
          user_id: referral.referrer_user_id,
          title: "🎁 ¡Mes gratis ganado!",
          message: `Tu amigo se ha suscrito. Hemos aplicado 1 mes de crédito a tu próxima factura.`,
          type: "success",
        });
      } catch (e) {
        console.error("applyReferralReward error:", (e as Error).message);
      }
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      // An ebook purchase, pending payment or arbitrary return URL is not a coaching purchase.
      if (session.mode === "subscription" && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const { data: settings, error: settingsError } = await supabaseAdmin.from("settings").select("*").limit(1).single();
        if (settingsError) throw settingsError;
        const prices = await loadPlanPrices(stripe, settings || {}, paymentMode);
        const tier = resolvePaidTier(sub.items.data[0]?.price.id, prices, paymentMode);
        if (tier && subscriptionAllowsCoaching(sub.status)) {
          const customerEmail = session.customer_details?.email || session.customer_email;
          let query = supabaseAdmin.from("profiles").select("user_id, name, email, plan_status, payment_status, subscription_tier, subscription_status, subscription_end, stripe_payment_id");
          query = session.client_reference_id ? query.eq("user_id", session.client_reference_id) : query.eq("email", customerEmail || "");
          const { data: profile, error: profileError } = await query.single();
          if (profileError || !profile) throw profileError || new Error("Checkout account not found");
          const periodEnd = (sub as any).current_period_end ?? sub.items.data[0]?.current_period_end;
          const { error } = await supabaseAdmin.from("profiles").update({
            payment_status: "paid", subscription_status: sub.status,
            stripe_customer_id: session.customer as string, subscription_tier: tier,
            subscription_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            plan_status: hasCoaching(profile) ? profile.plan_status : "plan_pending",
          }).eq("user_id", profile.user_id);
          if (error) throw error;
          // Preserve the existing welcome email, idempotent per verified checkout.
          try {
            await supabaseAdmin.functions.invoke("send-transactional-email", { body: {
              templateName: "welcome-paid", recipientEmail: profile.email,
              idempotencyKey: `welcome-paid-${session.id}`,
              templateData: { name: profile.name || "", dashboardUrl: "https://autopilotplan.com/dashboard" },
            } });
          } catch (emailError) { console.error("Failed to send welcome-paid email", emailError); }
        }
      }
    }

    // First successful invoice payment (after trial) → trigger referral reward
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const email = invoice.customer_email;
      // Only reward when there's actual money charged (not 0€ trial invoices)
      if (email && (invoice.amount_paid || 0) > 0) {
        await applyReferralReward(email);
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const eventSub = event.data.object as Stripe.Subscription;
      // Read current state so a delayed webhook cannot restore an expired subscription.
      const sub = await stripe.subscriptions.retrieve(eventSub.id);
      const customerId = sub.customer as string;
      const { data: settings, error: settingsError } = await supabaseAdmin.from("settings").select("*").limit(1).single();
      if (settingsError) throw settingsError;
      const prices = await loadPlanPrices(stripe, settings || {}, paymentMode);
      const tier = resolvePaidTier(sub.items.data[0]?.price.id, prices, paymentMode);
      if (tier) {
        const { data: profiles, error: profileError } = await supabaseAdmin.from("profiles")
          .select("user_id, payment_status, subscription_status, subscription_tier, subscription_end, stripe_payment_id, plan_status")
          .eq("stripe_customer_id", customerId);
        if (profileError) throw profileError;
        // An older cancelled subscription must not revoke a different current one.
        let active = subscriptionAllowsCoaching(sub.status) ? sub : null;
        if (!active) {
          for await (const candidate of stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 })) {
            if (subscriptionAllowsCoaching(candidate.status) && resolvePaidTier(candidate.items.data[0]?.price.id, prices, paymentMode)) {
              if (!active || candidate.created > active.created) active = candidate;
            }
          }
        }
        for (const profile of profiles || []) {
          if (!active && profile.stripe_payment_id && hasCoaching(profile)) continue;
          const end = active && ((active as any).current_period_end ?? active.items.data[0]?.current_period_end);
          const updates: Record<string, unknown> = {
            subscription_status: active?.status || "inactive", subscription_end: end ? new Date(end * 1000).toISOString() : null,
            payment_status: active ? "paid" : "unpaid",
            subscription_tier: active ? resolvePaidTier(active.items.data[0]?.price.id, prices, paymentMode) : "free",
          };
          if (active && !hasCoaching(profile)) updates.plan_status = "plan_pending";
          const { error } = await supabaseAdmin.from("profiles").update(updates).eq("user_id", profile.user_id);
          if (error) throw error;
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerEmail = invoice.customer_email;
      if (customerEmail) {
        console.log(`Payment failed for ${customerEmail}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
