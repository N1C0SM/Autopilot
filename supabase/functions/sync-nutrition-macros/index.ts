import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { nutritionMacroError } from "../_shared/nutrition.ts";

// Same formula as generate-plan / auto-tasks so targets stay consistent.
export function calcMacros(weight: number, goal: string) {
  const f = {
    gain_muscle: [2.2, 4, 1],
    lose_weight: [2.4, 2, 0.8],
    recomp: [2.2, 3, 0.9],
    improve_endurance: [1.8, 4.5, 0.9],
  }[goal] ?? [1.8, 3.5, 1];
  const protein = Math.round(weight * f[0]);
  const carbs = Math.round(weight * f[1]);
  const fats = Math.round(weight * f[2]);
  return { protein, carbs, fats, calories: protein * 4 + carbs * 4 + fats * 9 };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: claims } = await userClient.auth.getClaims(auth.slice(7));
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // The access check reads auth.uid(), so it must run with the user's own token.
  const { data: access, error: accessError } = await userClient.rpc("has_active_nutrition_access", { _user_id: userId });
  if (accessError) console.error("[sync-nutrition-macros] access check failed", accessError.message);
  if (!access) return json({ updated: false, reason: "no_access" });

  const { data: ob } = await admin.from("onboarding").select("weight, goal").eq("user_id", userId).maybeSingle();
  const weight = Number(ob?.weight);
  if (!Number.isFinite(weight) || weight <= 30 || weight > 300) return json({ updated: false, reason: "no_weight" });

  const macros = calcMacros(weight, ob?.goal || "general_health");
  if (nutritionMacroError(macros)) return json({ updated: false, reason: "invalid" });

  const { data: plan } = await admin.from("nutrition_plan").select("id").eq("user_id", userId).maybeSingle();
  const now = new Date().toISOString();
  const { error } = plan
    ? await admin.from("nutrition_plan").update({ macros_json: macros, updated_at: now }).eq("user_id", userId)
    : await admin.from("nutrition_plan").insert({ user_id: userId, macros_json: macros, meals_json: [] });
  if (error) return json({ error: error.message }, 500);
  return json({ updated: true, macros });
});
