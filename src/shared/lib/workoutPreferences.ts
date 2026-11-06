export const DEFAULT_REST_SECONDS = 60;
export const REST_PRESETS = [45, 60, 90, 120, 180] as const;
export type WorkoutView = "list" | "focus";
export const WORKOUT_VIEW_EVENT = "autopilot:workout-view-changed";
const viewKey = (userId: string) => `autopilot:workout-view:${userId}`;
/** La sesión entera en lista por defecto (como la app); ejercicio a ejercicio, solo si se elige. */
export function getWorkoutView(userId: string): WorkoutView {
  try { return localStorage.getItem(viewKey(userId)) === "focus" ? "focus" : "list"; }
  catch { return "list"; }
}
export function setWorkoutView(userId: string, view: WorkoutView) {
  try { localStorage.setItem(viewKey(userId), view); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(WORKOUT_VIEW_EVENT));
  return view;
}

const advancedKey = (userId: string) => `autopilot:workout-advanced:${userId}`;
/** Bajadas y calentamiento: ocultos por defecto para que anotar sea serie, kg y reps. */
export function getWorkoutAdvanced(userId: string): boolean {
  try { return localStorage.getItem(advancedKey(userId)) === "1"; }
  catch { return false; }
}
export function setWorkoutAdvanced(userId: string, on: boolean) {
  try { localStorage.setItem(advancedKey(userId), on ? "1" : "0"); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(WORKOUT_VIEW_EVENT));
  return on;
}

const restKey = (userId: string) => `autopilot:workout-rest:${userId}`;

/** Preferencia global de descanso, o null si el usuario no ha elegido ninguna. */
export const getWorkoutRestPreference = (userId: string): number | null => {
  try {
    const stored = Number(localStorage.getItem(restKey(userId)));
    return Number.isFinite(stored) && stored >= 15 && stored <= 600 ? Math.round(stored) : null;
  } catch {
    return null;
  }
};

export const getWorkoutRestSeconds = (userId: string): number =>
  getWorkoutRestPreference(userId) ?? DEFAULT_REST_SECONDS;

export const setWorkoutRestSeconds = (userId: string, seconds: number) => {
  const safeSeconds = Math.min(600, Math.max(15, Math.round(seconds)));
  localStorage.setItem(restKey(userId), String(safeSeconds));
  return safeSeconds;
};

/** 45 → «45 s», 60 → «1 min», 90 → «1:30» (como `RestFormat` en la app). */
export function formatRestLabel(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60), s = total % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, "0")}`;
}

const exerciseRestKey = (userId: string) => `autopilot:workout-rest-exercise:${userId}`;

/** Descanso elegido para cada ejercicio desde su tarjeta (por usuario, como en la app). */
export function getExerciseRestChoices(userId: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(exerciseRestKey(userId)) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] >= 15 && entry[1] <= 600)
      .map(([name, seconds]) => [name, Math.round(seconds)]));
  } catch {
    return {};
  }
}

/** `null` vuelve al descanso de siempre. Devuelve las elecciones actualizadas. */
export function setExerciseRestChoice(userId: string, exerciseName: string, seconds: number | null): Record<string, number> {
  const next = { ...getExerciseRestChoices(userId) };
  if (seconds === null) delete next[exerciseName];
  else next[exerciseName] = Math.min(600, Math.max(15, Math.round(seconds)));
  try { localStorage.setItem(exerciseRestKey(userId), JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}
