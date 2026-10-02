import { useEffect, useMemo, useState } from "react";
import { BarChart3, Dumbbell, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildExerciseHistory, type ExerciseHistoryEntry, type WorkoutLogRecord } from "@/lib/workoutMetrics";
import ExerciseProgressChart from "@/components/dashboard/ExerciseProgressChart";

interface Props {
  userId: string;
}

const WorkoutProgress = ({ userId }: Props) => {
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, ExerciseHistoryEntry[]>>({});
  const [selectedExercise, setSelectedExercise] = useState("");
  const [metric, setMetric] = useState<"volumeKg" | "bestEstimated1RmKg">("volumeKg");
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

  return (
    <section className="rounded-2xl border border-border bg-card p-5 card-shadow sm:p-6" aria-labelledby="workout-progress-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 id="workout-progress-title" className="font-display text-lg font-bold">Progresión por ejercicio</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Compara tus sesiones con series registradas como completadas.</p>
        </div>
        {exercises.length > 0 && (
          <select
            aria-label="Ejercicio para ver progresión"
            value={selectedExercise}
            onChange={(event) => setSelectedExercise(event.target.value)}
            className="min-h-10 max-w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            {exercises.map((exercise) => <option key={exercise} value={exercise}>{exercise}</option>)}
          </select>
        )}
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
          <div className="mt-4">
            <ExerciseProgressChart
              exerciseName={selectedExercise}
              history={history}
              metric={metric}
              onMetricChange={setMetric}
            />
          </div>
          {latest && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-lg font-bold tabular-nums">{latest.completedSets}</p>
                <p className="text-[10px] text-muted-foreground">series completadas</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-lg font-bold tabular-nums">{latest.reps}</p>
                <p className="text-[10px] text-muted-foreground">repeticiones</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-lg font-bold tabular-nums">{Math.round(latest.volumeKg)} kg</p>
                <p className="text-[10px] text-muted-foreground">volumen última sesión</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-lg font-bold tabular-nums">{latest.bestEstimated1RmKg !== null ? `${latest.bestEstimated1RmKg} kg` : "—"}</p>
                <p className="text-[10px] text-muted-foreground">1RM estimado</p>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default WorkoutProgress;
