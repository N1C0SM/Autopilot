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
    tagline: "Empieza con Autopilot.",
    features: [
      "Onboarding, objetivos y rutina inicial",
      "Registro de entrenamientos, peso y progreso",
      "Historial y seguimiento básico",
      "IA básica",
    ],
    notIncluded: ["Adaptación automática y nutrición", "Entrenador asignado"],
    cta: "Empezar gratis",
  },
  training: {
    key: "training" as const,
    name: "Plus",
    price: 29,
    interval: "month" as const,
    trial_days: 7,
    recommended: true,
    tagline: "Autopilot se adapta a ti.",
    features: [
      "Todo Free",
      "IA avanzada y adaptación automática",
      "Plan de nutrición",
      "Seguimiento y estadísticas avanzadas",
      "Análisis corporal y evolución",
    ],
    notIncluded: ["Entrenador asignado"],
    cta: "Elegir Plus",
  },
  full: {
    key: "full" as const,
    name: "Coach",
    price: 49,
    interval: "month" as const,
    trial_days: 7,
    tagline: "Autopilot + una persona real detrás.",
    features: [
      "Todo Plus",
      "Entrenador asignado",
      "Revisiones y check-ins",
      "Feedback y ajustes humanos",
      "Chat con tu entrenador",
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
