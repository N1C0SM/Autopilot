import { isWorkoutSetWarmup } from "@/shared/lib/workoutSet";
import { parsePositiveWeight } from "@/shared/lib/weight";

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
  loadedSets: number;
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

    // Las series de calentamiento se guardan (el registro es honesto) pero no
    // cuentan en volumen, 1RM ni series completadas. Los registros antiguos sin
    // el campo `isWarmup` entran como series de trabajo normales.
    const sets = log.sets_completed.filter((set): set is Record<string, unknown> =>
      typeof set === "object" && set !== null && !Array.isArray(set)
      && set.done === true && !isWorkoutSetWarmup(set),
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
      loadedSets: weightedSets.length,
      reps: validSets.reduce((sum, set) => sum + set.reps, 0),
      bestSetLabel: bestSet ? `${bestSet.weight} kg × ${bestSet.reps}` : null,
    };

    grouped[log.exercise_name] ??= {};
    const existing = grouped[log.exercise_name][log.logged_at];
    if (existing) {
      existing.volumeKg += entry.volumeKg;
      existing.completedSets += entry.completedSets;
      existing.loadedSets += entry.loadedSets;
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

export interface WeekSummary {
  /** Lunes de la semana (YYYY-MM-DD, hora local). */
  weekStart: string;
  volumeKg: number;
  sessions: number;
}

export interface TrainingOverview {
  weeks: WeekSummary[];
  /** Días distintos con al menos una serie, en todo el historial. */
  totalSessions: number;
  /** Volumen de las últimas 4 semanas (incluida la actual). */
  last4WeeksVolumeKg: number;
  /** Semanas seguidas con al menos un entreno, contando hacia atrás desde la actual (o la anterior si esta aún no tiene). */
  streakWeeks: number;
}

const toLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const mondayOf = (date: Date) => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};

/** Resumen semanal de todo el entrenamiento (como el panel de Hevy): volumen y sesiones por semana. */
export function buildTrainingOverview(
  history: Record<string, ExerciseHistoryEntry[]>,
  weeksBack = 8,
  now: Date = new Date(),
): TrainingOverview {
  const volumeByDay = new Map<string, number>();
  for (const entries of Object.values(history)) {
    for (const entry of entries) {
      const day = entry.date.slice(0, 10);
      volumeByDay.set(day, (volumeByDay.get(day) || 0) + (entry.volumeKg || 0));
    }
  }

  const currentMonday = mondayOf(now);
  const weeks: WeekSummary[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - i * 7);
    weeks.push({ weekStart: toLocalDate(start), volumeKg: 0, sessions: 0 });
  }
  const weekIndex = new Map(weeks.map((week, i) => [week.weekStart, i]));
  const sessionsByWeek = new Map<string, number>();
  volumeByDay.forEach((volume, day) => {
    const [y, m, d] = day.split("-").map(Number);
    const key = toLocalDate(mondayOf(new Date(y, m - 1, d)));
    sessionsByWeek.set(key, (sessionsByWeek.get(key) || 0) + 1);
    const i = weekIndex.get(key);
    if (i !== undefined) {
      weeks[i].volumeKg += volume;
      weeks[i].sessions += 1;
    }
  });

  let streakWeeks = 0;
  const cursor = new Date(currentMonday);
  if (!sessionsByWeek.has(toLocalDate(cursor))) cursor.setDate(cursor.getDate() - 7);
  while (sessionsByWeek.has(toLocalDate(cursor))) {
    streakWeeks += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  return {
    weeks: weeks.map((week) => ({ ...week, volumeKg: Math.round(week.volumeKg) })),
    totalSessions: volumeByDay.size,
    last4WeeksVolumeKg: Math.round(weeks.slice(-4).reduce((total, week) => total + week.volumeKg, 0)),
    streakWeeks,
  };
}
