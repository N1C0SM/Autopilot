import { useExerciseImages } from "@/shared/hooks/useExerciseImages";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronRight, ChevronsUpDown, Dumbbell, Flame, TrendingUp, Trophy, WifiOff } from "lucide-react";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";
import { ProgressHero } from "@/app/components/progress/ProgressHero";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { toast } from "sonner";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { supabase } from "@/shared/integrations/supabase/client";
import { buildExerciseHistory, buildTrainingOverview, exerciseRecord, type ExerciseHistoryEntry, type WorkoutLogRecord } from "@/shared/lib/workoutMetrics";
import { TrainingOverviewCard } from "@/app/components/dashboard/TrainingOverviewCard";
import ExerciseProgressChart from "@/app/components/dashboard/ExerciseProgressChart";

interface Props {
  userId: string;
  compact?: boolean;
  /** «Empezar a entrenar» desde la portada sin entrenos (como `onNavigate(.train)` en la app). */
  onGoTrain?: () => void;
}

/** Lo que tendrá Fuerza: todo real (gráfica por ejercicio, racha semanal y récords). */
const STRENGTH_PERKS = [
  { icon: TrendingUp, text: "Tu fuerza en cada ejercicio" },
  { icon: Flame, text: "Tu racha de semanas entrenando" },
  { icon: Trophy, text: "Tus récords personales" },
];

// Hairlines between stats: two columns under 390 px (second row with a top rule), four from 390 px.
const STAT_CELL = [
  "pr-3",
  "pl-3 sep-l",
  "pr-3 sep-t min-[390px]:border-t-0 min-[390px]:pl-3 min-[390px]:sep-l",
  "pl-3 sep-l sep-t min-[390px]:border-t-0",
];

/** Subida de la mejor serie desde la primera sesión (chip verde de la maqueta); nada si no ha subido. */
const GainChip = ({ kg }: { kg: number | null }) =>
  kg ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-[12px] font-semibold tabular-nums text-success">
      <TrendingUp className="h-3.5 w-3.5" aria-hidden />+{kg.toLocaleString("es-ES")} kg
    </span>
  ) : null;

