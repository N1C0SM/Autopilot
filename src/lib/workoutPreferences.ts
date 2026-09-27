export const DEFAULT_REST_SECONDS = 60;
export const REST_PRESETS = [45, 60, 90, 120, 180] as const;

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
