/** Marcas locales de comidas hechas hoy, separadas por usuario. */
const dateSuffix = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export const mealsDoneKey = (userId?: string, d = new Date()) =>
  userId ? `meals_done_${userId}_${dateSuffix(d)}` : `meals_done_${dateSuffix(d)}`;

export function readMealsDone(userId?: string): string[] {
  try {
    const raw = localStorage.getItem(mealsDoneKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
