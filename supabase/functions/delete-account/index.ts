import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    console.log(`[DELETE-ACCOUNT] Deleting user ${userId}`);

    // Delete all user data from all tables
    const userTables = [
      "workout_logs",
      "day_completions",
      "weight_logs",
      "notifications",
      "training_plan",
      "nutrition_plan",
      "onboarding",
      "progress_photos",
      "scan_history",
      "personal_records",
      "user_schedule",
      "training_schedule_overrides",
      "external_activities",
      "user_consents",
      "payment_reminders",
      "trainer_assignments",
      "calendar_tokens",
      "google_calendar_connections",
      "google_calendar_tokens",
    ];
    await Promise.all([
      ...userTables.map((t) => supabaseAdmin.from(t).delete().eq("user_id", userId)),
      supabaseAdmin.from("chat_messages").delete().eq("conversation_user_id", userId),
      supabaseAdmin.from("chat_messages").delete().eq("sender_id", userId),
      supabaseAdmin.from("referrals").delete().eq("referrer_user_id", userId),
      supabaseAdmin.from("referrals").delete().eq("referred_user_id", userId),
    ]);

    // Borra TODOS los archivos del usuario en storage (fotos de progreso, avatar)
    const purgeBucket = async (bucket: string, prefix: string) => {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000 });
        if (!files?.length) return;
        const paths: string[] = [];
        for (const f of files) {
          // Un nivel de subcarpetas (p.ej. progress-photos/<uid>/<scanId>/foto.jpg)
          if (!f.id) {
            const { data: nested } = await supabaseAdmin.storage
              .from(bucket)
              .list(`${prefix}/${f.name}`, { limit: 1000 });
            nested?.forEach((n) => paths.push(`${prefix}/${f.name}/${n.name}`));
          } else {
            paths.push(`${prefix}/${f.name}`);
          }
        }
        if (paths.length) await supabaseAdmin.storage.from(bucket).remove(paths);
      } catch (e) {
        console.error(`[DELETE-ACCOUNT] storage purge ${bucket}:`, (e as Error).message);
      }
    };
    await Promise.all([purgeBucket("progress-photos", userId), purgeBucket("avatars", userId)]);

    // Delete profile + roles
    await Promise.all([
      supabaseAdmin.from("user_roles").delete().eq("user_id", userId),
      supabaseAdmin.from("profiles").delete().eq("user_id", userId),
    ]);

    // Delete auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[DELETE-ACCOUNT] Auth delete error:", deleteError.message);
      return new Response(JSON.stringify({ error: "Error deleting auth user" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[DELETE-ACCOUNT] User ${userId} fully deleted`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[DELETE-ACCOUNT] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
