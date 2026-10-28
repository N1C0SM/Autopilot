import { errorMessage } from "../_shared/runtime-values.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: caller, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ADMIN-RESET-METRICS] Admin ${caller.user.id} reseteando métricas`);

    // Wipe all analytics / funnel / activity data
    const tables = [
      "scan_leads",
      "leads",
      "scan_history",
      "email_send_log",
      "day_completions",
      "workout_logs",
      "weight_logs",
      "personal_records",
      "progress_photos",
      "chat_messages",
      "notifications",
      "payment_reminders",
    ];

    const results: Record<string, string> = {};
    for (const t of tables) {
      const { error } = await supabaseAdmin.from(t).delete().not("id", "is", null);
      results[t] = error ? `ERROR: ${error.message}` : "ok";
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[ADMIN-RESET-METRICS] Error:", e);
    return new Response(JSON.stringify({ error: errorMessage(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});