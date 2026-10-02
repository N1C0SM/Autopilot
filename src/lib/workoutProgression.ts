import type { GymExerciseEntry } from "@/types/training";
import { parsePositiveWeight } from "./weight";

interface LoggedSet {
  reps: number;
  weight: string;
  done: boolean;
}

export interface ProgressionSuggestion {
  label: "Subir" | "Mantener" | "Repetir";
  weight: string;
  reason: string;
}

const incrementFor = (weight: number) => (weight >= 40 ? 2.5 : 1.25);

export const getProgressionSuggestion = (
  exercise: GymExerciseEntry,
  previous: LoggedSet[] | undefined,
): ProgressionSuggestion | null => {
  const completed = previous?.flatMap((set) => {
    if (!set.done || !Number.isFinite(set.reps) || set.reps <= 0) return [];
    const weight = parsePositiveWeight(set.weight);
    return weight === null ? [] : [{ ...set, weight }];
  }) || [];
  if (completed.length === 0) return null;

  const prescribedSets = completed.slice(0, exercise.series);
  const lastWeight = prescribedSets[prescribedSets.length - 1]?.weight;
  if (lastWeight === undefined) return null;
  const reachedTarget = prescribedSets.length === exercise.series
    && prescribedSets.every((set) => set.reps >= exercise.reps);

  if (!reachedTarget) {
    return {
      label: "Repetir",
      weight: String(lastWeight),
      reason: `Mantén ${lastWeight} kg hasta completar ${exercise.reps} reps en todas las series.`,
    };
  }

  const nextWeight = Math.round((lastWeight + incrementFor(lastWeight)) * 100) / 100;
  return {
    label: "Subir",
    weight: String(nextWeight),
    reason: `Completaste ${exercise.reps} reps en todas las series: prueba ${nextWeight} kg.`,
  };
};
