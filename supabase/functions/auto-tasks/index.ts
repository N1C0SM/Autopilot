import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, details?: any) =>
  console.log(`[AUTO-TASKS] ${msg}${details ? ` - ${JSON.stringify(details)}` : ""}`);

// ─── Macro calculation (duplicated from generate-plan for independence) ───
function calcMacros(weight: number, goal: string) {
  switch (goal) {
    case "gain_muscle":
      return { protein: Math.round(weight * 2.2), carbs: Math.round(weight * 4), fats: Math.round(weight * 1) };
    case "lose_weight":
      return { protein: Math.round(weight * 2.4), carbs: Math.round(weight * 2), fats: Math.round(weight * 0.8) };
    case "recomp":
      return { protein: Math.round(weight * 2.2), carbs: Math.round(weight * 3), fats: Math.round(weight * 0.9) };
    case "improve_endurance":
      return { protein: Math.round(weight * 1.8), carbs: Math.round(weight * 4.5), fats: Math.round(weight * 0.9) };
    default:
      return { protein: Math.round(weight * 1.8), carbs: Math.round(weight * 3.5), fats: Math.round(weight * 1) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: cron jobs must present the configured CRON_SECRET header or
  // a service-role bearer token. Otherwise reject (prevents abuse).
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isAuthorized =
    (cronSecret && providedSecret && providedSecret === cronSecret) ||
    (bearer && serviceKey && bearer === serviceKey);
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const results = { renewed: 0, macrosAdjusted: 0, reminders: 0 };

  try {
    // Get all active paid users
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, plan_status, payment_status, name")
      .eq("payment_status", "paid")
      .eq("plan_status", "plan_ready");

    if (!profiles || profiles.length === 0) {
      log("No active users found");
      return new Response(JSON.stringify({ success: true, ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();

    for (const profile of profiles) {
      const userId = profile.user_id;

      // ─── 1. MONTHLY PLAN RENEWAL ───
      // Check if training plan is older than 30 days
      const { data: trainingPlan } = await supabase
        .from("training_plan")
        .select("updated_at, created_at")
        .eq("user_id", userId)
        .single();

      if (trainingPlan) {
        const planDate = new Date(trainingPlan.updated_at || trainingPlan.created_at);
        const daysSincePlan = (now.getTime() - planDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSincePlan >= 30) {
          log("Renewing plan", { userId, daysSincePlan: Math.round(daysSincePlan) });

          // Call generate-plan internally
          const generateUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-plan`;
          const res = await fetch(generateUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ user_id: userId }),
          });

          if (res.ok) {
            // Update the updated_at timestamp
            await supabase.from("training_plan").update({ updated_at: now.toISOString() }).eq("user_id", userId);
            await supabase.from("nutrition_plan").update({ updated_at: now.toISOString() }).eq("user_id", userId);

            // Notify user
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "plan_renewed",
              title: "¡Plan renovado! 🔄",
              message: "Tu plan de entrenamiento y nutrición se ha actualizado con nuevas variaciones para seguir progresando.",
            });

            results.renewed++;
          } else {
            log("Failed to renew plan", { userId, status: res.status });
          }
        }
      }

      // ─── 2. AUTO-ADJUST MACROS BASED ON WEIGHT ───
      // Get latest weight log and compare with onboarding weight
      const { data: latestWeight } = await supabase
        .from("weight_logs")
        .select("weight, logged_at")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(1)
        .single();

      if (latestWeight) {
        const { data: onboarding } = await supabase
          .from("onboarding")
          .select("weight, goal")
          .eq("user_id", userId)
          .single();

        if (onboarding && Math.abs(Number(latestWeight.weight) - Number(onboarding.weight)) >= 1) {
          const currentWeight = Number(latestWeight.weight);
          const newMacros = calcMacros(currentWeight, onboarding.goal || "general_health");

          // Get current macros
          const { data: currentPlan } = await supabase
            .from("nutrition_plan")
            .select("macros_json")
            .eq("user_id", userId)
            .single();

          const oldMacros = currentPlan?.macros_json as any;

          if (oldMacros && (
            oldMacros.protein !== newMacros.protein ||
            oldMacros.carbs !== newMacros.carbs ||
            oldMacros.fats !== newMacros.fats
          )) {
            await supabase.from("nutrition_plan").update({
              macros_json: newMacros,
              updated_at: now.toISOString(),
            }).eq("user_id", userId);

            // Update onboarding weight to match
            await supabase.from("onboarding").update({ weight: currentWeight }).eq("user_id", userId);

            await supabase.from("notifications").insert({
              user_id: userId,
              type: "macros_adjusted",
              title: "Macros ajustados ⚡",
              message: `Tus macros se han actualizado según tu peso actual (${currentWeight}kg): P${newMacros.protein}g / C${newMacros.carbs}g / G${newMacros.fats}g`,
            });

            results.macrosAdjusted++;
            log("Macros adjusted", { userId, currentWeight, newMacros });
          }
        }
      }

      // ─── 3. INACTIVITY REMINDERS ───
      // Check if user has completed any day in the last 5 days
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: recentCompletions } = await supabase
        .from("day_completions")
        .select("id")
        .eq("user_id", userId)
        .gte("completed_at", fiveDaysAgo)
        .limit(1);

      if (!recentCompletions || recentCompletions.length === 0) {
        // Check we haven't already sent a reminder in the last 3 days
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentReminders } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "reminder")
          .gte("created_at", threeDaysAgo)
          .limit(1);

        if (!recentReminders || recentReminders.length === 0) {
          const name = profile.name || "Campeón/a";
          await supabase.from("notifications").insert({
            user_id: userId,
            type: "reminder",
            title: "¡Te echamos de menos! 💪",
            message: `${name}, llevas unos días sin entrenar. ¡Vuelve a la carga, cada día cuenta!`,
          });

          results.reminders++;
          log("Reminder sent", { userId });
        }
      }
    }

    log("Auto-tasks completed", results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
