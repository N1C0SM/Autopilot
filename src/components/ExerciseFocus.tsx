import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Dumbbell, TrendingUp } from "lucide-react";
import ExerciseMedia from "@/components/ExerciseMedia";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildExerciseHistory, type WorkoutLogRecord } from "@/lib/workoutMetrics";
import { getProgressionSuggestion } from "@/lib/workoutProgression";
import type { GymExerciseEntry } from "@/types/training";

export type FocusExercise = {
  name: string;
  image?: string | null;
  video?: string | null;
  series?: number | string | null;
  reps?: number | string | null;
  rest?: string | null;
  muscleGroup?: string | null;
  exerciseType?: string | null;
};

type LoggedSet = { reps: number; weight: string; done: boolean; isWarmup: boolean };

const asSets = (value: unknown): LoggedSet[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const set = raw as Record<string, unknown>;
    const reps = Number(set.reps);
    return [{
      reps: Number.isFinite(reps) ? reps : 0,
      weight: set.weight == null ? "" : String(set.weight),
      done: set.done === true,
      isWarmup: set.isWarmup === true,
    }];
  });
};

const setLabel = (set: LoggedSet) => `${set.weight ? `${set.weight} kg` : "libre"} × ${set.reps}`;

const shortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

/**
 * Un ejercicio, a pantalla completa y sin nada más alrededor: el vídeo, las
 * series, en qué punto vas y tus últimas sesiones. Se abre desde cualquier
 * sitio donde aparezca un ejercicio.
 */
export const ExerciseFocus = ({
  exercise,
  onClose,
}: {
  exercise: FocusExercise | null;
  onClose: () => void;
}) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkoutLogRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const name = exercise?.name ?? "";

  useEffect(() => {
    if (!exercise || !user) { setLogs([]); return; }
    let active = true;
    setLoading(true);
    void supabase
      .from("workout_logs")
      .select("exercise_name, logged_at, sets_completed, rpe")
      .eq("user_id", user.id)
      .eq("exercise_name", name)
      .order("logged_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!active) return;
        setLogs(error ? [] : ((data ?? []) as unknown as WorkoutLogRecord[]));
        setLoading(false);
      });
    return () => { active = false; };
  }, [exercise, user, name]);

  const history = useMemo(() => buildExerciseHistory(logs)[name] ?? [], [logs, name]);

  const suggestion = useMemo(() => {
    const series = Number(exercise?.series);
    const reps = Number(exercise?.reps);
    if (!Number.isFinite(series) || !Number.isFinite(reps) || series <= 0 || reps <= 0) return null;
    const newest = logs[0] as (WorkoutLogRecord & { rpe?: number | null }) | undefined;
    // La progresión se calcula solo con las series de trabajo de la última sesión.
    const previous = asSets(newest?.sets_completed).filter((set) => !set.isWarmup);
    if (previous.length === 0) return null;
    return getProgressionSuggestion(
      { series, reps } as GymExerciseEntry,
      previous,
      newest?.rpe ?? null,
    );
  }, [exercise, logs]);

  const best1Rm = useMemo(
    () => history.reduce((best, entry) => Math.max(best, entry.bestEstimated1RmKg ?? 0), 0),
    [history],
  );

  const lastSets = logs[0] ? asSets((logs[0] as WorkoutLogRecord).sets_completed).filter((s) => s.done) : [];

  return (
    <Dialog open={!!exercise} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-0 bg-background p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[92vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-border">
        <DialogTitle className="sr-only">{name}</DialogTitle>

        <div className="w-full overflow-hidden bg-black">
          <ExerciseMedia video={exercise?.video} image={exercise?.image} name={name} />
        </div>

        <div className="space-y-5 px-5 pb-12 pt-5">
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">{name}</h2>
            {(exercise?.muscleGroup || exercise?.exerciseType) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {[exercise?.muscleGroup, exercise?.exerciseType].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {(exercise?.series || exercise?.reps || exercise?.rest) && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Series", value: exercise?.series ?? "—" },
                { label: "Reps", value: exercise?.reps ?? "—" },
                { label: "Descanso", value: exercise?.rest ?? "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-display text-lg font-bold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {suggestion && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-primary">
                <TrendingUp className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wider">Progresión</p>
              </div>
              <p className="mt-2 font-display text-lg font-bold">
                {suggestion.label === "Subir"
                  ? `Sube a ${suggestion.weight} kg`
                  : suggestion.label === "Añadir rep"
                    ? "Suma una repetición por serie"
                    : suggestion.label === "Mantener"
                      ? suggestion.weight ? `Mantén ${suggestion.weight} kg` : "Mantén el objetivo"
                      : suggestion.weight ? `Repite ${suggestion.weight} kg` : "Repite el ejercicio"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{suggestion.reason}</p>
            </div>
          )}

          {best1Rm > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <Dumbbell className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm">
                Tu mejor 1RM estimado en este ejercicio:{" "}
                <span className="font-semibold tabular-nums">{best1Rm.toFixed(1)} kg</span>
              </p>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wider">Tus últimas sesiones</p>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : history.length === 0 ? (
              <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                Aún no has registrado este ejercicio. La primera vez que lo hagas aparecerá aquí tu progreso.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {/* Las más recientes primero: si hay 20 sesiones, se ven las últimas */}
                {history.slice(-6).reverse().map((entry) => (
                  <li
                    key={entry.date}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{shortDate(entry.date)}</p>
                      <p className="truncate text-xs text-muted-foreground">{entry.bestSetLabel ?? `${entry.completedSets} series`}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {entry.bestEstimated1RmKg ? (
                        <p className="text-sm font-semibold tabular-nums">{entry.bestEstimated1RmKg.toFixed(1)} kg</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground tabular-nums">{Math.round(entry.volumeKg)} kg vol.</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {lastSets.length > 0 && history.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Última vez: {lastSets.map(setLabel).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseFocus;
