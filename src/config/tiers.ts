// Catálogo de productos Autopilot.
// Los price_id reales NO viven aquí: se leen dinámicamente desde la tabla `settings`
// (price_id_training_*, price_id_full_*, price_id_transform_*) en el edge function create-checkout.

export type PlanKey = "training" | "full" | "transform";

export const TIERS = {
  training: {
    key: "training" as const,
    name: "Entrenamiento",
    price: 29,
    interval: "month" as const,
    trial_days: 7,
    tagline: "Para quien solo quiere entrenar mejor y dejar de improvisar.",
    features: [
      "Plan de entrenamiento personalizado",
      "Adaptado a gimnasio, casa o material disponible",
      "Ajustes del plan",
      "Chat con entrenador",
      "Seguimiento básico",
      "Revisión de progreso",
    ],
    notIncluded: ["Nutrición personalizada"],
    cta: "Probar Entrenamiento gratis",
  },
  full: {
    key: "full" as const,
    name: "Completo",
    price: 49,
    interval: "month" as const,
    trial_days: 7,
    recommended: true,
    tagline:
      "Para quien quiere mejorar físico de verdad combinando entrenamiento, nutrición y seguimiento.",
    features: [
      "Plan de entrenamiento personalizado",
      "Plan de nutrición adaptado",
      "Ajustes de entrenamiento",
      "Ajustes nutricionales",
      "Revisión de progreso",
      "Chat con entrenador",
      "Seguimiento humano",
    ],
    notIncluded: [],
    cta: "Probar Completo gratis",
  },
  transform: {
    key: "transform" as const,
    name: "Transformación 12 semanas",
    price: 299,
    interval: "one_time" as const,
    trial_days: 0,
    tagline:
      "Para quien quiere un acompañamiento más cercano, check-ins semanales y un plan completo de 12 semanas con entrenamiento, nutrición y seguimiento prioritario.",
    features: [
      "Entrenamiento durante 12 semanas",
      "Nutrición durante 12 semanas",
      "Check-in semanal",
      "Revisión de fotos y medidas",
      "Chat prioritario",
      "Llamada inicial",
      "Ajustes semanales",
    ],
    notIncluded: [],
    cta: "Hablar con un asesor",
  },
} as const;

// Alias legacy (algunos componentes antiguos lo siguen importando)
export const TIER = TIERS.full;
export type TierKey = "personal";

export const REFERRAL_COUPON_ID = "veaugRi2";

export function getTierByProductId(_productId: string): TierKey | null {
  return "personal";
}
