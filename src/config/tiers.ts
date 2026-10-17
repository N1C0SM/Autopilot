// Catálogo de productos Autopilot.
// Los price_id reales NO viven aquí: se leen dinámicamente desde la tabla `settings`
// (price_id_training_* y price_id_full_*) en el edge function create-checkout.

export type PlanKey = "free" | "training" | "full";

export const TIERS = {
  free: {
    key: "free" as const,
    name: "Free",
    price: 0,
    interval: "month" as const,
    trial_days: 0,
    tagline: "Tu rutina y tu registro.",
    features: [
      "Rutina inicial según tu objetivo, días y material",
      "Registro de series, repeticiones y kg",
      "Historial, peso y récords",
    ],
    notIncluded: ["Nutrición y progresión automática", "Atención personal"],
    cta: "Empezar gratis",
  },
  training: {
    key: "training" as const,
    name: "Plus",
    price: 14.99,
    interval: "month" as const,
    trial_days: 7,
    recommended: true,
    tagline: "Te dice qué comer y cuánto subir.",
    features: [
      "Todo Free",
      "Plan de nutrición: calorías y macros para tu objetivo",
      "Progresión de cargas calculada con tus registros",
      "Análisis corporal por foto con IA",
      "Estadísticas avanzadas de tu evolución",
    ],
    notIncluded: ["Atención personal"],
    cta: "Elegir Plus",
  },
  full: {
    key: "full" as const,
    name: "Coach",
    price: 49,
    interval: "month" as const,
    trial_days: 7,
    tagline: "Plus + Nicolás revisando tu plan.",
    features: [
      "Todo Plus",
      "Nicolás, fundador, revisa tu plan",
      "Chat directo con él dentro de la app",
      "Ajustes si cambian tus horarios o tu material",
    ],
    notIncluded: [],
    cta: "Elegir Coach",
  },
} as const;

/** Precios centralizados por plan de consumidor. */
export const PLAN_PRICE = { free: TIERS.free.price, plus: TIERS.training.price, coach: TIERS.full.price } as const;
/** Clave de checkout (slot de precio en settings) para cada plan. */
export const PLAN_CHECKOUT_KEY = { plus: "training", coach: "full" } as const;

// Alias legacy (algunos componentes antiguos lo siguen importando)
export const TIER = TIERS.full;
export type TierKey = "personal";

export const REFERRAL_COUPON_ID = "veaugRi2";

export function getTierByProductId(_productId: string): TierKey | null {
  return "personal";
}

// Etiquetas cortas del plan para el panel de administración.
export const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  training: `Plus · ${TIERS.training.price}€/mes`,
  plus: `Plus · ${TIERS.training.price}€/mes`,
  full: `Coach · ${TIERS.full.price}€/mes`,
  coach: `Coach · ${TIERS.full.price}€/mes`,
  transform: "Coach · Transformación",
  personal: `Coach · ${TIERS.full.price}€/mes`,
};
