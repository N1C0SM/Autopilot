import { markEditedDays } from "@/shared/lib/customRoutines";
import { DAYS, type DayPlan, type GymExerciseEntry } from "@/shared/types/training";

/**
 * Valores del editor de rutina (`PlanEditor` + `ExerciseRowEditor` en la web, `PlanEditorView` +
 * `PlanExerciseRow` en la app; el espejo nativo es `PlanEditorValues`, con las mismas reglas y los
 * mismos patrones). Lo guardado se respeta tal cual: unas reps «8-12», «20-60s» o un descanso
 * «75 s» / «2 min» no se convierten al abrir ni al guardar; solo cambian cuando el usuario pulsa
 * − / +, escribe en el campo, cambia entre «Fijo» y «Rango» o elige otro descanso.
 *
 * Al cambiar algo se escribe en el formato del generador de planes: reps «10», «8-12», «30s» o
 * «20-60s» (isométricos en segundos) y descansos «90s», «180s».
 */

// ─── Repeticiones ────────────────────────────────────────────────────────────

/** «» son repeticiones; «s», segundos (isométricos: «20-60s»). */
export type RepsUnit = "" | "s";

/** Reps leídas: un número, un rango o un texto que no se entiende («AMRAP»), que se enseña tal cual. */
export type RepsValue =
  | { kind: "fixed"; value: number; unit: RepsUnit }
  | { kind: "range"; min: number; max: number; unit: RepsUnit }
  | { kind: "text"; text: string; value: number };

/** «10», «8-12», «8 – 12», «30s», «20-60 s». Mismo patrón que `PlanEditorValues.repsPattern`. */
export const REPS_PATTERN = /^(\d{1,3})(?:\s*-\s*(\d{1,3}))?(\s*s)?$/i;

/** Márgenes de − / +: reps de 1 en 1 (1–100) y segundos de 5 en 5 (5–600). `spread` abre un rango desde un número. */
export const repsLimits = (unit: RepsUnit) =>
  unit === "s" ? { min: 5, max: 600, step: 5, spread: 10 } : { min: 1, max: 100, step: 1, spread: 2 };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const firstNumber = (text: string): number | null => {
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : null;
};

/** Reps tal como están guardadas («10», «8-12», «30 s»); sin dato, «10». */
export const repsText = (reps: unknown): string => String(reps ?? "").trim() || "10";

export const parseReps = (reps: unknown): RepsValue => {
  const text = repsText(reps);
  const m = text.replace(/[–—]/g, "-").match(REPS_PATTERN);
  if (!m) return { kind: "text", text, value: firstNumber(text) ?? 10 };
  const a = Number(m[1]);
  const unit: RepsUnit = m[3] ? "s" : "";
  if (m[2] === undefined || Number(m[2]) === a) return { kind: "fixed", value: a, unit };
  const b = Number(m[2]);
  return { kind: "range", min: Math.min(a, b), max: Math.max(a, b), unit };
};

/** Unidad de unas reps leídas (un texto suelto cuenta como repeticiones). */
export const repsUnit = (v: RepsValue): RepsUnit => (v.kind === "text" ? "" : v.unit);

/** Lo que se guarda: «10», «8-12», «30s», «20-60s» (un texto sin tocar, tal cual). */
export const formatReps = (v: RepsValue): string =>
  v.kind === "text" ? v.text : `${v.kind === "fixed" ? v.value : `${v.min}-${v.max}`}${v.unit}`;

/** «Rango» desde un número: se abre a su alrededor («10» → «8-12», «30s» → «20-40s»). */
export const toRange = (v: RepsValue): RepsValue => {
  if (v.kind === "range") return v;
  const unit = repsUnit(v);
  const { min, max, step, spread } = repsLimits(unit);
  const lo = clamp(v.value - spread, min, max - step);
  const hi = clamp(v.value + spread, lo + step, max);
  return { kind: "range", min: lo, max: hi, unit };
};

/** «Fijo» desde un rango: su número central («8-12» → «10», «20-60s» → «40s»). */
export const toFixed = (v: RepsValue): RepsValue => {
  if (v.kind === "fixed") return v;
  if (v.kind === "text") return { kind: "fixed", value: clamp(v.value, 1, 100), unit: "" };
  return { kind: "fixed", value: Math.floor((v.min + v.max + 1) / 2), unit: v.unit };
};

