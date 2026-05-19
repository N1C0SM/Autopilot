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

    let plan: "training" | "full" | "transform" = "full";
    try {
      const body = await req.json();
      const p = String(body.plan || "").toLowerCase();
      if (p === "training") plan = "training";
      else if (p === "transform") plan = "transform";
      else plan = "full";
    } catch { /* no body */ }
    log("Request params", { plan });

    // Read all settings from DB
    const { data: settings } = await supabaseClient
      .from("settings")
      .select("*")
      .limit(1)
      .single();

    const paymentMode = (settings?.payment_mode || "test") as "test" | "live";
    const s: any = settings || {};
    const linkKey = `payment_link_${plan}_${paymentMode}`;
    const PAYMENT_LINK: string = s[linkKey] || "";
    log("Payment link lookup", { plan, paymentMode, hasLink: Boolean(PAYMENT_LINK) });

    if (!PAYMENT_LINK) {
      throw new Error(`Payment link no configurado para el plan "${plan}" en modo ${paymentMode}. Configúralo en Admin → Pagos.`);
    }

    // Marca el tier elegido en el perfil para que webhook y dashboard lo reconozcan
    await supabaseClient
      .from("profiles")
      .update({ subscription_tier: plan } as any)
      .eq("user_id", user.id);

    // Append client_reference_id para que Stripe webhook pueda mapear al usuario
    const sep = PAYMENT_LINK.includes("?") ? "&" : "?";
    const finalUrl = `${PAYMENT_LINK}${sep}client_reference_id=${user.id}&prefilled_email=${encodeURIComponent(user.email)}`;

    return new Response(JSON.stringify({ url: finalUrl, fallback: "payment_link" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("ERROR", { message: error.message, stack: error.stack });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
