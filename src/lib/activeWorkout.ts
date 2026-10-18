import { useEffect, useState } from "react";
import type { DayPlan } from "@/types/training";
import type { WorkoutSetLog } from "@/lib/workoutSet";
import type { SupersetLinks } from "@/lib/workoutSuperset";

export interface ActiveWorkout {
  version: 1;
  userId: string;
  date: string;
  plan: DayPlan;
  logs: Record<string, WorkoutSetLog[]>;
  expandedExercise: number | null;
  swaps: Record<string, string>;
  supersets: SupersetLinks;
  restChain: number[] | null;
  restDeadline: number | null;
  restTarget: number;
  rpe: number | null;
  updatedAt: number;
}

const key = (userId: string) => `autopilot:active-session:v1:${userId}`;
const EVENT = "autopilot:active-session-changed";
const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const isSet = (v: unknown): boolean => isRecord(v) && typeof v.weight === "string" && typeof v.reps === "number" && Number.isFinite(v.reps) && typeof v.done === "boolean";

export function readActiveWorkout(userId: string): ActiveWorkout | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (!isRecord(v) || v.version !== 1 || v.userId !== userId || typeof v.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)
      || !isRecord(v.plan) || v.plan.type !== "gimnasio" || typeof v.plan.day !== "string" || !Array.isArray(v.plan.exercises)
      || !v.plan.exercises.length || !v.plan.exercises.every((e: unknown) => isRecord(e) && typeof e.name === "string" && typeof e.exercise_id === "string" && typeof e.series === "number" && typeof e.reps === "number")
      || !isRecord(v.logs) || !Object.values(v.logs).every((sets) => Array.isArray(sets) && sets.every(isSet))
      || !isRecord(v.swaps) || !Object.values(v.swaps).every((s) => typeof s === "string") || !isRecord(v.supersets)
      || !(v.restDeadline === null || typeof v.restDeadline === "number" && Number.isFinite(v.restDeadline))
      || typeof v.restTarget !== "number" || !Number.isFinite(v.restTarget)
      || !(v.expandedExercise === null || Number.isInteger(v.expandedExercise))
      || !(v.restChain === null || Array.isArray(v.restChain) && v.restChain.every(Number.isInteger))
      || !(v.rpe === null || typeof v.rpe === "number") || typeof v.updatedAt !== "number") return null;
    return v as unknown as ActiveWorkout;
  } catch { return null; }
}

export function saveActiveWorkout(draft: ActiveWorkout): boolean {
  try {
    localStorage.setItem(key(draft.userId), JSON.stringify(draft));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch { return false; }
}

export function clearActiveWorkout(userId: string) {
  try { localStorage.removeItem(key(userId)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useActiveWorkout(userId?: string) {
  const [draft, setDraft] = useState<ActiveWorkout | null>(() => userId ? readActiveWorkout(userId) : null);
  useEffect(() => {
    const refresh = () => setDraft(userId ? readActiveWorkout(userId) : null);
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [userId]);
  return draft;
}