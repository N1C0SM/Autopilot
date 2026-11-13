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

/**
 * Las comidas con IA cuestan dinero: la preparación automática (Plus sin comidas al entrar
 * en Nutrición) se intenta como mucho una vez al día por cuenta. Si falla, la persona tiene
 * «Volver a intentarlo»; los botones nunca pasan por aquí. Igual en la app nativa.
 */
const mealsAutoKey = (userId?: string) => `meals_autogen_${userId ?? "anon"}`;

/** true si hoy aún no se intentó; lo deja anotado para no repetirlo hasta mañana. */
export function claimMealsAutoGenerate(userId?: string, d = new Date()): boolean {
  try {
    if (localStorage.getItem(mealsAutoKey(userId)) === dateSuffix(d)) return false;
    localStorage.setItem(mealsAutoKey(userId), dateSuffix(d));
  } catch { /* sin almacenamiento: se intenta, como antes */ }
  return true;
}
