import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

/**
 * Cancela la suscripción del usuario desde la propia app.
 *
 * Existe para que en iOS se pueda dejar de pagar sin abrir un checkout ni un
 * portal externo: App Store §3.1.1 prohíbe dirigir a comprar fuera, pero
 * cancelar una suscripción ya contratada es gestión de cuenta, no compra.
 * Se cancela al final del periodo pagado (cancel_at_period_end), que es lo que
 * promete la interfaz: mantienes el acceso hasta la fecha de renovación.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ACTIVE = new Set(["active", "trialing", "past_due", "unpaid"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const db = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return json({ error: "Not authenticated" }, 401);

    const { data: profile } = await db
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerId = profile?.stripe_customer_id;
    // Sin cliente de Stripe no hay nada que cancelar: puede ser un acceso
    // concedido a mano por un entrenador.
    if (!customerId) return json({ canceled: false, reason: "no_stripe_subscription" });

    const { data: settings } = await db
      .from("settings").select("payment_mode").limit(1).maybeSingle();
    const preferred = settings?.payment_mode === "live" ? "live" : "test";
    const modes: Array<"live" | "test"> = preferred === "live" ? ["live", "test"] : ["test", "live"];

    let lastError: string | null = null;
    for (const mode of modes) {
      const key = Deno.env.get(mode === "live" ? "STRIPE_LIVE_SECRET_KEY" : "STRIPE_TEST_SECRET_KEY");
      if (!key) continue;
      try {
        const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
        const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
        const live = subs.data.filter((s) => ACTIVE.has(s.status));
        if (!live.length) return json({ canceled: false, reason: "no_active_subscription" });

        let endsAt: number | null = null;
        for (const sub of live) {
          const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
          const end = "current_period_end" in updated && typeof updated.current_period_end === "number"
            ? updated.current_period_end
            : updated.items.data[0]?.current_period_end;
          if (end && (!endsAt || end > endsAt)) endsAt = end;
        }

        const isoEnd = endsAt ? new Date(endsAt * 1000).toISOString() : null;
        // Reflejo inmediato en el perfil: el estado sigue activo hasta el final
        // del periodo, pero ya no se renovará.
        await db.from("profiles").update({ subscription_end: isoEnd }).eq("user_id", user.id);

        return json({ canceled: true, ends_at: isoEnd });
      } catch (e) {
        lastError = (e as Error).message;
        if (lastError.includes("No such customer")) continue;
        break;
      }
    }

    return json({ error: lastError ?? "Stripe no está configurado" }, 502);
  } catch (error) {
    console.error("[CANCEL-SUBSCRIPTION]", (error as Error).message);
    return json({ error: "No se pudo cancelar la suscripción. Inténtalo de nuevo." }, 500);
  }
});
