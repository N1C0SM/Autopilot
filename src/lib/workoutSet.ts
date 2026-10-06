export interface WorkoutSetInput {
  reps: number;
  weight: string;
}

/** Una bajada del dropset: se hace justo después del segmento anterior, sin descansar. */
export interface WorkoutSetDrop {
  reps: number;
  weight: string;
}

export interface WorkoutSetLog extends WorkoutSetInput {
  done: boolean;
  /**
   * Bajadas del dropset. Es opcional a propósito: las series que ya están
   * guardadas en `workout_logs.sets_completed` no tienen este campo y se leen
   * como series sin bajadas, sin migración ni errores.
   */
  drops?: WorkoutSetDrop[];
}

export function getWorkoutSetDrops(set: { drops?: WorkoutSetDrop[] }): WorkoutSetDrop[] {
  return Array.isArray(set.drops) ? set.drops : [];
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
      const drops = canReuse ? getWorkoutSetDrops(previous) : [];
      return {
        reps: canReuse ? previous.reps : exercise.reps,
        weight: canReuse && typeof previous.weight === "string" ? previous.weight : exercise.weight || "",
        done: false,
        // Solo las series que de verdad tenían bajadas llevan el campo: el resto
        // conserva exactamente el mismo formato de siempre.
        ...(drops.length > 0 ? { drops: drops.map((drop) => ({ ...drop })) } : {}),
      };
    }),
  ]));
}

export function addWorkoutSetDrop(set: WorkoutSetLog): WorkoutSetLog {
  const drops = getWorkoutSetDrops(set);
  const reference = drops[drops.length - 1] ?? set;
  return { ...set, drops: [...drops, { weight: "", reps: reference.reps }] };
}

export function updateWorkoutSetDrop(
  set: WorkoutSetLog,
  dropIndex: number,
  patch: Partial<WorkoutSetDrop>,
): WorkoutSetLog {
  const drops = getWorkoutSetDrops(set);
  if (dropIndex < 0 || dropIndex >= drops.length) return set;
  return {
    ...set,
    drops: drops.map((drop, index) => (index === dropIndex ? { ...drop, ...patch } : drop)),
  };
}

/** Quita una bajada. Al quedarse sin bajadas el campo desaparece del JSON guardado. */
export function removeWorkoutSetDrop(set: WorkoutSetLog, dropIndex: number): WorkoutSetLog {
  const drops = getWorkoutSetDrops(set).filter((_, index) => index !== dropIndex);
  const next: WorkoutSetLog = { ...set };
  if (drops.length > 0) next.drops = drops;
  else delete next.drops;
  return next;
}

/** Resumen legible de la serie entera: "80 × 8 + 60 × 8 + 40 × 10". */
export function formatWorkoutSetSummary(set: WorkoutSetInput & { drops?: WorkoutSetDrop[] }): string {
  const segments: WorkoutSetInput[] = [set, ...getWorkoutSetDrops(set)];
  return segments.map((segment) => `${segment.weight.trim() || "—"} × ${segment.reps}`).join(" + ");
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

export function getWorkoutSetDropInputError(drop: WorkoutSetDrop): string | null {
  if (!Number.isInteger(drop.reps) || drop.reps <= 0) {
    return "Cada bajada necesita al menos una repetición válida antes de marcar la serie.";
  }

  const weight = drop.weight.trim().replace(",", ".");
  if (weight !== "" && (!Number.isFinite(Number(weight)) || Number(weight) < 0)) {
    return "Revisa la carga de las bajadas: usa un número válido o déjala vacía.";
  }

  return null;
}

export function getWorkoutSetDropsInputError(set: { drops?: WorkoutSetDrop[] }): string | null {
  for (const drop of getWorkoutSetDrops(set)) {
    const error = getWorkoutSetDropInputError(drop);
    if (error) return error;
  }

  return null;
}