/** Reps en el resumen de la fila: «10 reps», «1 rep», «8-12 reps», «30 s», «20-60 s» o el texto guardado. */
export const repsLabel = (reps: unknown): string => {
  const v = parseReps(reps);
  if (v.kind === "text") return /\p{L}/u.test(v.text) ? v.text : `${v.text} reps`;
  const figure = v.kind === "fixed" ? `${v.value}` : `${v.min}-${v.max}`;
  if (v.unit === "s") return `${figure} s`;
  return `${figure} ${v.kind === "fixed" && v.value === 1 ? "rep" : "reps"}`;
};

/** Lo mismo para VoiceOver: «de 8 a 12 repeticiones», «30 segundos». */
export const repsSpoken = (reps: unknown): string => {
  const v = parseReps(reps);
  if (v.kind === "text") return v.text;
  const noun = v.unit === "s" ? ["segundo", "segundos"] : ["repetición", "repeticiones"];
  if (v.kind === "range") return `de ${v.min} a ${v.max} ${noun[1]}`;
  return `${v.value} ${v.value === 1 ? noun[0] : noun[1]}`;
};

/** Reps nuevas del ejercicio. Una cifra suelta sigue siendo número si el plan ya la tenía como número. */
export const withReps = (ex: GymExerciseEntry, reps: string): GymExerciseEntry => {
  const keepNumber = /^\d+$/.test(reps) && typeof ex.reps !== "string";
  return { ...ex, reps: (keepNumber ? Number(reps) : reps) as GymExerciseEntry["reps"] };
};

// ─── Descanso ────────────────────────────────────────────────────────────────

/** «Otro» descanso: de 10 s a 10 min, de 15 en 15 con − / +. */
export const REST_LIMITS = { min: 10, max: 600, step: 15 } as const;

/** «1:30». Mismo patrón que `PlanEditorValues.restClock`. */
export const REST_CLOCK = /^(\d{1,2}):([0-5]\d)$/;
/** «2 min», «2,5 min», «1 min 30 s». Mismo patrón que `PlanEditorValues.restMinutes`. */
export const REST_MINUTES = /^(\d{1,2}(?:[.,]\d)?)\s*min(?:utos?|s)?\.?(?:\s*(\d{1,2})\s*s)?$/i;
/** «90», «90s», «90 s», «90 seg». Mismo patrón que `PlanEditorValues.restPlain`. */
export const REST_PLAIN = /^(\d{1,3})\s*(?:s|seg|segundos?)?\.?$/i;

/** Segundos de un descanso escrito de cualquier forma («90s», «75 s», «2 min», «1:30»); `null` si no se entiende. */
export const restSeconds = (rest: unknown): number | null => {
  const text = String(rest ?? "").trim();
  let m = text.match(REST_CLOCK);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = text.match(REST_MINUTES);
  if (m) return Math.round(Number(m[1].replace(",", ".")) * 60) + (m[2] ? Number(m[2]) : 0);
  m = text.match(REST_PLAIN);
  return m ? Number(m[1]) : null;
};

/** Lo que se guarda al elegir un descanso: el formato del generador («90s», «180s»). */
export const restValue = (seconds: number): string => `${seconds}s`;

/** Descanso en pantalla: «45 s», «90 s», «2 min», «2,5 min», «3 min». */
export const formatRest = (seconds: number): string =>
  seconds < 120 || seconds % 30 !== 0 ? `${seconds} s` : `${Math.floor(seconds / 60)}${seconds % 60 ? ",5" : ""} min`;

/** Lo mismo para VoiceOver: «90 segundos», «2 minutos», «2,5 minutos». */
export const formatRestSpoken = (seconds: number): string =>
  seconds < 120 || seconds % 30 !== 0
    ? `${seconds} ${seconds === 1 ? "segundo" : "segundos"}`
    : `${Math.floor(seconds / 60)}${seconds % 60 ? ",5" : ""} minutos`;

