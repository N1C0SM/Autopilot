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

    // Authenticate caller
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: caller, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ADMIN-DELETE] Admin ${caller.user.id} deleting user ${target_user_id}`);

    // Get email first so we can also wipe lead tables tied by email
    const { data: profileRow } = await supabaseAdmin
      .from("profiles").select("email").eq("user_id", target_user_id).maybeSingle();
    const userEmail = profileRow?.email || null;

    // Delete all user data (await everything so deletion is complete before auth removal)
    await Promise.all([
      supabaseAdmin.from("workout_logs").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("day_completions").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("weight_logs").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("personal_records").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("chat_messages").delete().eq("conversation_user_id", target_user_id),
      supabaseAdmin.from("chat_messages").delete().eq("sender_id", target_user_id),
      supabaseAdmin.from("notifications").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("referrals").delete().eq("referrer_user_id", target_user_id),
      supabaseAdmin.from("referrals").delete().eq("referred_user_id", target_user_id),
      supabaseAdmin.from("training_plan").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("nutrition_plan").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("onboarding").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("progress_photos").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("scan_history").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("scan_leads").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("payment_reminders").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("calendar_tokens").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("google_calendar_tokens").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("external_activities").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("training_schedule_overrides").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("user_schedule").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("trainer_assignments").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("trainer_assignments").delete().eq("trainer_id", target_user_id),
      supabaseAdmin.from("trainer_profiles").delete().eq("user_id", target_user_id),
    ]);

    // Wipe lead/email artefacts by email (so user doesn't reappear in metrics / recents)
    if (userEmail) {
      await Promise.all([
        supabaseAdmin.from("scan_leads").delete().eq("email", userEmail),
        supabaseAdmin.from("leads").delete().eq("email", userEmail),
        supabaseAdmin.from("email_send_log").delete().eq("recipient_email", userEmail),
        supabaseAdmin.from("suppressed_emails").delete().eq("email", userEmail),
        supabaseAdmin.from("email_unsubscribe_tokens").delete().eq("email", userEmail),
      ]);
    }

    await Promise.all([
      supabaseAdmin.from("user_roles").delete().eq("user_id", target_user_id),
      supabaseAdmin.from("profiles").delete().eq("user_id", target_user_id),
      supabaseAdmin.storage.from("avatars").remove([
        `${target_user_id}/avatar.jpg`, `${target_user_id}/avatar.png`, `${target_user_id}/avatar.webp`,
      ]),
    ]);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
    if (deleteError) {
      console.error("[ADMIN-DELETE] Auth delete error:", deleteError.message);
      return new Response(JSON.stringify({ error: "Error deleting auth user" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ADMIN-DELETE] User ${target_user_id} fully deleted`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ADMIN-DELETE] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
