// Catálogo de productos Autopilot.
// Los price_id reales NO viven aquí: se leen dinámicamente desde la tabla `settings`
// (price_id_training_* y price_id_full_*) en el edge function create-checkout.

export type PlanKey = "free" | "training" | "full";

export const TIERS = {
  free: {
    key: "free" as const,
    name: "Gratis",
    price: 0,
    interval: "month" as const,
    trial_days: 0,
    tagline: "Prueba una sesión desde el móvil y empieza a registrar tu progreso.",
    features: [
      "Perfil y objetivo de entrenamiento",
      "Sesión de ejemplo para empezar",
      "Registro de series, peso y repeticiones",
      "Progreso básico",
    ],
    notIncluded: ["Chat con entrenador", "Nutrición personalizada"],
    cta: "Crear cuenta gratis",
  },
  training: {
    key: "training" as const,
    name: "Entrenamiento",
    price: 29,
    interval: "month" as const,
    trial_days: 7,
    tagline: "Para quien solo quiere entrenar mejor y dejar de improvisar.",
    features: [
      "Plan preparado por un entrenador real",
      "Adaptado a gimnasio, casa o material disponible",
      "Revisión cada 2 semanas",
      "Chat con entrenador",
      "Respuesta en 48h",
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
      "Entrenamiento preparado por un entrenador real",
      "Nutrición personalizada por tu entrenador",
      "Ajustes de entrenamiento hechos por tu entrenador",
      "Ajustes nutricionales hechos por tu entrenador",
      "Revisión de progreso",
      "Chat con entrenador",
      "Revisión semanal",
      "Respuesta en 24h",
    ],
    notIncluded: [],
    cta: "Probar Completo gratis",
  },
} as const;

// Alias legacy (algunos componentes antiguos lo siguen importando)
export const TIER = TIERS.full;
export type TierKey = "personal";

export const REFERRAL_COUPON_ID = "veaugRi2";

export function getTierByProductId(_productId: string): TierKey | null {
  return "personal";
}

// Etiquetas cortas del plan para el panel de administración.
export const PLAN_LABEL: Record<string, string> = {
  free: "Gratis",
  training: "Entrenamiento · 29€/mes",
  full: "Completo · 49€/mes",
};
