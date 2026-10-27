import type { GymExerciseEntry } from "@/shared/types/training";
import { parsePositiveWeight } from "@/shared/lib/weight";

interface LoggedSet {
  reps: number;
  weight: string;
  done: boolean;
}

export interface ProgressionSuggestion {
  label: "Subir" | "Mantener" | "Repetir" | "Añadir rep";
  weight: string;
  reason: string;
}

export interface ProgressionSet {
  reps: number;
  weight: string;
  done: boolean;
}

export function applyProgressionToPendingSets(
  sets: ProgressionSet[],
  suggestion: ProgressionSuggestion,
): ProgressionSet[] {
  return sets.map((set) => {
    if (set.done) return set;
    if (suggestion.label === "Añadir rep") return { ...set, reps: set.reps + 1 };
    if (suggestion.weight !== "") return { ...set, weight: suggestion.weight };
    return set;
  });
}

const formatKg = (weight: number) => weight.toLocaleString("es-ES", { maximumFractionDigits: 2 });

/**
 * Resumen real de la sesión anterior para explicar la sugerencia («Última vez: 8 · 8 · 7 reps con 60 kg»).
 * Solo usa series marcadas como hechas; devuelve null si no hay datos.
 */
export const summarizePreviousSets = (previous: LoggedSet[] | undefined): string | null => {
  const done = previous?.filter((set) => set.done && Number.isFinite(set.reps) && set.reps > 0) || [];
  if (done.length === 0) return null;
  const reps = done.map((set) => set.reps).join(" · ");
  const weights = done.map((set) => parsePositiveWeight(set.weight));
  const loaded = weights.filter((weight): weight is number => weight !== null);
  if (loaded.length === 0) return `Última vez: ${reps} reps`;
  const same = loaded.length === done.length && loaded.every((weight) => weight === loaded[0]);
  if (same) return `Última vez: ${reps} reps con ${formatKg(loaded[0])} kg`;
  return `Última vez: ${reps} reps con ${formatKg(Math.min(...loaded))}–${formatKg(Math.max(...loaded))} kg`;
};

export const getProgressionSuggestion = (
  exercise: GymExerciseEntry,
  previous: LoggedSet[] | undefined,
  previousRpe?: number | null,
): ProgressionSuggestion | null => {
  const completed = previous?.flatMap((set) => {
    if (!set.done || !Number.isFinite(set.reps) || set.reps <= 0) return [];
    const weight = parsePositiveWeight(set.weight);
    return [{ ...set, rawWeight: set.weight, weight }];
  }) || [];
  if (completed.length === 0) return null;

  const prescribedSets = completed.slice(0, exercise.series);
  const weights = prescribedSets.map((set) => set.weight);
  const loadedWeights = weights.filter((weight): weight is number => weight !== null);
  const lastWeight = loadedWeights[loadedWeights.length - 1];
  const reachedTarget = prescribedSets.length === exercise.series
    && prescribedSets.every((set) => set.reps >= exercise.reps);

  if (prescribedSets.length !== exercise.series) {
    return {
      label: "Repetir",
      weight: lastWeight === undefined ? "" : String(lastWeight),
      reason: `Registra las ${exercise.series} series previstas antes de aumentar la dificultad.`,
    };
  }

  const hasInvalidWeight = prescribedSets.some((set) => {
    const rawWeight = set.rawWeight.trim().replace(",", ".");
    return rawWeight !== "" && (!Number.isFinite(Number(rawWeight)) || Number(rawWeight) < 0);
  });
  if (hasInvalidWeight) {
    return {
      label: "Repetir",
      weight: lastWeight === undefined ? "" : String(lastWeight),
      reason: "Hay cargas que no se pudieron interpretar. Revisa el registro antes de progresar.",
    };
  }

  if (loadedWeights.length === 0) {
    if (!reachedTarget) {
      return {
        label: "Repetir",
        weight: "",
        reason: `Mantén el ejercicio y alcanza ${exercise.reps} reps en cada una de las ${exercise.series} series antes de progresar.`,
      };
    }
    if (previousRpe !== undefined && previousRpe !== null && previousRpe >= 9) {
      return {
        label: "Mantener",
        weight: "",
        reason: "La sesión anterior fue muy exigente. Mantén el objetivo de repeticiones y prioriza la recuperación.",
      };
    }
    return {
      label: "Añadir rep",
      weight: "",
      reason: `Completaste todas las series sin carga externa. Si mantienes buena técnica, prueba una repetición más por serie.`,
    };
  }

  if (lastWeight === undefined) return null;

  const loadIsConsistent = loadedWeights.length === prescribedSets.length
    && loadedWeights.every((weight) => weight === loadedWeights[0]);
  if (!loadIsConsistent) {
    return {
      label: "Mantener",
      weight: String(lastWeight),
      reason: "Las cargas entre series fueron distintas. Mantén el plan y registra cargas consistentes antes de aumentarlas.",
    };
  }

  if (!reachedTarget) {
    return {
      label: "Repetir",
      weight: String(lastWeight),
      reason: `Mantén ${lastWeight} kg hasta completar ${exercise.reps} reps en todas las series.`,
    };
  }

  if (previousRpe !== undefined && previousRpe !== null && previousRpe >= 9) {
    return {
      label: "Mantener",
      weight: String(lastWeight),
      reason: "La sesión anterior fue muy exigente. Repite la carga y prioriza la recuperación antes de subir.",
    };
  }

  return {
    label: "Mantener",
    weight: String(lastWeight),
    reason: "Completaste el objetivo. Puedes mantener la carga o aumentarla manualmente si te sientes preparado.",
  };
};
