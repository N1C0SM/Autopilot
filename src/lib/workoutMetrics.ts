import { parsePositiveWeight } from "./weight";

export interface WorkoutLogRecord {
  exercise_name: string;
  logged_at: string;
  sets_completed: unknown;
}

export interface ExerciseHistoryEntry {
  date: string;
  sessionLabel: string;
  volumeKg: number;
  bestEstimated1RmKg: number | null;
  completedSets: number;
  reps: number;
  bestSetLabel: string | null;
}

const parsePositiveNumber = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function buildExerciseHistory(logs: WorkoutLogRecord[]): Record<string, ExerciseHistoryEntry[]> {
  const grouped: Record<string, Record<string, ExerciseHistoryEntry>> = {};

  for (const log of logs) {
    if (!log.exercise_name || !/^\d{4}-\d{2}-\d{2}$/.test(log.logged_at) || !Array.isArray(log.sets_completed)) continue;

    const sets = log.sets_completed.filter((set): set is Record<string, unknown> =>
      typeof set === "object" && set !== null && !Array.isArray(set) && set.done === true,
    );
    const validSets = sets.flatMap((set) => {
      const reps = parsePositiveNumber(set.reps);
      if (reps === null) return [];
      return [{ reps, weight: parsePositiveWeight(set.weight) }];
    });
    if (validSets.length === 0) continue;

    const weightedSets = validSets.filter((set): set is typeof set & { weight: number } => set.weight !== null);
    const volumeKg = weightedSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
    const bestSet = weightedSets.reduce<{ weight: number; reps: number; estimated1Rm: number } | null>((best, set) => {
      const estimated1Rm = set.weight * (1 + set.reps / 30);
      return !best || estimated1Rm > best.estimated1Rm
        ? { weight: set.weight, reps: set.reps, estimated1Rm }
        : best;
    }, null);

    const entry: ExerciseHistoryEntry = {
      date: log.logged_at,
      sessionLabel: new Date(`${log.logged_at}T12:00:00`).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      }),
      volumeKg,
      bestEstimated1RmKg: bestSet ? Math.round(bestSet.estimated1Rm * 10) / 10 : null,
      completedSets: validSets.length,
      reps: validSets.reduce((sum, set) => sum + set.reps, 0),
      bestSetLabel: bestSet ? `${bestSet.weight} kg × ${bestSet.reps}` : null,
    };

    grouped[log.exercise_name] ??= {};
    const existing = grouped[log.exercise_name][log.logged_at];
    if (existing) {
      existing.volumeKg += entry.volumeKg;
      existing.completedSets += entry.completedSets;
      existing.reps += entry.reps;
      if (
        entry.bestEstimated1RmKg !== null
        && (existing.bestEstimated1RmKg === null || entry.bestEstimated1RmKg > existing.bestEstimated1RmKg)
      ) {
        existing.bestEstimated1RmKg = entry.bestEstimated1RmKg;
        existing.bestSetLabel = entry.bestSetLabel;
      }
    } else {
      grouped[log.exercise_name][log.logged_at] = entry;
    }
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([name, entries]) => [
      name,
      Object.values(entries).sort((a, b) => a.date.localeCompare(b.date)),
    ]),
  );
}
