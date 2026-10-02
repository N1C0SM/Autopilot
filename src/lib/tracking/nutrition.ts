export interface FoodRecord {
  name: string;
  grams: number;
  source: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
}
export interface Consumption {
  meal: string;
  planned: string | null;
  level: "checkin" | "weighed";
  foods: FoodRecord[];
  notes: string;
}
export const nutrients = ["calories", "protein", "carbs", "fats"] as const;
export function nutritionTotals(entries: Consumption[]) {
  return Object.fromEntries(
    nutrients.map((n) => {
      let known = 0,
        missing = 0;
      for (const e of entries) {
        if (e.level === "checkin") {
          missing++;
          continue;
        }
        for (const f of e.foods) {
          if (f[n] === null || !f.source.trim()) {
            missing++;
            continue;
          }
          known += (f[n]! * f.grams) / 100;
        }
      }
      return [n, { known: Math.round(known * 10) / 10, missing }];
    }),
  ) as Record<(typeof nutrients)[number], { known: number; missing: number }>;
}
