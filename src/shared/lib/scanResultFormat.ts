import { formatDecimal } from "@/shared/lib/numberFormat";
import { groupedInt } from "@/shared/lib/workoutSummaryFormat";

/**
 * Formato del resultado del scan y de su imagen para compartir. Puro: las mismas reglas que
 * `ScanFormat` en la app (ScanView.swift), para que la web, el iPhone y el Mac digan lo mismo.
 */

/** Resultado de `analyze-physique` (lo que pintan las tarjetas del scan). */
export type ScanResultData = {
  physique?: number | null;
  potential?: number | null;
  attractiveness?: number | null;
  style?: number | null;
  similarity?: number | null;
  months_with_plan?: number | null;
  months_without_plan?: number | null;
  estimated_months?: number | null;
  summary?: string | null;
  headline_diagnosis?: string | null;
  bottleneck?: string | null;
  improvements?: { label?: string | null; priority?: string | null }[] | null;
  basic?: boolean | null;
  locked_sections?: string[] | null;
  body_composition?: {
    body_fat_pct?: number | null; lean_mass_kg?: number | null; weight_kg?: number | null;
    somatotype?: string | null; frame_size?: string | null; fat_distribution?: string | null;
  } | null;
  muscle_breakdown?: { group: string; score: number; verdict?: string | null }[] | null;
  posture?: { issues?: string[] | null; severity?: string | null; note?: string | null } | null;
  proportions?: {
    shoulder_to_waist_ratio?: number | null; v_taper_score?: number | null; symmetry_score?: number | null;
    upper_lower_balance?: string | null; weakest_link?: string | null;
  } | null;
  genetic_markers?: string[] | null;
  protocol?: {
    training_days_per_week?: number | null; weekly_sets_priority?: number | null; calorie_adjustment_kcal?: number | null;
    protein_g_per_kg?: number | null; cardio_minutes_per_week?: number | null; key_lifts?: string[] | null; avoid?: string[] | null;
  } | null;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * «Tu objetivo» del scan: el nombre del objetivo guardado en `onboarding.goal` (los del
 * configurador y los de Ajustes). Igual que el diccionario de `ScanView.swift`; sin objetivo
 * conocido, la tarjeta dice «Sin definir».
 */
export const SCAN_GOAL_LABELS: Record<string, string> = {
  lose_weight: "Perder peso",
  gain_muscle: "Ganar músculo",
  improve_endurance: "Mejorar resistencia",
  recomp: "Recomposición",
  general_health: "Fuerza y salud",
};

/** Nota de 0 a 10 con coma decimal («7,4»); sin dato, «—» (un 0 parecería una nota real). */
export const scoreText = (v?: number | null): string => (isNum(v) ? formatDecimal(v, 1) : "—");

/**
 * Notas con « · » que no se parten mal: cada trozo corto va entero («Menos de 1 minuto», «Sin
 * registro»), una cifra nunca se separa de sus palabras y el «·» no empieza línea. Igual que
 * `ScanFormat.keepTogether` en la app.
 */
export const keepTogether = (s: string): string =>
  s.split(" · ")
    .map((part) => (part.length <= 24 ? part.replace(/ /g, "\u00A0") : part.replace(/ (\d[\d.,]*) /g, "\u00A0$1\u00A0")))
    .join("\u00A0· ");

/** Primera letra en mayúscula (la IA a veces escribe «ectomorfo»). */
export const sentence = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** «1 mes» / «6 meses». */
export const monthsText = (n: number): string => `${groupedInt(n)} ${Math.round(n) === 1 ? "mes" : "meses"}`;

/** «+300 kcal», «−250 kcal», «0 kcal» (con el signo menos tipográfico). */
export const signedKcal = (n: number): string => `${n > 0 ? "+" : ""}${groupedInt(n)} kcal`;

/** Meses hasta el físico objetivo: solo existen si se eligió un objetivo (el servidor los quita si no). */
export function objectiveMonths(r: ScanResultData): { withPlan: number; withoutPlan: number | null } | null {
  const m = isNum(r.months_with_plan) ? r.months_with_plan : isNum(r.estimated_months) ? r.estimated_months : null;
  if (m === null) return null;
  const withPlan = Math.max(1, Math.round(m));
  const without = isNum(r.months_without_plan) ? Math.max(withPlan + 1, Math.round(r.months_without_plan)) : null;
  return { withPlan, withoutPlan: without };
}

/** «Prioridad alta» en dorado; media y baja en gris. */
export const isHighPriority = (p?: string | null): boolean => !!p && /alta/i.test(p);

/** Mejoras sin repetir «Lo que más te frena» (la IA a veces lo pone también como primer punto). */
export function improvementList(r: ScanResultData): { label: string; priority: string | null }[] {
  const top = r.bottleneck?.trim().toLowerCase();
  return (r.improvements ?? [])
    .map((m) => ({ label: (m.label ?? "").trim(), priority: m.priority?.trim() || null }))
    .filter((m) => m.label && m.label.toLowerCase() !== top);
}

/** Posición de una nota en su barra (0–1). El ratio hombro/cintura llena la barra en 1,8. */
export const meterFraction = (value: number, max = 10): number => Math.max(0, Math.min(1, value / max));

/* ===== Imagen para compartir (1080 × 1920 en la web, 360 × 640 a ×3 en la app) ===== */

export const SCAN_SHARE_COPY = {
  title: "Mi análisis físico",
  subtitle: "Estimación visual con IA",
  hero: "Físico",
  focus: "Foco",
} as const;

/** Tres cifras al pie: Potencial siempre primero; con composición, la grasa estimada. */
export function scanShareStats(r: ScanResultData): [string, string][] {
  const fat = r.body_composition?.body_fat_pct;
  const stats: [string, number | null | undefined][] = isNum(fat)
    ? [["Potencial", r.potential], ["Grasa est.", fat], ["Atractivo", r.attractiveness]]
    : [["Potencial", r.potential], ["Atractivo", r.attractiveness], ["Estilo", r.style]];
  return stats
    .filter((s): s is [string, number] => isNum(s[1]))
    .map(([label, v]) => [label, label === "Grasa est." ? `${formatDecimal(v, 1)} %` : formatDecimal(v, 1)]);
}

/** La frase del diagnóstico (o el resumen), sin espacios sobrantes. */
export const scanShareHeadline = (r: ScanResultData): string | null =>
  [r.headline_diagnosis, r.summary].map((t) => t?.trim() ?? "").find(Boolean) || null;

/** Lo primero que trabajar: la mejora de prioridad alta o, si no, la primera («Espalda alta», con mayúscula). */
export function scanShareFocus(r: ScanResultData): string | null {
  const list = improvementList(r);
  const focus = (list.find((m) => isHighPriority(m.priority)) ?? list[0])?.label || r.bottleneck?.trim() || null;
  return focus ? sentence(focus) : null;
}

/** Fecha corta de la cabecera: «19 nov 2026». */
export const scanShareDate = (d = new Date()): string =>
  d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");
