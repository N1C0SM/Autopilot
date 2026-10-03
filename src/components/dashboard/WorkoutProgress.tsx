import { useEffect, useMemo, useState } from "react";
import { BarChart3, Dumbbell, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildExerciseHistory, type ExerciseHistoryEntry, type WorkoutLogRecord } from "@/lib/workoutMetrics";
import ExerciseProgressChart from "@/components/dashboard/ExerciseProgressChart";

interface Props {
  userId: string;
  compact?: boolean;
}

const WorkoutProgress = ({ userId, compact = false }: Props) => {
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, ExerciseHistoryEntry[]>>({});
  const [selectedExercise, setSelectedExercise] = useState("");
  const [metric, setMetric] = useState<"volumeKg" | "reps" | "bestEstimated1RmKg">("volumeKg");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from("workout_logs")
        .select("exercise_name, logged_at, sets_completed")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(500);

      if (!active) return;
      if (error) {
        toast.error("No se pudo cargar el historial de entrenamiento.");
        setHistoryByExercise({});
        setLoadError(true);
      } else {
        const history = buildExerciseHistory((data || []) as WorkoutLogRecord[]);
        setHistoryByExercise(history);
        const mostTracked = Object.entries(history).sort((a, b) => b[1].length - a[1].length)[0]?.[0] || "";
        setSelectedExercise((current) => current in history ? current : mostTracked);
      }
      setLoading(false);
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [userId, reload]);

  const exercises = useMemo(
    () => Object.keys(historyByExercise).sort((a, b) => a.localeCompare(b, "es")),
    [historyByExercise],
  );
  const history = historyByExercise[selectedExercise] || [];
  const latest = history[history.length - 1];
  const selectedMetric = metric === "volumeKg" && history.length > 0 && history.every((entry) => entry.loadedSets === 0)
    ? "reps"
    : metric;

  return (
    <section className={compact ? "flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card p-3 card-shadow sm:p-4" : "rounded-2xl border border-border bg-card p-4 card-shadow sm:p-6"} aria-labelledby="workout-progress-title">
      <div>
        <div className="flex min-w-0 items-center gap-2">
          <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
          <h3 id="workout-progress-title" className="min-w-0 flex-1 truncate font-display text-sm font-bold sm:text-lg">Progresión por ejercicio</h3>
          {exercises.length > 0 && (
            <select
              aria-label="Ejercicio para ver progresión"
              value={selectedExercise}
              onChange={(event) => setSelectedExercise(event.target.value)}
              className="min-h-9 w-[42%] min-w-0 shrink-0 rounded-xl border border-border bg-background px-2 text-xs sm:min-h-10 sm:w-auto sm:max-w-[45%] sm:px-3 sm:text-sm"
            >
              {exercises.map((exercise) => <option key={exercise} value={exercise}>{exercise}</option>)}
            </select>
          )}
        </div>
        {!compact && <p className="mt-1 text-xs text-muted-foreground">Compara tus sesiones con series registradas como completadas.</p>}
      </div>

      {loading ? (
        <div className="mt-6 h-52 animate-pulse rounded-xl bg-secondary/50" aria-label="Cargando historial" />
      ) : loadError ? (
        <div className="mt-5 rounded-xl border border-destructive/30 p-6 text-center">
          <p className="text-sm font-semibold">No se ha podido cargar tu evolución</p>
          <p className="mt-1 text-xs text-muted-foreground">Tus entrenamientos siguen guardados. Comprueba la conexión y vuelve a intentarlo.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setReload((value) => value + 1)}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reintentar
          </Button>
        </div>
      ) : exercises.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
          <Dumbbell className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-semibold">Aún no hay sesiones registradas</p>
          <p className="mt-1 text-xs text-muted-foreground">Completa series en Entrenamiento y aquí aparecerá tu evolución por ejercicio.</p>
        </div>
      ) : (
        <>
          <div className={compact ? "mt-2 min-h-0 flex-1" : "mt-4"}>
            <ExerciseProgressChart
              compact={compact}
              exerciseName={selectedExercise}
              history={history}
              metric={selectedMetric}
              onMetricChange={setMetric}
            />
          </div>
          {latest && (
            <div className={compact ? "mt-2 grid grid-cols-4 gap-1.5 [&>div]:p-2 [&_p:first-child]:text-sm [&_p:last-child]:text-[10px] [&_p:last-child]:leading-tight" : "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"}>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-base font-bold tabular-nums sm:text-lg">{latest.completedSets}</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">series completadas</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-base font-bold tabular-nums sm:text-lg">{latest.reps}</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">repeticiones</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-base font-bold tabular-nums sm:text-lg">{latest.loadedSets > 0 ? `${Math.round(latest.volumeKg)} kg` : "—"}</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">volumen con carga</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-base font-bold tabular-nums sm:text-lg">{latest.bestEstimated1RmKg !== null ? `${latest.bestEstimated1RmKg} kg` : "—"}</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">1RM estimado</p>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default WorkoutProgress;