/** Segundos que se enseñan: los guardados, o 90 si no hay descanso (lo mismo que dice el resumen). */
const shownRest = (rest: unknown): number | null =>
  String(rest ?? "").trim() ? restSeconds(rest) : 90;

/** Descanso en el resumen de la fila («180s» → «3 min»); lo que no se entiende, tal cual. */
export const restLabel = (rest: unknown): string => {
  const s = shownRest(rest);
  return s === null ? String(rest).trim() : formatRest(s);
};

export const restSpoken = (rest: unknown): string => {
  const s = shownRest(rest);
  return s === null ? String(rest).trim() : formatRestSpoken(s);
};

/** ¿El descanso es uno de los rápidos? Si no («75 s», «45s»), se ve elegido «Otro», sin cambiarlo. */
export const restIsQuick = (rest: unknown, quick: readonly number[]): boolean => {
  const s = shownRest(rest);
  return s !== null && quick.includes(s);
};

/** Número del que parte el contador de «Otro»: los segundos guardados, su primera cifra o 90. */
export const restBase = (rest: unknown): number =>
  shownRest(rest) ?? firstNumber(String(rest ?? "")) ?? 90;

// ─── Peso ────────────────────────────────────────────────────────────────────

/** Peso en pantalla con coma decimal («62.5» → «62,5»); también si el plan lo guardó como número. */
export const weightText = (weight: unknown): string => String(weight ?? "").replace(".", ",");

/**
 * Peso escrito («62,5»): solo cifras y una coma decimal, guardado con punto («62.5»). Una segunda
 * coma no cuenta («62,5,» sigue siendo «62.5»). Es `PlanEditorValues.typedWeight` en la app.
 */
export const typedWeight = (text: string): string => {
  const [whole, ...decimals] = text.replace(/[^\d.,]/g, "").replace(/,/g, ".").split(".");
  return decimals.length ? `${whole}.${decimals.join("")}` : whole;
};

// ─── Fila y plan ─────────────────────────────────────────────────────────────

export const seriesLabel = (series: unknown): string => {
  const n = Number(series) || 0;
  return `${n} ${n === 1 ? "serie" : "series"}`;
};

/** «3 series · 8-12 reps · 90 s» (y «1 serie», «20-60 s», «3 min»). Es `PlanEditorValues.summary` en la app. */
export const exerciseSummary = (ex: Pick<GymExerciseEntry, "series" | "reps" | "rest">): string =>
  [seriesLabel(ex.series), repsLabel(ex.reps), restLabel(ex.rest)].join(" · ");

/** «Remo con barra: 4 series, de 8 a 12 repeticiones, descanso de 75 segundos». Es `PlanEditorValues.spoken`. */
export const exerciseSpoken = (ex: Pick<GymExerciseEntry, "name" | "series" | "reps" | "rest">): string =>
  `${ex.name}: ${seriesLabel(ex.series)}, ${repsSpoken(ex.reps)}, descanso de ${restSpoken(ex.rest)}`;

/** Clave estable de cada fila (no su posición): al subirla o bajarla sigue abierta. */
export const rowKeys = (list: readonly Pick<GymExerciseEntry, "exercise_id" | "name">[]): string[] => {
  const seen = new Map<string, number>();
  return list.map((ex) => {
    const base = `${ex.exercise_id}|${ex.name}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
};

const dayIdx = (d: string) => DAYS.indexOf(d as (typeof DAYS)[number]);

/** Orden lunes→domingo y fuera los días de gimnasio vacíos (son descanso). */
export const normalizePlan = (plans: DayPlan[]): DayPlan[] =>
  plans
    .filter((p) => p.type === "actividad" || (p.exercises?.length ?? 0) > 0)
    .sort((a, b) => dayIdx(a.day) - dayIdx(b.day));

/**
 * Lo que se guarda en `training_plan.workouts_json`: el borrador ordenado, sin tocar sus valores, y
 * marcado como tuyo SOLO en los días nuevos o cambiados respecto a `original` (`markEditedDays`).
 * Antes se marcaban todos y el piloto automático dejaba de adaptar sesiones que nadie había tocado.
 */
export const planToSave = (draft: DayPlan[], original: readonly DayPlan[] = []): DayPlan[] =>
  markEditedDays(normalizePlan([...original]), normalizePlan(draft));
