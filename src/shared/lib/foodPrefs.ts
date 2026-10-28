/**
 * Gustos y alimentos a evitar como chips (onboarding y Ajustes). Se guardan en los campos de
 * siempre para no tocar el esquema: los gustos como segmento «Le gusta: …» dentro de
 * `onboarding.nutrition_preferences` y lo que no come en `onboarding.allergies` (lista con comas).
 * `ai-generate-meals` ya lee ambos campos al preparar las comidas.
 */
export const FOOD_LIKES = [
  "Pollo", "Ternera", "Pescado", "Huevos", "Arroz", "Pasta", "Patata", "Legumbres",
  "Verduras", "Fruta", "Yogur", "Avena", "Pan", "Frutos secos", "Tofu",
] as const;

export const FOOD_AVOID = [
  "Lactosa", "Gluten", "Frutos secos", "Marisco", "Pescado", "Huevo", "Cerdo", "Carne roja",
  "Vegetariano", "Vegano", "Picante",
] as const;

const LIKES_PREFIX = "Le gusta: ";

export const splitList = (text: string): string[] =>
  text.split(",").map((s) => s.trim()).filter(Boolean);

export const toggleInList = (list: string[], item: string): string[] =>
  list.some((x) => x.toLowerCase() === item.toLowerCase())
    ? list.filter((x) => x.toLowerCase() !== item.toLowerCase())
    : [...list, item];

/** Gustos guardados dentro de `nutrition_preferences` («… · Le gusta: Pollo, Arroz»). */
export const readLikes = (prefs: string): string[] => {
  const seg = prefs.split(" · ").find((s) => s.startsWith(LIKES_PREFIX));
  return seg ? splitList(seg.slice(LIKES_PREFIX.length)) : [];
};

export const writeLikes = (prefs: string, likes: string[]): string => {
  const rest = prefs.split(" · ").map((s) => s.trim()).filter((s) => s && !s.startsWith(LIKES_PREFIX));
  return [...rest, likes.length ? `${LIKES_PREFIX}${likes.join(", ")}` : ""].filter(Boolean).join(" · ");
};
