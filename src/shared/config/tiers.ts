// Catálogo de productos Autopilot.
// Los price_id reales NO viven aquí: se leen dinámicamente desde la tabla `settings`
// (price_id_training_* y price_id_full_*) en el edge function create-checkout.
import { DASHBOARD_CHAT_ENABLED } from "../lib/releaseScope";

export type PlanKey = "free" | "training" | "full";

/** Email real de contacto con el entrenador: es el canal que existe hoy. */
export const COACH_CONTACT_EMAIL = "hola@autopilotplan.com";

/**
 * Canal humano que se puede prometer en fichas, FAQs y paywalls. Debe seguir a
 * `DASHBOARD_CHAT_ENABLED` (releaseScope): mientras el chat de cliente esté apagado
 * no se promete chat ni videollamada, se ofrece el email de contacto que ya existe.
 */
export const COACH_CONTACT_CHANNEL = DASHBOARD_CHAT_ENABLED
  ? "por chat en la app"
  : `por email (${COACH_CONTACT_EMAIL})`;

/** Línea de la ficha del plan con el canal real de contacto. */
export const COACH_CONTACT_FEATURE = DASHBOARD_CHAT_ENABLED
  ? "Chat directo con él dentro de la app"
  : `Contacto directo con él ${COACH_CONTACT_CHANNEL}`;

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
      "Calorías y macros para tu objetivo",
      "Scan básico: nota de tu físico, resumen y 2 mejoras",
    ],
    notIncluded: ["Scan avanzado y comidas de cada día", "Progresión automática"],
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
      "Scan avanzado: composición, músculos, postura, protocolo y tu yo futuro",
      "Comidas de cada día según tus gustos y alergias",
      "Progresión de cargas calculada con tus registros",
      "Estadísticas avanzadas de tu evolución",
    ],
    notIncluded: [],
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
      COACH_CONTACT_FEATURE,
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
