export {
  parseBodyWeight,
  parseMacroTargets,
  type MacroTargets,
} from "../../../supabase/functions/_shared/nutrition";

export interface NutritionPreview {
  calories: number | null;
  protein: number | null;
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
  if (!Number.isFinite(parsedWeight) || parsedWeight <= 30) {
    return { calories: null, protein: null, hasWeight: false };
  }

  // Si el plan ya tiene macros guardados, se muestran esos: así Nutrición y el plan coinciden.
  if (savedMacros && typeof savedMacros === "object") {
    const m = savedMacros as Record<string, unknown>;
    const p = Number(m.protein), c = Number(m.carbs), f = Number(m.fats);
    if (p > 0 && c >= 0 && f >= 0) {
      const kcal = Number(m.calories) > 0 ? Number(m.calories) : p * 4 + c * 4 + f * 9;
      return { calories: Math.round(kcal), protein: Math.round(p), hasWeight: true };
    }
  }


  const base = sex === "female" ? parsedWeight * 28 : parsedWeight * 32;
  const calories = goal === "lose_weight"
    ? Math.round(base - 350)
    : goal === "gain_muscle"
      ? Math.round(base + 300)
      : Math.round(base);

  return {
    calories,
    protein: Math.round(parsedWeight * 2),
    hasWeight: true,
  };
}