/** Foto del ejercicio (o su icono) en las filas de «Tu fuerza». */
const ExercisePhoto = ({ src, size }: { src?: string; size: "md" | "lg" }) => (
  <span aria-hidden className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-secondary text-muted-foreground ${size === "lg" ? "h-16 w-16 rounded-2xl" : "h-12 w-12 rounded-xl"}`}>
    {src ? <img src={src} alt="" decoding="async" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" /> : <Dumbbell className="h-5 w-5" />}
  </span>
);

const WorkoutProgress = ({ userId, compact = false, onGoTrain }: Props) => {
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, ExerciseHistoryEntry[]>>({});
  const [selectedExercise, setSelectedExercise] = useState("");
  const [metric, setMetric] = useState<"volumeKg" | "reps" | "bestEstimated1RmKg">("volumeKg");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [showAll, setShowAll] = useState(false);

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

  const record = exerciseRecord(history);
  // Las demás filas: los ejercicios con más historial primero (ya vienen así); 3 a la vista y el resto con «Ver todos».
  const others = exercises.filter((exercise) => exercise !== selectedExercise);
  const visibleOthers = showAll ? others : others.slice(0, 3);
  const pickExercise = (exercise: string) => {
    void hapticSelection();
    setSelectedExercise(exercise);
  };

  return (
    <div
      role="region"
      aria-label="Progresión por ejercicio"
      className={compact ? "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" : "flex flex-col"}
    >
      {!loading && !loadError && exercises.length > 0 && (
        <div className="mb-3 shrink-0">
          <h3 className="type-title2">Tu fuerza</h3>
          <p className="mt-0.5 type-subhead text-muted-foreground">Evolución de tus principales ejercicios.</p>
        </div>
      )}

      {loading ? (
        <div role="status" aria-label="Cargando historial" className={fill}>
          <Skeleton className="mt-4 h-8 w-32" />
          <Skeleton className={`mt-4 rounded-media ${compact ? "min-h-[200px] flex-1" : "h-64"}`} />
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
        // Sin entrenos: misma portada que Físico y Récords, con foto real y el camino a Entrenar.
        <ProgressHero
          photo={BRAND_PHOTOS.pullupBar}
          photoPosition="50% 30%"
          eyebrow="Tu fuerza"
          title="Tu progreso empieza con tu primer entreno"
          message="Marca tus series al entrenar y aquí verás tus kilos, tu racha y tus récords."
          perks={STRENGTH_PERKS}
          action={onGoTrain ? { label: "Empezar a entrenar", onClick: onGoTrain } : undefined}
        />
      ) : (
        <>
          {/* Ejercicio principal: foto, mejor marca (la serie de más 1RM) y su subida, con la gráfica en la misma tarjeta (maqueta de ChatGPT). */}
          <div className={compact ? "flex flex-1 flex-col rounded-[22px] border border-border bg-card p-4" : "rounded-[22px] border border-border bg-card p-4"}>
            <div className="relative flex items-start gap-3.5 rounded-2xl transition-opacity duration-150 active:opacity-70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
              <ExercisePhoto src={exerciseImages[selectedExercise]} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-2">
                  <span className="line-clamp-2 min-w-0 flex-1 type-headline">{selectedExercise}</span>
                  <ChevronsUpDown className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                </span>
                {record.label ? (
                  <>
                    <span className="mt-1 block type-footnote text-muted-foreground">Mejor marca</span>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="text-[26px] font-bold leading-tight tracking-tight tabular-nums">{record.label}</span>
                      <GainChip kg={record.gainKg} />
                    </span>
                  </>
                ) : (
                  // Sin peso no hay marca que enseñar: se dice cuántas sesiones lleva, sin guiones.
                  <span className="mt-1 block type-subhead text-muted-foreground">
                    {history.length} {history.length === 1 ? "sesión registrada" : "sesiones registradas"}
                  </span>
                )}
              </span>
              <select
                aria-label="Ejercicio"
                value={selectedExercise}
                onChange={(event) => pickExercise(event.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 type-body focus-visible:outline-none"
              >
                {exercises.map((exercise) => <option key={exercise} value={exercise}>{exercise} · {historyByExercise[exercise].length} {historyByExercise[exercise].length === 1 ? "sesión" : "sesiones"}</option>)}
              </select>
            </div>
            <div className={compact ? "mt-4 flex flex-1 flex-col" : "mt-4"}>
              <ExerciseProgressChart
                compact={compact}
                exerciseName={selectedExercise}
                history={history}
                metric={selectedMetric}
                onMetricChange={setMetric}
              />
            </div>
          </div>

          {visibleOthers.length > 0 && (
            <ul aria-label="Otros ejercicios" className="mt-3 space-y-3">
              {visibleOthers.map((exercise) => {
                const best = exerciseRecord(historyByExercise[exercise]);
                return (
                  <li key={exercise}>
                    <button
                      type="button"
                      onClick={() => pickExercise(exercise)}
                      className="flex min-h-[72px] w-full items-center gap-3.5 rounded-[22px] border border-border bg-card px-3 py-3 pr-4 text-left transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExercisePhoto src={exerciseImages[exercise]} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate type-headline">{exercise}</span>
                        <span className="mt-0.5 block line-clamp-2 type-footnote tabular-nums text-muted-foreground">
                          {best.label ? `Mejor marca: ${best.label}` : `${historyByExercise[exercise].length} ${historyByExercise[exercise].length === 1 ? "sesión" : "sesiones"}`}
                        </span>
                      </span>
                      <GainChip kg={best.gainKg} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.5} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {others.length > 3 && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => { void hapticTap(); setShowAll((value) => !value); }}
              className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-[22px] border border-primary/50 px-4 text-left text-primary transition-opacity duration-150 active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BarChart3 className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex-1 type-subhead font-semibold">{showAll ? "Ver menos ejercicios" : "Ver todos mis ejercicios"}</span>
              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-150 ${showAll ? "-rotate-90" : ""}`} strokeWidth={2.5} aria-hidden />
            </button>
          )}

          {/* Constancia: kilos, entrenos y racha de las últimas semanas, debajo de la fuerza. */}
          <h3 className="mb-3 mt-6 type-title2">Tu constancia</h3>
          <TrainingOverviewCard overview={overview} />
        </>
      )}
    </div>
  );
};

export default WorkoutProgress;
