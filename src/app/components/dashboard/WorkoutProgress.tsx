import { useExerciseImages } from "@/shared/hooks/useExerciseImages";
import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, Dumbbell, WifiOff } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { toast } from "sonner";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { supabase } from "@/shared/integrations/supabase/client";
import { buildExerciseHistory, buildTrainingOverview, type ExerciseHistoryEntry, type WorkoutLogRecord } from "@/shared/lib/workoutMetrics";
import { TrainingOverviewCard } from "@/app/components/dashboard/TrainingOverviewCard";
import ExerciseProgressChart from "@/app/components/dashboard/ExerciseProgressChart";

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
  const exerciseImages = useExerciseImages(exercises);
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
        <div className="mb-6 shrink-0">
          <TrainingOverviewCard overview={overview} />
          <h3 className="mb-3 mt-6 type-title3">Por ejercicio</h3>
        </div>
      )}

      {exercises.length > 0 && (
        // Ejercicio elegido como portada: su foto real y el nombre en grande, tocable para cambiar.
        <div className="relative shrink-0 overflow-hidden rounded-[28px] bg-card transition-opacity duration-150 active:opacity-80 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
          {exerciseImages[selectedExercise] && <>
            <img key={exerciseImages[selectedExercise]} src={exerciseImages[selectedExercise]} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_30%] animate-in fade-in duration-500" />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          </>}
          <div className={`relative flex items-end gap-2 p-5 ${exerciseImages[selectedExercise] ? "min-h-[11rem]" : ""}`}>
            <span className="min-w-0 flex-1">
              <span className="block type-footnote font-semibold text-primary">{historyByExercise[selectedExercise]?.length ?? 0} {(historyByExercise[selectedExercise]?.length ?? 0) === 1 ? "sesión" : "sesiones"}</span>
              <span className="mt-0.5 block font-rounded text-[26px] font-bold leading-tight tracking-tight text-white">{selectedExercise}</span>
            </span>
            <ChevronsUpDown className="mb-1 h-5 w-5 shrink-0 text-white/70" strokeWidth={2} aria-hidden="true" />
          </div>
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
          title="Tu progreso empieza con tu primer entreno"
          description="Marca tus series al entrenar y aquí verás tus kilos, tu racha y tus récords."
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
