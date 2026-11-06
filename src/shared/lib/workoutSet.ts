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
  /**
   * Serie de calentamiento. También es opcional a propósito: las series ya
   * guardadas no tienen este campo y se leen como series normales de trabajo,
   * sin migración. Solo se escribe cuando la serie es de calentamiento.
   */
  isWarmup?: boolean;
  /** RPE de la serie (1–10), como en la app. Opcional: solo se escribe si se elige. */
  rpe?: number;
  /** Serie llevada al fallo. Opcional: solo se escribe cuando vale `true`. */
  failure?: boolean;
}

export function getWorkoutSetDrops(set: { drops?: WorkoutSetDrop[] }): WorkoutSetDrop[] {
  return Array.isArray(set.drops) ? set.drops : [];
}

/**
 * Una serie es de calentamiento solo si el campo vale exactamente `true`. Cualquier
 * otro valor (incluido el campo ausente de los registros antiguos) es serie de trabajo.
 */
export function isWorkoutSetWarmup(set: { isWarmup?: unknown }): boolean {
  return set.isWarmup === true;
}

/** Marca o desmarca la serie como calentamiento. Al desmarcarla el campo desaparece del JSON guardado. */
export function setWorkoutSetWarmup(set: WorkoutSetLog, warmup: boolean): WorkoutSetLog {
  const next: WorkoutSetLog = { ...set };
  if (warmup) next.isWarmup = true;
  else delete next.isWarmup;
  return next;
}

/** RPE válido de la serie (entero 1–10) o null si no tiene. */
export function getWorkoutSetRpe(set: { rpe?: unknown }): number | null {
  return typeof set.rpe === "number" && Number.isInteger(set.rpe) && set.rpe >= 1 && set.rpe <= 10 ? set.rpe : null;
}

/** Pone o quita el RPE. Sin RPE el campo desaparece del JSON guardado. */
export function setWorkoutSetRpe(set: WorkoutSetLog, rpe: number | null): WorkoutSetLog {
  const next: WorkoutSetLog = { ...set };
  if (rpe !== null && getWorkoutSetRpe({ rpe }) !== null) next.rpe = rpe;
  else delete next.rpe;
  return next;
}

export function isWorkoutSetFailure(set: { failure?: unknown }): boolean {
  return set.failure === true;
}

/** Marca o desmarca la serie como llevada al fallo. Al desmarcarla el campo desaparece. */
export function setWorkoutSetFailure(set: WorkoutSetLog, failure: boolean): WorkoutSetLog {
  const next: WorkoutSetLog = { ...set };
  if (failure) next.failure = true;
  else delete next.failure;
  return next;
}

/** Tocar «Previa»: copia kg y reps de la sesión anterior. Una serie ya hecha no cambia. */
export function copyPreviousIntoSet(set: WorkoutSetLog, previous: WorkoutSetInput & { done?: boolean }): WorkoutSetLog {
  if (set.done || !previous.done) return set;
  return {
    ...set,
    weight: typeof previous.weight === "string" ? previous.weight : set.weight,
    reps: Number.isInteger(previous.reps) && previous.reps > 0 ? previous.reps : set.reps,
  };
}

/**
 * Récords en directo («Ejercicio#índice»): al quitar una serie, los de detrás suben
 * una posición y el de la serie quitada desaparece.
 */
export function reindexLiveRecords(records: Record<string, string>, exerciseName: string, removedIndex: number): Record<string, string> {
  const prefix = `${exerciseName}#`;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(records)) {
    const index = key.startsWith(prefix) ? Number(key.slice(prefix.length)) : NaN;
    if (!Number.isInteger(index)) next[key] = value;
    else if (index < removedIndex) next[key] = value;
    else if (index > removedIndex) next[`${prefix}${index - 1}`] = value;
  }
  return next;
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
        // La marca de calentamiento se copia de la sesión anterior; el resto de
        // series conserva exactamente el mismo formato de siempre.
        ...(canReuse && isWorkoutSetWarmup(previous) ? { isWarmup: true } : {}),
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

/** Peso con el que se confirma una serie: lo escrito manda; si está vacío se usa la sugerencia visible solo si es un peso válido. */
export function resolveConfirmWeight(typed: string, suggested?: string | null): string {
  if (typed.trim()) return typed;
  const s = (suggested ?? "").trim().replace(",", ".");
  return s && Number.isFinite(Number(s)) && Number(s) > 0 ? (suggested ?? "").trim() : typed;
}
