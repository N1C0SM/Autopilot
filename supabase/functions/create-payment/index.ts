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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    // Read payment_mode from settings using service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: settings } = await supabaseAdmin.from("settings").select("payment_mode, price_id_test, price_id_live, free_campaign").limit(1).single();
    if (settings?.free_campaign) return new Response(JSON.stringify({ code: "free_campaign", error: "Las compras de planes están desactivadas durante la campaña gratuita." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const paymentMode = settings?.payment_mode || "test";

    const stripeKey = paymentMode === "live"
      ? Deno.env.get("STRIPE_LIVE_SECRET_KEY")
      : Deno.env.get("STRIPE_TEST_SECRET_KEY");

    if (!stripeKey) throw new Error(`Stripe ${paymentMode} secret key not configured`);

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const priceId = paymentMode === "live"
      ? (settings?.price_id_live || "")
      : (settings?.price_id_test || "");
    if (!priceId) throw new Error(`Price ID for ${paymentMode} mode not configured in settings`);

    const ALLOWED_ORIGINS = ["https://autopilotplan.com", "https://www.autopilotplan.com", "https://autopilotplan.lovable.app"];
    const reqOrigin = req.headers.get("origin") || "";
    const safeOrigin = ALLOWED_ORIGINS.includes(reqOrigin) || /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(reqOrigin) ? reqOrigin : "https://autopilotplan.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${safeOrigin}/payment-success`,
      cancel_url: `${safeOrigin}/signup`,
      metadata: { user_id: user.id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
