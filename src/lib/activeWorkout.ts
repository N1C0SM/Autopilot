import type { DayPlan } from "@/types/training";
import type { WorkoutSetLog } from "./workoutSet";
import type { SupersetLinks } from "./workoutSuperset";

export interface ActiveWorkout {
  version: 1;
  userId: string;
  date: string;
  plan: DayPlan;
  logs: Record<string, WorkoutSetLog[]>;
  swaps: Record<string, string>;
  supersetLinks: SupersetLinks;
  expandedExercise: number | null;
  restEndsAt: number | null;
  restTarget: number;
  /** Absolute session start (ms). Optional for drafts saved before the session clock existed. */
  startedAt?: number;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Short soft tone when rest ends; silent if audio is unavailable or blocked. */
export function playRestBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25].forEach((offset) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.2);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch { /* noop */ }
}
export const ACTIVE_WORKOUT_EVENT = "autopilot:active-workout-changed";
const key = (userId: string) => `autopilot:active-session:${userId}`;

/** Fecha local YYYY-MM-DD, la misma que se guarda en workout_logs.day_label/logged_at. */
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** True si el borrador corresponde al día de hoy. */
export function isActiveWorkoutToday(workout: ActiveWorkout | null, now = new Date()): boolean {
  return Boolean(workout) && workout!.date === localDateKey(now);
}

/** «lunes 13», para avisar de una sesión abierta de otro día. */
export function formatDraftDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date(year, month - 1, day));
}

export function remainingRestSeconds(endsAt: number | null, now = Date.now()): number | null {
  if (endsAt === null) return null;
  const remaining = Math.ceil((endsAt - now) / 1000);
  return remaining > 0 ? remaining : null;
}

export function readActiveWorkout(userId: string): ActiveWorkout | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(userId)) || "null");
    if (!value || value.version !== 1 || value.userId !== userId || typeof value.date !== "string"
      || !value.plan || value.plan.type !== "gimnasio" || !Array.isArray(value.plan.exercises)
      || !value.logs || typeof value.logs !== "object" || Array.isArray(value.logs)
      || !Object.values(value.logs).every((sets) => Array.isArray(sets) && sets.every((set) =>
        set && typeof set.weight === "string" && (typeof set.reps === "number" || typeof set.reps === "string") && typeof set.done === "boolean"))) return null;
    return value as ActiveWorkout;
  } catch { return null; }
}

export function saveActiveWorkout(workout: ActiveWorkout): boolean {
  try {
    localStorage.setItem(key(workout.userId), JSON.stringify(workout));
    window.dispatchEvent(new Event(ACTIVE_WORKOUT_EVENT));
    return true;
  } catch { return false; }
}

export function clearActiveWorkout(userId: string) {
  try { localStorage.removeItem(key(userId)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(ACTIVE_WORKOUT_EVENT));
}
/** Borra la cola local de series sin sincronizar; ambos flujos de descarte deben llamarla. */
export function clearPendingOfflineSeries(userId: string) {
  try { localStorage.removeItem(`autopilot:series-pendientes:${userId}`); } catch { /* sin almacenamiento */ }
}
