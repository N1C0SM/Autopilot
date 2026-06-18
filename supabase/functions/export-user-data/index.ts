import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * RGPD Art. 15 + Art. 20 — Derecho de acceso y portabilidad.
 * Devuelve un JSON con todos los datos personales del usuario autenticado.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch in parallel
    const tables = [
      "profiles",
      "onboarding",
      "training_plan",
      "nutrition_plan",
      "workout_logs",
      "day_completions",
      "weight_logs",
      "personal_records",
      "external_activities",
      "progress_photos",
      "scan_history",
      "notifications",
      "user_consents",
      "user_schedule",
      "training_schedule_overrides",
      "referrals",
    ];

    const results: Record<string, any> = {};
    await Promise.all(
      tables.map(async (t) => {
        const { data } = await admin.from(t).select("*").eq("user_id", userId);
        results[t] = data ?? [];
      })
    );

    // Chat messages (different column)
    const { data: chatMessages } = await admin
      .from("chat_messages")
      .select("*")
      .or(`conversation_user_id.eq.${userId},sender_id.eq.${userId}`);
    results["chat_messages"] = chatMessages ?? [];

    // Auth user (email, created_at)
    const { data: au } = await admin.auth.admin.getUserById(userId);

    const payload = {
      exported_at: new Date().toISOString(),
      user: {
        id: userId,
        email: au?.user?.email,
        created_at: au?.user?.created_at,
      },
      data: results,
      legal_notice:
        "Estos son tus datos personales tratados por Autopilot a fecha de exportación, conforme al Art. 15 y 20 RGPD.",
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="autopilot-mis-datos-${userId}.json"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});