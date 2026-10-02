export interface MacroTargets {
  protein: number;
  carbs: number;
  fats: number;
  calories?: number;
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
