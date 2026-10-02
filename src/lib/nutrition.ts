export {
  parseBodyWeight,
  parseMacroTargets,
  type MacroTargets,
} from "../../supabase/functions/_shared/nutrition";

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
}): NutritionPreview {
  const parsedWeight = Number(weight);
  if (!Number.isFinite(parsedWeight) || parsedWeight <= 30) {
    return { calories: null, protein: null, hasWeight: false };
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
