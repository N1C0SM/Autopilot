import type { GymExerciseEntry } from "@/types/training";

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
  const completed = previous?.filter((set) => set.done && Number.parseFloat(set.weight) > 0 && set.reps > 0) || [];
  if (completed.length === 0) return null;

  const lastWeight = Number.parseFloat(completed[completed.length - 1].weight);
  const reachedTarget = completed.length >= exercise.series
    && completed.every((set) => set.reps >= exercise.reps);

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
