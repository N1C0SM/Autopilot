export interface WorkoutSetInput {
  reps: number;
  weight: string;
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
