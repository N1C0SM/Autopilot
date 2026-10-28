/**
 * Macros objetivo para la interfaz (preview y comprobaciones del editor).
 *
 * La fórmula vive en `supabase/functions/_shared/nutrition.ts`, que es la fuente
 * única que también usan sync-nutrition-macros y auto-tasks. Aquí solo se
 * re-exporta para no duplicar coeficientes: no copies la fórmula en otro sitio.
 */
export {
  calcNutritionMacros,
  detectDiet,
  type CalculatedMacros,
  type DietType,
} from "../../../supabase/functions/_shared/nutrition";
