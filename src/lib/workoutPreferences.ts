import { useEffect, useState } from "react";

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

export type WorkoutView = "list" | "focus";
const viewKey = (userId: string) => `autopilot:workout-view:${userId}`;
const VIEW_EVENT = "autopilot:workout-view-changed";
export function getWorkoutView(userId: string): WorkoutView {
  try { return localStorage.getItem(viewKey(userId)) === "focus" ? "focus" : "list"; }
  catch { return "list"; }
}
export function setWorkoutView(userId: string, view: WorkoutView) {
  try { localStorage.setItem(viewKey(userId), view); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(VIEW_EVENT));
}
export function useWorkoutView(userId: string) {
  const [view, setView] = useState(() => getWorkoutView(userId));
  useEffect(() => {
    const refresh = () => setView(getWorkoutView(userId));
    refresh();
    window.addEventListener(VIEW_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(VIEW_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [userId]);
  return view;
}
