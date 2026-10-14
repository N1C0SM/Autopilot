import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, Dumbbell, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Surface } from "@/components/ui/surface";
import { toast } from "sonner";
import { hapticSelection, hapticTap } from "@/lib/native";
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
        // Por defecto, el ejercicio con más sesiones (así la gráfica arranca con línea real).
        const mostTracked = Object.entries(history).sort((a, b) =>
          b[1].length - a[1].length ||
          (b[1][b[1].length - 1]?.date || "").localeCompare(a[1][a[1].length - 1]?.date || ""),
        )[0]?.[0] || "";
        setSelectedExercise((current) => current in history ? current : mostTracked);
      }
      setLoading(false);
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [userId, reload]);

  // Primero los ejercicios con 2+ sesiones (tienen gráfica), luego el resto; alfabético dentro.
  const exercises = useMemo(
    () => Object.keys(historyByExercise).sort((a, b) => {
      const ga = historyByExercise[a].length > 1 ? 0 : 1;
      const gb = historyByExercise[b].length > 1 ? 0 : 1;
      return ga - gb || a.localeCompare(b, "es");
    }),
    [historyByExercise],
  );
  const history = historyByExercise[selectedExercise] || [];
  const latest = history[history.length - 1];
  const selectedMetric = metric === "volumeKg" && history.length > 0 && history.every((entry) => entry.loadedSets === 0)
    ? "reps"
    : metric;

  const tiles = latest
    ? [
        { value: latest.completedSets, label: "series completadas" },
        { value: latest.reps, label: "repeticiones" },
        { value: latest.loadedSets > 0 ? `${Math.round(latest.volumeKg)} kg` : "—", label: "volumen con carga" },
        { value: latest.bestEstimated1RmKg !== null ? `${latest.bestEstimated1RmKg} kg` : "—", label: "1RM estimado" },
      ]
    : [];

  return (
    <Surface
      role="region"
      aria-label="Progresión por ejercicio"
      className={compact ? "flex min-h-0 flex-1 flex-col overflow-y-auto" : "sm:p-6"}
    >
      {exercises.length > 0 && (
        <div className="relative">
          <select
            aria-label="Ejercicio"
            value={selectedExercise}
            onChange={(event) => {
              void hapticSelection();
              setSelectedExercise(event.target.value);
            }}
            className="field w-full min-w-0 appearance-none truncate pr-9 font-semibold focus-visible:outline-none"
          >
            {exercises.map((exercise) => <option key={exercise} value={exercise}>{exercise} · {historyByExercise[exercise].length} {historyByExercise[exercise].length === 1 ? "sesión" : "sesiones"}</option>)}
          </select>
          <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      {loading ? (
        <Skeleton className="mt-4 h-52 rounded-xl" role="status" aria-label="Cargando historial" />
      ) : loadError ? (
        <div role="alert">
          <EmptyState
            icon={WifiOff}
            title="No se ha podido cargar tu evolución"
            description="Tus entrenamientos siguen guardados. Comprueba la conexión y vuelve a intentarlo."
            className="py-8"
            action={
              <Button
                type="button"
                variant="tinted"
                size="sm"
                onClick={() => {
                  void hapticTap();
                  setReload((value) => value + 1);
                }}
              >
                <RefreshCw aria-hidden="true" /> Reintentar
              </Button>
            }
          />
        </div>
      ) : exercises.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Aún no hay sesiones registradas"
          description="Completa series en Entrenamiento y aquí aparecerá tu evolución por ejercicio."
          className="py-8"
        />
      ) : (
        <>
          <div className={compact ? "mt-4 flex-1" : "mt-5"}>
            <ExerciseProgressChart
              compact={compact}
              exerciseName={selectedExercise}
              history={history}
              metric={selectedMetric}
              onMetricChange={setMetric}
            />
          </div>
          {latest && (
            <div className={compact ? "mt-3 grid grid-cols-2 gap-2 min-[390px]:grid-cols-4 min-[390px]:gap-1.5" : "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"}>
              {tiles.map((tile) => (
                <div key={tile.label} className={`min-w-0 break-words rounded-xl bg-secondary ${compact ? "p-2" : "p-3"}`}>
                  <p className={`font-rounded font-bold tabular-nums ${compact ? "type-subhead" : "text-xl leading-6"}`}>{tile.value}</p>
                  <p className={`text-muted-foreground ${compact ? "type-caption2" : "type-caption1"}`}>{tile.label}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Surface>
  );
};

export default WorkoutProgress;
