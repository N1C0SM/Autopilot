import type { DayPlan } from "./training-types.ts";

/**
 * Rutinas propias y piloto automático en un mismo plan (`training_plan.workouts_json`).
 *
 * Regla: una rutina del usuario (`custom: true`) NUNCA se pierde ni se reescribe, ni su contenido ni
 * su clave de orden, tampoco con `force`. El piloto automático solo rehace sus propias sesiones: las
 * pone en las claves libres, hasta los días de entreno que eligió el usuario y con un máximo de 7
 * sesiones en total. Sus rutinas cuentan para los dos límites.
 *
 * Sin imports de Deno: lo usa `generate-plan` y lo prueba vitest (`src/shared/lib/planMerge.test.ts`).
 */

/** Claves de orden (0 = lunes … 6 = domingo): las mismas que `ROUTINE_KEYS` de la web y `DAYS` del generador. */
export const PLAN_KEYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
/** Como mucho siete sesiones en el plan. */
export const MAX_PLAN_SESSIONS = PLAN_KEYS.length;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** ¿Es una rutina del usuario? La marca el editor y el servidor nunca la quita. */
export const isCustomDay = (day: unknown): day is DayPlan => isObject(day) && day.custom === true;

const isSession = (day: unknown): day is DayPlan =>
  isObject(day) && (day.type === "gimnasio" || day.type === "actividad");

/** Posición de su clave (0 = lunes) o -1 si la entrada no usa una clave del plan. */
export const keyIndex = (day: unknown): number =>
  isObject(day) && typeof day.day === "string" ? (PLAN_KEYS as readonly string[]).indexOf(day.day) : -1;

const byKey = (a: unknown, b: unknown) => {
  const ka = keyIndex(a);
  const kb = keyIndex(b);
  return (ka < 0 ? MAX_PLAN_SESSIONS : ka) - (kb < 0 ? MAX_PLAN_SESSIONS : kb);
};

/** Rutinas del usuario, tal cual vienen (el mismo objeto, sin copiar ni tocar nada). */
export const customDays = (plan: readonly unknown[]): DayPlan[] => plan.filter(isCustomDay);

/** Sesiones del piloto automático: todo lo que es una sesión y no es del usuario. */
export const autopilotDays = (plan: readonly unknown[]): DayPlan[] =>
  plan.filter((day): day is DayPlan => isSession(day) && !isCustomDay(day));

/**
 * Cuenta gratis: su rutina inicial del piloto llega una sola vez. Un plan sin ninguna sesión del
 * piloto (vacío o solo con rutinas propias) aún no la tiene, así que se prepara alrededor de las suyas.
 */
export const hasAutopilotSessions = (plan: readonly unknown[]): boolean => autopilotDays(plan).length > 0;

/** Claves (0 = lunes) que ocupan las rutinas del usuario. */
export const takenKeys = (custom: readonly unknown[]): Set<number> =>
  new Set(custom.map(keyIndex).filter((index) => index >= 0));

/** Días de entreno válidos: un entero entre 0 y 7 (lo que no es un número, 0). */
export const clampFrequency = (frequency: number): number =>
  Number.isFinite(frequency) ? Math.min(Math.max(Math.floor(frequency), 0), MAX_PLAN_SESSIONS) : 0;

/**
 * Sesiones que prepara el piloto: los días de entreno (máximo 7) menos las rutinas del usuario.
 * 0 cuando sus rutinas ya cubren sus días.
 */
export function autopilotSlots(frequency: number, custom: readonly unknown[]): number {
  return Math.max(0, clampFrequency(frequency) - takenKeys(custom).size);
}

/**
 * Claves para las sesiones del piloto, de menor a mayor: primero los días que eligió el usuario y
 * están libres; si no bastan, el resto de claves libres. Las de sus rutinas, nunca.
 */
export function autopilotKeys(custom: readonly unknown[], chosenDays: readonly number[], slots: number): number[] {
  const taken = takenKeys(custom);
  const all = PLAN_KEYS.map((_, index) => index);
  const preferred = all.filter((index) => chosenDays.includes(index) && !taken.has(index));
  const rest = all.filter((index) => !taken.has(index) && !preferred.includes(index));
  return [...preferred, ...rest].slice(0, Math.max(0, Math.floor(slots))).sort((a, b) => a - b);
}

/** Lo que va a hacer el piloto automático con un plan. */
export interface AutopilotRun {
  /** Rutinas del usuario, intactas. */
  kept: DayPlan[];
  /** Sesiones que prepara el piloto (0 si las rutinas del usuario ya cubren sus días). */
  slots: number;
  /** Claves libres donde las pone (0 = lunes), de menor a mayor. */
  keys: number[];
  /** Hay rutinas del usuario y ya cubren sus días de entreno: el piloto no añade nada. */
  full: boolean;
}

/**
 * Qué rehace el piloto automático. `force` (lo mandaban los clientes antiguos para sustituir el plan)
 * no amplía nada: las rutinas del usuario se quedan igual y solo se rehacen las sesiones del piloto.
 */
export function planAutopilotRun(
  current: readonly unknown[],
  options: { frequency: number; chosenDays?: readonly number[]; force?: boolean },
): AutopilotRun {
  const kept = customDays(current);
  const slots = autopilotSlots(options.frequency, kept);
  return { kept, slots, keys: autopilotKeys(kept, options.chosenDays ?? [], slots), full: kept.length > 0 && slots === 0 };
}

/**
 * Plan final. Las rutinas del usuario se quedan como estaban (mismo contenido y misma clave); las
 * sesiones nuevas del piloto entran en las claves libres sin pasar de sus días de entreno ni de 7, y
 * las viejas del piloto se van. En el orden de la semana; lo que no tiene clave del plan, al final.
 * Se vuelve a llamar con el plan recién leído justo antes de guardar: si el usuario guardó otra
 * rutina mientras tanto, también se queda.
 */
export function mergePlan(current: readonly unknown[], generated: readonly DayPlan[], frequency: number): DayPlan[] {
  const kept = customDays(current);
  const taken = takenKeys(kept);
  const room = autopilotSlots(frequency, kept);
  const used = new Set<number>();
  const fresh: DayPlan[] = [];
  for (const day of [...generated].sort(byKey)) {
    const key = keyIndex(day);
    if (fresh.length >= room || key < 0 || taken.has(key) || used.has(key) || !isSession(day)) continue;
    used.add(key);
    const { custom: _custom, ...session } = day;
    fresh.push(session);
  }
  return [...kept, ...fresh].sort(byKey);
}
