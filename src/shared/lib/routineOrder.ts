import type { DayPlan } from "@/shared/types/training";

/**
 * Orden de la rutina. El plan guarda cada sesión con un día de la semana como clave
 * (`DayPlan.day`), pero esa clave solo fija el ORDEN: cualquier sesión se puede hacer
 * cualquier día. `day_completions.day_label` guarda la sesión hecha y `completed_at`
 * el día real, así que la siguiente sesión sale de lo hecho esta semana.
 * Es `RoutineOrder` en la app nativa (`native/Autopilot/Core/Training.swift`).
 */
export const ROUTINE_KEYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const isSession = (plan: DayPlan) => plan.type === "gimnasio" || plan.type === "actividad";

/** Sesiones del plan (gimnasio o actividad) en el orden de la rutina, sin días vacíos. */
export function routineSessions(plans: readonly DayPlan[]): DayPlan[] {
  return ROUTINE_KEYS.flatMap((key) => {
    const plan = plans.find((candidate) => candidate.day === key && isSession(candidate));
    return plan ? [plan] : [];
  });
}

/** La siguiente sesión: la primera de la rutina que aún no se ha hecho esta semana (null si están todas). */
export function nextPendingSession(sessions: readonly DayPlan[], doneThisWeek: readonly string[]): DayPlan | null {
  return sessions.find((session) => !doneThisWeek.includes(session.day)) ?? null;
}

/** Sesiones de la rutina hechas esta semana (cada una cuenta una vez). */
export function doneSessionCount(sessions: readonly DayPlan[], doneThisWeek: readonly string[]): number {
  return sessions.filter((session) => doneThisWeek.includes(session.day)).length;
}
