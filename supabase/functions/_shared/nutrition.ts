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
