import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { calcNutritionMacros, detectDiet, nutritionMacroError, type CalculatedMacros } from "../_shared/nutrition.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * Ingredientes con su peso (para pesarlos) y gramos de macros por comida si la IA los dio:
 * la app cuadra los macros con el objetivo del día (`mealMacros.ts`).
 */
type Ingredient = { food: string; grams: number; unit: "g" | "ml" };
type Meal = { name: string; description: string; ingredients?: Ingredient[]; protein?: number; carbs?: number; fats?: number };

const grams = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;

const parseIngredients = (value: unknown): Ingredient[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const list: Ingredient[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const food = typeof record.food === "string" ? record.food.trim().slice(0, 80) : "";
    const amount = grams(record.grams);
    if (!food || !amount) continue;
    list.push({ food, grams: amount, unit: record.unit === "ml" ? "ml" : "g" });
  }
  return list.length ? list.slice(0, 12) : undefined;
};

const parseMeals = (value: unknown): Meal[] | null => {
  if (!Array.isArray(value) || value.length < 3) return null;
  const meals: Meal[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string" || !record.name.trim()) return null;
    if (typeof record.description !== "string" || !record.description.trim()) return null;
    const meal: Meal = { name: record.name, description: record.description };
    const ingredients = parseIngredients(record.ingredients);
    if (ingredients) meal.ingredients = ingredients;
    for (const key of ["protein", "carbs", "fats"] as const) {
      const value = grams(record[key]);
      if (value !== undefined) meal[key] = value;
    }
    meals.push(meal);
  }
  return meals;
};

/**
 * Regenera las comidas con IA. La persistencia se hace aquí (service role)
 * porque las políticas RLS de nutrition_plan no permiten escribir al usuario:
 * el cliente no puede guardar comidas por su cuenta.
 */
const generateMeals = async (params: {
  url: string;
  preferences: string;
  allergies: string;
  goal: string;
  macros: CalculatedMacros;
  weight: number;
}): Promise<Meal[] | null> => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return null;
  try {
    const response = await fetch(`${params.url}/functions/v1/ai-generate-meals`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        preferences: params.preferences,
        allergies: params.allergies,
        goal: params.goal,
        macros: params.macros,
        weight: params.weight,
      }),
    });
    if (!response.ok) {
      console.error("[sync-nutrition-macros] ai-generate-meals failed", response.status);
      return null;
    }
    const data: unknown = await response.json();
    const meals = data !== null && typeof data === "object" && !Array.isArray(data)
      ? parseMeals((data as Record<string, unknown>).meals)
      : null;
    return meals;
  } catch (error) {
    console.error("[sync-nutrition-macros] ai-generate-meals error", error instanceof Error ? error.message : error);
    return null;
  }
};

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

  // `{ regenerate_meals: true }`: la persona ha confirmado en Ajustes que quiere
  // regenerar las comidas. Sin ese flag solo se sincronizan los macros, como antes.
  const body: unknown = await req.json().catch(() => null);
  const regenerateMeals = body !== null && typeof body === "object" && !Array.isArray(body)
    && (body as Record<string, unknown>).regenerate_meals === true;

  // La dieta (keto, paleo, vegana, mediterránea…) cambia los macros: usamos la
  // misma fórmula con dieta que generate-plan para que el plan no se contradiga.
  const { data: ob } = await admin
    .from("onboarding")
    .select("weight, goal, nutrition_preferences, allergies")
    .eq("user_id", userId)
    .maybeSingle();
  const weight = Number(ob?.weight);
  if (!Number.isFinite(weight) || weight <= 30 || weight > 300) return json({ updated: false, reason: "no_weight" });

  const diet = detectDiet(ob?.nutrition_preferences, ob?.allergies);
  const macros = calcNutritionMacros(weight, ob?.goal || "general_health", diet);
  if (!macros) return json({ updated: false, reason: "no_weight" });
  if (nutritionMacroError(macros)) return json({ updated: false, reason: "invalid" });

  const { data: plan } = await admin.from("nutrition_plan").select("id").eq("user_id", userId).maybeSingle();
  const now = new Date().toISOString();
  const { error } = plan
    ? await admin.from("nutrition_plan").update({ macros_json: macros, updated_at: now }).eq("user_id", userId)
    : await admin.from("nutrition_plan").insert({ user_id: userId, macros_json: macros, meals_json: [] });
  if (error) return json({ error: error.message }, 500);

  // Primero los macros (siempre); después, si se pidió, las comidas. Si la IA
  // falla, la persona conserva los macros nuevos y la UI puede reintentar.
  let mealsUpdated = false;
  if (regenerateMeals) {
    const meals = await generateMeals({
      url,
      preferences: ob?.nutrition_preferences || "",
      allergies: ob?.allergies || "",
      goal: ob?.goal || "general_health",
      macros,
      weight,
    });
    if (meals) {
      const { error: mealsError } = await admin
        .from("nutrition_plan")
        .update({ meals_json: meals, updated_at: now })
        .eq("user_id", userId);
      if (mealsError) console.error("[sync-nutrition-macros] meals save failed", mealsError.message);
      else mealsUpdated = true;
    }
  }

  return json({
    updated: true,
    macros,
    diet,
    ...(regenerateMeals ? { meals_updated: mealsUpdated } : {}),
  });
});
