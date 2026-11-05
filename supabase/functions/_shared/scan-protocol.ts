/**
 * Protocolo del scan que puede mover el plan generado (días de entrenamiento,
 * proteína por kilo, ajuste calórico y ejercicios clave). La pantalla del scan
 * lo lee para enseñar lo que va a aplicar y generate-plan lo lee para generar
 * exactamente eso: un solo formato, un solo juego de límites.
 *
 * El resto del protocolo (series semanales, cardio, errores a evitar) es
 * informativo y no cambia el plan.
 */

export interface ScanProtocolInput {
  training_days_per_week?: number;
  calorie_adjustment_kcal?: number;
  protein_g_per_kg?: number;
  key_lifts?: string[];
}

export interface ScanProtocolPlan {
  trainingDaysPerWeek?: number;
  proteinPerKg?: number;
  calorieAdjustmentKcal?: number;
  keyLifts: string[];
}

/** Mismos rangos que valida analyze-physique al guardar el scan. */
export const SCAN_PROTOCOL_LIMITS = {
  trainingDaysPerWeek: [2, 7],
  proteinPerKg: [1, 3],
  calorieAdjustmentKcal: [-1000, 1000],
  keyLifts: 6,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const finiteNumber = (value: unknown): number | undefined => {
  const n = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};

const textList = (value: unknown, max: number): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
};

/**
 * Normaliza el protocolo tal como llega del análisis (o del cliente que aplica
 * el scan). Devuelve null si no trae nada que pueda cambiar el plan.
 */
export function parseScanProtocol(value: unknown): ScanProtocolPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const days = finiteNumber(raw.training_days_per_week);
  const protein = finiteNumber(raw.protein_g_per_kg);
  const calorieAdjustment = finiteNumber(raw.calorie_adjustment_kcal);
  const keyLifts = textList(raw.key_lifts, SCAN_PROTOCOL_LIMITS.keyLifts);

  const plan: ScanProtocolPlan = { keyLifts };
  if (days !== undefined) {
    plan.trainingDaysPerWeek = Math.round(clamp(days, ...SCAN_PROTOCOL_LIMITS.trainingDaysPerWeek));
  }
  if (protein !== undefined) {
    plan.proteinPerKg = clamp(protein, ...SCAN_PROTOCOL_LIMITS.proteinPerKg);
  }
  if (calorieAdjustment !== undefined) {
    plan.calorieAdjustmentKcal = clamp(
      calorieAdjustment,
      ...SCAN_PROTOCOL_LIMITS.calorieAdjustmentKcal,
    );
  }

  return plan.trainingDaysPerWeek !== undefined ||
    plan.proteinPerKg !== undefined ||
    plan.calorieAdjustmentKcal !== undefined ||
    plan.keyLifts.length > 0
    ? plan
    : null;
}

/** ¿El protocolo propone algo aplicable al plan? */
export const hasScanProtocolSignal = (value: unknown): boolean => parseScanProtocol(value) !== null;
