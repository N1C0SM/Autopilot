import { useExerciseImages } from "@/shared/hooks/useExerciseImages";
import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ChevronRight, ChevronsUpDown, Flame, TrendingUp, Trophy, WifiOff } from "lucide-react";
import { BRAND_PHOTOS, useBrandPhotos } from "@/shared/lib/brandPhotos";
import { ProgressHero } from "@/app/components/progress/ProgressHero";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Spinner } from "@/shared/components/ui/spinner";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { supabase } from "@/shared/integrations/supabase/client";
import { buildExerciseHistory, buildTrainingOverview, exerciseRecord, type ExerciseHistoryEntry, type WorkoutLogRecord } from "@/shared/lib/workoutMetrics";
import { kgText } from "@/shared/lib/workoutSummaryFormat";
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

/**
 * Subida de la mejor serie desde la primera sesión, en dorado (como las mejoras del resumen del
 * entreno); nada si no ha subido. Es `gainChip` en la app.
 */
const GainChip = ({ kg }: { kg: number | null }) =>
  kg ? (
    <span aria-label={`+${kgText(kg)} kg desde tu primera sesión`} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary/15 px-2.5 py-1 type-footnote font-semibold tabular-nums text-primary">
      <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />+{kgText(kg)} kg
    </span>
  ) : null;

/** «1 sesión» / «12 sesiones». */
const sessionsText = (n: number) => `${n} ${n === 1 ? "sesión" : "sesiones"}`;

const WorkoutProgress = ({ userId, compact = false, onGoTrain }: Props) => {
  useBrandPhotos(); // repinta las fotos de marca cuando llega su URL actual
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
        // El aviso va en la propia pantalla (con «Reintentar»), como en la app.
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
  // 1RM estimado del ejercicio: su mejor marca de siempre (solo series con peso).
  const oneRms = history.map((entry) => entry.bestEstimated1RmKg).filter((v): v is number => v !== null);
  const best1Rm = oneRms.length ? Math.max(...oneRms) : null;
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
        <div className="mb-2.5 shrink-0">
          <h3 className="type-title3">Tu fuerza</h3>
          <p className="mt-0.5 type-subhead text-muted-foreground">Evolución de tus principales ejercicios.</p>
        </div>
      )}

      {loading ? (
        // Carga con la firma de marca (el AP latiendo), nunca bloques grises.
        <div className={`flex items-center justify-center py-16 ${compact ? "flex-1" : ""}`}>
          <Spinner size="lg" label="Cargando tu progreso" />
        </div>
      ) : loadError ? (
        <div role="alert" className={fill}>
          <EmptyState
            icon={WifiOff}
            title="No hemos podido cargar tu progreso"
            description="Revisa tu conexión y vuelve a intentarlo. Tus entrenos siguen guardados."
            className={compact ? "flex-1" : undefined}
            action={
              <Button
                type="button"
                variant="secondary"
                size="lg"
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
          {/* Ejercicio principal: foto (o su huella), mejor marca (la serie de más 1RM) y su subida, con la gráfica en la misma tarjeta. */}
          <div className={compact ? "flex flex-1 flex-col rounded-[22px] bg-card p-4" : "rounded-[22px] bg-card p-4"}>
            <div className="relative flex items-start gap-3.5 rounded-2xl transition-opacity duration-150 active:opacity-70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
              <ExerciseThumb image={exerciseImages[selectedExercise]} name={selectedExercise} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-2">
                  <span className="line-clamp-2 min-w-0 flex-1 type-headline">{selectedExercise}</span>
                  <ChevronsUpDown className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                </span>
                {record.label ? (
                  <>
                    <span className="mt-1 block type-footnote text-muted-foreground">Mejor marca</span>
                    {/* La cifra en Big Shoulders y nunca partida; la subida baja entera si no cabe. */}
                    <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <span className="whitespace-nowrap type-figure text-[34px] leading-none">{record.label}</span>
                      <GainChip kg={record.gainKg} />
                    </span>
                  </>
                ) : (
                  // Sin peso no hay marca que enseñar: se dice cuántas sesiones lleva, sin guiones.
                  <span className="mt-1 block type-subhead tabular-nums text-muted-foreground">
                    {history.length} {history.length === 1 ? "sesión registrada" : "sesiones registradas"}
                  </span>
                )}
              </span>
              <select
                aria-label="Cambiar de ejercicio"
                value={selectedExercise}
                onChange={(event) => pickExercise(event.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 type-body focus-visible:outline-none"
              >
                {exercises.map((exercise) => <option key={exercise} value={exercise}>{exercise} · {sessionsText(historyByExercise[exercise].length)}</option>)}
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
            {/* 1RM estimado (la mejor marca de siempre) y la última sesión, como `statsRow` en la app. */}
            {best1Rm !== null && latest && (
              <div className="mt-4 grid shrink-0 grid-cols-2 pt-3 sep-t">
                <div className="min-w-0 pr-3">
                  <p className="type-footnote text-muted-foreground">1RM estimado</p>
                  <p className="whitespace-nowrap type-title3 tabular-nums">{kgText(best1Rm)} kg</p>
                </div>
                <div className="min-w-0 pl-3 sep-l">
                  <p className="type-footnote text-muted-foreground">Última sesión</p>
                  <p className="whitespace-nowrap type-title3 tabular-nums">{latest.sessionLabel}</p>
                </div>
              </div>
            )}
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
                      className="flex min-h-[72px] w-full items-center gap-3.5 rounded-[22px] bg-card px-3 py-3 pr-4 text-left transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExerciseThumb image={exerciseImages[exercise]} name={exercise} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate type-headline">{exercise}</span>
                        <span className="mt-0.5 block line-clamp-2 type-footnote tabular-nums text-muted-foreground">
                          {/* La cifra nunca se parte: si no cabe en una línea, baja entera a la segunda. */}
                          {best.label ? <><span className="whitespace-nowrap">Mejor marca:</span> <span className="whitespace-nowrap">{best.label}</span></> : `${historyByExercise[exercise].length} ${historyByExercise[exercise].length === 1 ? "sesión" : "sesiones"}`}
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
            // Botón en píldora secundaria: el dorado queda para lo importante.
            <Button
              type="button"
              variant="secondary"
              size="lg"
              aria-expanded={showAll}
              onClick={() => { void hapticTap(); setShowAll((value) => !value); }}
              className="mt-3 w-full shrink-0"
            >
              {showAll ? "Ver menos ejercicios" : "Ver todos mis ejercicios"}
            </Button>
          )}

          {/* Constancia: kilos, entrenos y racha de las últimas semanas, debajo de la fuerza. */}
          <h3 className="mb-2.5 mt-8 shrink-0 type-title3">Tu constancia</h3>
          <TrainingOverviewCard overview={overview} />
        </>
      )}
    </div>
  );
};

export default WorkoutProgress;
