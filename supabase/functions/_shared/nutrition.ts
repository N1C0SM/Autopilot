export interface MacroTargets {
  protein: number;
  carbs: number;
  fats: number;
  calories?: number;
}

// Product input limits, shared by the editor, generator and read-side warnings.
// These are data-quality checks, not a personalized dietary recommendation.
export const MACRO_INPUT_LIMITS = { protein: 350, carbs: 700, fats: 180 } as const;

export function nutritionMacroError(value: unknown, _weight?: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Revisa los objetivos de nutrición: el formato no es válido.";
  const macros = value as Record<string, unknown>;
  const keys = ["protein", "carbs", "fats"] as const;
  if (keys.every((key) => macros[key] == null || macros[key] === "")) return null;
  // Match the database's accepted number/string formats without coercing
  // booleans, arrays or objects into apparently valid nutritional targets.
  const numericInput = (input: unknown): number => typeof input === "number"
    ? input
    : typeof input === "string" && /^[0-9]+([.][0-9]+)?$/.test(input)
      ? Number(input)
      : Number.NaN;
  const labels = { protein: "proteína", carbs: "carbohidratos", fats: "grasas" };
  for (const key of keys) {
    const amount = numericInput(macros[key]);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MACRO_INPUT_LIMITS[key]) {
      return `Revisa el objetivo de ${labels[key]}: debe ser mayor que 0 y no superar ${MACRO_INPUT_LIMITS[key]} g. Consulta con el responsable del plan.`;
    }
  }
  if (macros.calories != null && macros.calories !== "") {
    const calories = numericInput(macros.calories);
    if (!Number.isFinite(calories) || calories <= 0) return "Revisa las calorías del plan: deben ser un número mayor que 0.";
    const calculated = Number(macros.protein) * 4 + Number(macros.carbs) * 4 + Number(macros.fats) * 9;
    if (Math.abs(calories - calculated) > Math.max(50, calculated * 0.1)) {
      return "Las calorías del plan no coinciden con sus macros. Revisa ambos valores antes de guardar.";
    }
  }
  return null;
}

export function parseBodyWeight(value: unknown): number | null {
  const weight = typeof value === "number" ? value : Number(value);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

export function parseMacroTargets(value: unknown): MacroTargets | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const macros = value as Record<string, unknown>;
  const protein = Number(macros.protein);
  const carbs = Number(macros.carbs);
  const fats = Number(macros.fats);
  if (![protein, carbs, fats].every((amount) => Number.isFinite(amount) && amount > 0)) return null;

  const calories = Number(macros.calories);
  return {
    protein,
    carbs,
    fats,
    ...(Number.isFinite(calories) && calories > 0 ? { calories } : {}),
  };
}

// ─── Fórmula de macros objetivo (peso × objetivo × dieta) ───
//
// Fuente única para las edge functions (sync-nutrition-macros y auto-tasks) y,
// vía re-export, para el frontend (src/lib/nutritionMacros.ts). Los coeficientes
// son los que usa generate-plan al crear el plan; si cambias uno, cámbialo allí
// también para que los tres caminos den el mismo resultado. Mantener este fichero
// sin APIs de Deno para que el frontend pueda importarlo.

export type DietType =
  | "estandar"
  | "paleo"
  | "keto"
  | "vegana"
  | "vegetariana"
  | "mediterranea"
  | "sin_gluten"
  | "sin_lactosa";

export type CalculatedMacros = MacroTargets & { calories: number };

/** Lee una dieta del texto libre de onboarding (preferencias o alergias). */
const detectDietFromText = (value?: string | null): DietType => {
  if (!value) return "estandar";
  const text = value.toLowerCase();
  if (text.includes("keto") || text.includes("cetog")) return "keto";
  if (text.includes("paleo")) return "paleo";
  if (text.includes("vegan") && !text.includes("vegetar")) return "vegana";
  if (text.includes("vegetar") || text.includes("ovolac")) return "vegetariana";
  if (text.includes("mediterr")) return "mediterranea";
  if (text.includes("sin gluten") || text.includes("celiac")) return "sin_gluten";
  if (text.includes("sin lactosa") || text.includes("intoleran")) return "sin_lactosa";
  return "estandar";
};

/**
 * Dieta efectiva del usuario: primero sus preferencias nutricionales y, si no
 * dicen nada, las alergias/intolerancias declaradas (sin gluten, sin lactosa).
 */
export function detectDiet(preferences?: string | null, allergies?: string | null): DietType {
  const fromPreferences = detectDietFromText(preferences);
  return fromPreferences === "estandar" ? detectDietFromText(allergies) : fromPreferences;
}

// Gramos por kg de peso y objetivo.
const GOAL_MACROS: Record<string, readonly [number, number, number]> = {
  gain_muscle: [2.2, 4.0, 1.0],
  lose_weight: [2.4, 2.0, 0.8],
  recomp: [2.2, 3.0, 0.9],
  improve_endurance: [1.8, 4.5, 0.9],
  skill_based: [2.0, 3.5, 1.0],
};
const DEFAULT_GOAL_MACROS = [1.8, 3.5, 1.0] as const;

/**
 * Macros diarios objetivo adaptados al objetivo y a la dieta. Devuelve null si
 * no hay un peso corporal válido: nunca se inventan targets sin peso.
 */
export function calcNutritionMacros(
  weightKg: number,
  goal: string,
  diet: DietType = "estandar",
): CalculatedMacros | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;

  const [baseProtein, baseCarbs, baseFats] = GOAL_MACROS[goal] ?? DEFAULT_GOAL_MACROS;
  let protein = baseProtein;
  let carbs = baseCarbs;
  let fats = baseFats;

  // Ajuste por dieta, con los mismos coeficientes que generate-plan.
  switch (diet) {
    case "keto":
      carbs = 0.5;
      fats = Math.max(fats * 2.2, 1.8);
      protein = Math.max(protein, 2.0);
      break;
    case "paleo":
      carbs *= 0.7;
      fats *= 1.3;
      break;
    case "vegana":
      protein *= 1.1;
      carbs *= 1.1;
      break;
    case "mediterranea":
      fats *= 1.15;
      break;
    default:
      break;
  }

  const macros = {
    protein: Math.round(weightKg * protein),
    carbs: Math.round(weightKg * carbs),
    fats: Math.round(weightKg * fats),
  };
  return {
    ...macros,
    calories: macros.protein * 4 + macros.carbs * 4 + macros.fats * 9,
  };
}
