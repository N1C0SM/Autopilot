/**
 * Macros de cada comida del día, cuadrados con el objetivo: la proteína, los carbos, las
 * grasas y las kcal de todas las comidas suman exactamente lo que marca el resumen.
 *
 * Si la IA dio los gramos de cada comida, se reparten en esa proporción; si no (comidas
 * antiguas o de respaldo), cada comida cuenta como una parte igual del día. La app nativa
 * replica este cálculo en `NutritionView` (OtherViews.swift): mismas cifras en todas partes.
 */

/** Ingrediente con su peso, para pesarlo en báscula. */
export interface PlanIngredient {
  food?: string;
  grams?: number;
  unit?: string;
}

export interface PlanMeal {
  name: string;
  description: string;
  ingredients?: PlanIngredient[];
  protein?: number;
  carbs?: number;
  fats?: number;
}

export interface MealMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
}

/** Reparte `total` (redondeado) en enteros proporcionales a `weights` que suman exactamente `total`. */
export function splitExact(total: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const target = Math.max(0, Math.round(total));
  const sum = weights.reduce((s, w) => s + w, 0);
  const ws = sum > 0 ? weights : weights.map(() => 1);
  const wsum = sum > 0 ? sum : ws.length;
  const raw = ws.map((w) => (target * w) / wsum);
  const out = raw.map((r) => Math.floor(r));
  let rest = target - out.reduce((s, n) => s + n, 0);
  // Mayor resto primero; a igualdad, la comida anterior.
  const order = raw.map((r, i) => ({ frac: r - Math.floor(r), i })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0; k++, rest--) out[order[k % order.length].i] += 1;
  return out;
}

const weightsOf = (meals: PlanMeal[], key: "protein" | "carbs" | "fats") => {
  const own = meals.every((m) => typeof m[key] === "number" && Number.isFinite(m[key]) && (m[key] as number) >= 0);
  return meals.map((m) => (own ? (m[key] as number) : 1));
};

export function mealMacros(meals: PlanMeal[], target: MealMacros): MealMacros[] {
  const protein = splitExact(target.protein, weightsOf(meals, "protein"));
  const carbs = splitExact(target.carbs, weightsOf(meals, "carbs"));
  const fats = splitExact(target.fats, weightsOf(meals, "fats"));
  const kcal = splitExact(target.kcal, meals.map((_, i) => protein[i] * 4 + carbs[i] * 4 + fats[i] * 9));
  return meals.map((_, i) => ({ kcal: kcal[i], protein: protein[i], carbs: carbs[i], fats: fats[i] }));
}

/** Ingredientes válidos de la comida, con su cantidad lista para pintar («80 g», «200 ml»). */
export function mealIngredients(meal: PlanMeal): { food: string; amount: string }[] {
  return (Array.isArray(meal.ingredients) ? meal.ingredients : [])
    .filter((i) => typeof i?.food === "string" && i.food.trim() && typeof i.grams === "number" && i.grams > 0)
    .map((i) => ({ food: (i.food as string).trim(), amount: `${Math.round(i.grams as number)} ${i.unit === "ml" ? "ml" : "g"}` }));
}

/** Suma de las comidas marcadas: marcarlas todas da exactamente el objetivo. */
export function sumMacros(list: MealMacros[]): MealMacros {
  return list.reduce(
    (s, m) => ({ kcal: s.kcal + m.kcal, protein: s.protein + m.protein, carbs: s.carbs + m.carbs, fats: s.fats + m.fats }),
    { kcal: 0, protein: 0, carbs: 0, fats: 0 },
  );
}
