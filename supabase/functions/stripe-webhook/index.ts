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
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("payment_mode")
      .limit(1)
      .single();

    const paymentMode = settings?.payment_mode || "test";

    const stripeKey = paymentMode === "live"
      ? Deno.env.get("STRIPE_LIVE_SECRET_KEY")
      : Deno.env.get("STRIPE_TEST_SECRET_KEY");
    if (!stripeKey) throw new Error(`Stripe ${paymentMode} secret key not configured`);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    const webhookSecret = paymentMode === "live"
      ? Deno.env.get("STRIPE_LIVE_WEBHOOK_SECRET")
      : Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET");

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      event = await stripe.webhooks.constructEventAsync(
        body, signature, webhookSecret, undefined,
        Stripe.createSubtleCryptoProvider()
      );
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

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
          // 19€ credit (1 month) on next invoice
          await stripe.customers.createBalanceTransaction(referrerCustomerId, {
            amount: -1900, // negative = credit (cents)
            currency: "eur",
            description: `Recompensa por referido: ${referredEmail}`,
          });
          console.log(`Applied 19€ credit to referrer ${referrerProfile.email}`);
        }

        await supabaseAdmin
          .from("referrals")
          .update({ reward_applied: true, status: "completed" })
          .eq("id", referral.id);

        // Notify referrer
        await supabaseAdmin.from("notifications").insert({
          user_id: referral.referrer_user_id,
          title: "🎁 ¡Mes gratis ganado!",
          message: `Tu amigo se ha suscrito. Hemos aplicado 19€ de crédito a tu próxima factura.`,
          type: "success",
        });
      } catch (e) {
        console.error("applyReferralReward error:", (e as Error).message);
      }
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerEmail = session.customer_details?.email || session.customer_email;

      if (customerEmail) {
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("plan_status")
          .eq("email", customerEmail)
          .single();

        const updates: any = {
          payment_status: "paid",
        };

        if (existingProfile?.plan_status !== "plan_ready") {
          updates.plan_status = "plan_pending";
        }

        if (session.mode === "subscription") {
          updates.subscription_status = "active";
          updates.stripe_customer_id = session.customer as string;
          updates.subscription_tier = session.metadata?.tier || "personal";
        } else {
          updates.stripe_payment_id = session.payment_intent as string;
        }

        await supabaseAdmin.from("profiles").update(updates).eq("email", customerEmail);
        console.log(`Checkout completed for ${customerEmail}, mode: ${session.mode}`);
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
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
      if (customer.email) {
        const isActive = subscription.status === "active" || subscription.status === "trialing";

        await supabaseAdmin.from("profiles").update({
          subscription_status: isActive ? "active" : "inactive",
          subscription_end: isActive ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          payment_status: isActive ? "paid" : "unpaid",
        }).eq("email", customer.email);

        console.log(`Subscription ${subscription.status} for ${customer.email}`);
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
