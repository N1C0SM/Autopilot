export interface WorkoutSetInput {
  reps: number;
  weight: string;
}

export interface WorkoutSetLog extends WorkoutSetInput {
  done: boolean;
}

export function createWorkoutSetLogs(
  exercises: Array<{ name: string; series: number; reps: number; weight?: string | null }>,
  previousLogs: Record<string, WorkoutSetLog[]> = {},
): Record<string, WorkoutSetLog[]> {
  return Object.fromEntries(exercises.map((exercise) => [
    exercise.name,
    Array.from({ length: exercise.series }, (_, index) => {
      const previous = previousLogs[exercise.name]?.[index];
      const canReuse = previous?.done && Number.isInteger(previous.reps) && previous.reps > 0;
      return {
        reps: canReuse ? previous.reps : exercise.reps,
        weight: canReuse && typeof previous.weight === "string" ? previous.weight : exercise.weight || "",
        done: false,
      };
    }),
  ]));
}

export function getWorkoutSetInputError(set: WorkoutSetInput): string | null {
  if (!Number.isInteger(set.reps) || set.reps <= 0) {
    return "Introduce al menos una repetición válida antes de marcar la serie.";
  }

  const weight = set.weight.trim().replace(",", ".");
  if (weight !== "" && (!Number.isFinite(Number(weight)) || Number(weight) < 0)) {
    return "Revisa la carga: usa un número válido o déjala vacía para peso corporal.";
  }

  return null;
}
