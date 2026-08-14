// Fuente única de verdad para los precios mostrados en la UI y emails.
// Los price_id reales viven en la tabla `settings` (ver src/config/tiers.ts).
import { TIERS } from "./tiers";

/** Precio mensual del plan de entrada (Entrenamiento). */
export const MONTHLY_PRICE_EUR = TIERS.training.price; // 29
/** Precio anual por defecto (10 meses). Puede sobreescribirse desde `settings.yearly_price_eur`. */
export const DEFAULT_YEARLY_PRICE_EUR = 290;
/** Días de prueba gratuita. */
export const TRIAL_DAYS = TIERS.training.trial_days; // 7
/** Días de garantía de devolución (ver /legal/terminos). */
export const GUARANTEE_DAYS = 30;

export const formatEur = (n: number) => `${n}€`;
export const monthlyLabel = () => `${MONTHLY_PRICE_EUR}€/mes`;
export const yearlySavings = (yearlyPriceEur = DEFAULT_YEARLY_PRICE_EUR) =>
  MONTHLY_PRICE_EUR * 12 - yearlyPriceEur;
