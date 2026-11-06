export {
  parseBodyWeight,
  parseMacroTargets,
  type MacroTargets,
} from "../../../supabase/functions/_shared/nutrition";

export interface NutritionPreview {
  calories: number | null;
  protein: number | null;
  /** Del plan guardado o, sin él (Gratis: la RLS no deja leer el plan), grasas al 25 % de las kcal y el resto en carbohidratos, como `MacroEstimate` del nativo. */
  carbs: number | null;
  fats: number | null;
  hasWeight: boolean;
}

export function resolveNutritionPreview({
  weight,
  sex,
  goal,
}: {
  weight?: number | string | null;
  sex?: string | null;
  goal?: string | null;
}, savedMacros?: unknown): NutritionPreview {
  const parsedWeight = Number(weight);
  
  // Validación estricta del peso
  if (!Number.isFinite(parsedWeight) || parsedWeight <= 30 || parsedWeight > 300) {
    return { calories: null, protein: null, carbs: null, fats: null, hasWeight: false };
  }

  // Si el plan ya tiene macros guardados, se muestran esos: así Nutrición y el plan coinciden.
  if (savedMacros && typeof savedMacros === "object") {
    const m = savedMacros as Record<string, unknown>;
    const p = Number(m.protein);
    const c = Number(m.carbs);
    const f = Number(m.fats);
    
    // Validar que los macros sean números válidos
    if (Number.isFinite(p) && p > 0 && Number.isFinite(c) && c >= 0 && Number.isFinite(f) && f >= 0) {
      const kcal = Number(m.calories);
      const calculatedKcal = Number.isFinite(kcal) && kcal > 0 ? kcal : p * 4 + c * 4 + f * 9;
      return {
        calories: Math.round(calculatedKcal),
        protein: Math.round(p),
        carbs: Math.round(c),
        fats: Math.round(f),
        hasWeight: true,
      };
    }
  }

  // Cálculo por defecto basado en peso, sexo y objetivo
  const base = sex === "female" ? parsedWeight * 28 : parsedWeight * 32;
  const calories = goal === "lose_weight"
    ? Math.round(base - 350)
    : goal === "gain_muscle"
      ? Math.round(base + 300)
      : Math.round(base);

  const kcal = Math.max(1200, calories); // Mínimo saludable
  const protein = Math.round(parsedWeight * 2);
  const fats = Math.round((kcal * 0.25) / 9);
  return {
    calories: kcal,
    protein,
    carbs: Math.max(0, Math.round((kcal - protein * 4 - fats * 9) / 4)),
    fats,
    hasWeight: true,
  };
}
