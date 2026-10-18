export const DEFAULT_REST_SECONDS = 60;
export const REST_PRESETS = [45, 60, 90, 120, 180] as const;
export type WorkoutView = "list" | "focus";
export const WORKOUT_VIEW_EVENT = "autopilot:workout-view-changed";
const viewKey = (userId: string) => `autopilot:workout-view:${userId}`;
export function getWorkoutView(userId: string): WorkoutView {
  try { return localStorage.getItem(viewKey(userId)) === "focus" ? "focus" : "list"; }
  catch { return "list"; }
}
export function setWorkoutView(userId: string, view: WorkoutView) {
  try { localStorage.setItem(viewKey(userId), view); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(WORKOUT_VIEW_EVENT));
  return view;
}

const restKey = (userId: string) => `autopilot:workout-rest:${userId}`;

export const getWorkoutRestSeconds = (userId: string): number => {
  const stored = Number(localStorage.getItem(restKey(userId)));
  return Number.isFinite(stored) && stored >= 15 && stored <= 600
    ? Math.round(stored)
    : DEFAULT_REST_SECONDS;
};

export const setWorkoutRestSeconds = (userId: string, seconds: number) => {
  const safeSeconds = Math.min(600, Math.max(15, Math.round(seconds)));
  localStorage.setItem(restKey(userId), String(safeSeconds));
  return safeSeconds;
};
