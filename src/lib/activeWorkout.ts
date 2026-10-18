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
}
export const ACTIVE_WORKOUT_EVENT = "autopilot:active-workout-changed";
const key = (userId: string) => `autopilot:active-session:${userId}`;

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
        set && typeof set.weight === "string" && typeof set.reps === "number" && typeof set.done === "boolean"))) return null;
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