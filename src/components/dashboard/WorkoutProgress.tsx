import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, Dumbbell, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { hapticSelection, hapticTap } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";
import { buildExerciseHistory, buildTrainingOverview, type ExerciseHistoryEntry, type WorkoutLogRecord } from "@/lib/workoutMetrics";
import { TrainingOverviewCard } from "@/components/dashboard/TrainingOverviewCard";
import ExerciseProgressChart from "@/components/dashboard/ExerciseProgressChart";

interface Props {
  userId: string;
  compact?: boolean;
}

// Hairlines between stats: two columns under 390 px (second row with a top rule), four from 390 px.
const STAT_CELL = [
  "pr-3",
  "pl-3 sep-l",
  "pr-3 sep-t min-[390px]:border-t-0 min-[390px]:pl-3 min-[390px]:sep-l",
  "pl-3 sep-l sep-t min-[390px]:border-t-0",
];

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
  const overview = useMemo(() => buildTrainingOverview(historyByExercise), [historyByExercise]);
  const latest = history[history.length - 1];
  // Respeta siempre la métrica elegida: sin series con peso, la gráfica explica por qué no hay volumen.
  const selectedMetric = metric;

  const stats = latest
    ? [
        { label: "Series", value: String(latest.completedSets) },
        { label: "Reps", value: String(latest.reps) },
        { label: "Volumen", value: latest.loadedSets > 0 ? String(Math.round(latest.volumeKg)) : "—", unit: latest.loadedSets > 0 ? "kg" : undefined },
        { label: "1RM", value: latest.bestEstimated1RmKg !== null ? String(latest.bestEstimated1RmKg) : "—", unit: latest.bestEstimated1RmKg !== null ? "kg" : undefined },
      ]
    : [];
  const fill = compact ? "flex flex-1 flex-col" : undefined;

  return (
    <div
      role="region"
      aria-label="Progresión por ejercicio"
      className={compact ? "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" : "flex flex-col"}
    >
      {!loading && !loadError && exercises.length > 0 && (
        <div className="mb-6">
          <TrainingOverviewCard overview={overview} />
          <h3 className="mb-3 mt-6 type-title3">Por ejercicio</h3>
        </div>
      )}

      {exercises.length > 0 && (
        // Selector de ejercicio — más discreto
        <div className="relative flex min-h-[44px] w-full items-center gap-2 rounded-xl bg-card px-3 transition-opacity duration-150 active:opacity-60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring lg:min-h-[48px] lg:rounded-xl lg:px-4">
          <Dumbbell className="h-4 w-4 shrink-0 text-muted-foreground lg:h-5 lg:w-5" strokeWidth={1.75} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate type-subhead text-foreground lg:type-headline">{selectedExercise}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
          <select
            aria-label="Ejercicio"
            value={selectedExercise}
            onChange={(event) => {
              void hapticSelection();
              setSelectedExercise(event.target.value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 type-body focus-visible:outline-none"
          >
            {exercises.map((exercise) => <option key={exercise} value={exercise}>{exercise} · {historyByExercise[exercise].length} {historyByExercise[exercise].length === 1 ? "sesión" : "sesiones"}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div role="status" aria-label="Cargando historial" className={fill}>
          <Skeleton className="mt-4 h-8 w-32" />
          <Skeleton className={`mt-4 rounded-xl ${compact ? "min-h-[200px] flex-1" : "h-64"}`} />
        </div>
      ) : loadError ? (
        <div role="alert" className={fill}>
          <EmptyState
            icon={WifiOff}
            title="No se ha podido cargar tu evolución"
            description="Tus entrenamientos siguen guardados. Comprueba la conexión y vuelve a intentarlo."
            className={compact ? "flex-1 py-8" : "py-8"}
            action={
              <Button
                type="button"
                variant="plain"
                onClick={() => {
                  void hapticTap();
                  setReload((value) => value + 1);
                }}
              >
                Reintentar
              </Button>
            }
          />
        </div>
      ) : exercises.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Aún no hay sesiones registradas"
          description="Completa series en Entrenamiento y aquí aparecerá tu evolución por ejercicio."
          className={compact ? "flex-1 py-8" : "py-8"}
        />
      ) : (
        <div className={compact ? "mt-3 flex flex-1 flex-col rounded-2xl bg-card p-4" : "mt-3 rounded-2xl bg-card p-4"}>
          <ExerciseProgressChart
            compact={compact}
            exerciseName={selectedExercise}
            history={history}
            metric={selectedMetric}
            onMetricChange={setMetric}
          />
        </div>
      )}
    </div>
  );
};

export default WorkoutProgress;
