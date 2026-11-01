import { useEffect, useMemo, useState } from "react";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { CalendarDays, Dumbbell, TrendingUp } from "lucide-react";
import ExerciseMedia from "@/app/components/ExerciseMedia";
import ExerciseTechnique from "@/app/components/ExerciseTechnique";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { Spinner } from "@/shared/components/ui/spinner";
import { useAuth } from "@/shared/contexts/AuthContext";
import { supabase } from "@/shared/integrations/supabase/client";
import { buildExerciseHistory, type WorkoutLogRecord } from "@/shared/lib/workoutMetrics";
import { getProgressionSuggestion } from "@/shared/lib/workoutProgression";
import type { GymExerciseEntry } from "@/shared/types/training";

// Cifras en formato español: 49,6 kg (no 49.6).
const kg = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 1 });

export type FocusExercise = {
  name: string;
  image?: string | null;
  video?: string | null;
  series?: number | string | null;
  reps?: number | string | null;
  rest?: string | null;
  muscleGroup?: string | null;
  exerciseType?: string | null;
  /** Patrón, estímulo y carga: dibujan la huella de movimiento en el héroe. */
  pattern?: string | null;
  stimulus?: string | null;
  load?: string | null;
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

const decimalComma = (text: string) => text.replace(/(\d)\.(\d)/g, "$1,$2");
const setLabel = (set: LoggedSet) => decimalComma(`${set.weight ? `${set.weight} kg` : "libre"} × ${set.reps}`);

const shortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
};

/**
 * Un ejercicio en una hoja, sin nada más alrededor: el vídeo, las series, en qué
 * punto vas y tus últimas sesiones. Se abre desde cualquier sitio donde aparezca
 * un ejercicio.
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

  const stats = [
    { label: "Series", value: exercise?.series },
    { label: "Reps", value: exercise?.reps },
    { label: "Descanso", value: exercise?.rest },
  ];

  const suggestionTitle = !suggestion
    ? ""
    : suggestion.label === "Subir"
      ? `Sube a ${suggestion.weight} kg`
      : suggestion.label === "Añadir rep"
        ? "Suma una repetición por serie"
        : suggestion.label === "Mantener"
          ? suggestion.weight ? `Mantén ${suggestion.weight} kg` : "Mantén el objetivo"
          : suggestion.weight ? `Repite ${suggestion.weight} kg` : "Repite el ejercicio";

  return (
    <Dialog open={!!exercise} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden">
        {/* Bajo el botón de cerrar, no debajo de él: los controles del vídeo quedan libres. */}
        <ExerciseMedia video={exercise?.video} image={exercise?.image} name={name} pattern={exercise?.pattern} stimulus={exercise?.stimulus} load={exercise?.load} className="mt-7 shrink-0 rounded-[14px] sm:mt-6" />

        {/* Solo el texto se desplaza: un vídeo dentro de una zona con scroll se queda clavado en WebKit de iOS. */}
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:-mx-6 sm:px-6">

        <div className="mt-5 pr-8">
          <DialogTitle className="type-title2 sm:type-title2">{name}</DialogTitle>
          {(exercise?.muscleGroup || exercise?.exerciseType) && (
            <p className="mt-1 type-subhead text-muted-foreground">
              {[exercise?.muscleGroup, exercise?.exerciseType].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {(exercise?.series || exercise?.reps || exercise?.rest) && (
          <dl className="mt-5 grid grid-cols-3 gap-2.5">
            {stats.map((item) => (
              <div key={item.label} className="min-w-0 rounded-media bg-secondary p-3">
                <dt className="type-footnote text-muted-foreground">{item.label}</dt>
                <dd className="mt-0.5 font-rounded type-title2 tabular-nums">{item.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}

        <ExerciseTechnique name={name} muscleGroup={exercise?.muscleGroup} />

        {(suggestion || best1Rm > 0) && (
          <ul className="mt-7 space-y-2.5">
            {suggestion && (
              <li className="flex items-start gap-3 rounded-media bg-secondary p-3.5">
                <IconTile icon={TrendingUp} />
                <div className="min-w-0">
                  <p className="type-headline">{suggestionTitle}</p>
                  <p className="mt-0.5 type-subhead text-muted-foreground">{suggestion.reason}</p>
                </div>
              </li>
            )}
            {best1Rm > 0 && (
              <li className="flex items-start gap-3 rounded-media bg-secondary p-3.5">
                <IconTile icon={Dumbbell} />
                <div className="min-w-0">
                  <p className="type-headline tabular-nums">{kg(best1Rm)} kg</p>
                  <p className="mt-0.5 type-subhead text-muted-foreground">Tu mejor 1RM estimado en este ejercicio</p>
                </div>
              </li>
            )}
          </ul>
        )}

        <div className="mt-7 pb-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-start gap-4">
              <IconTile icon={CalendarDays} />
              <div className="min-w-0">
                <p className="type-headline">Tus últimas sesiones</p>
                <p className="mt-0.5 type-subhead text-muted-foreground">
                  Aún no has registrado este ejercicio. La primera vez que lo hagas aparecerá aquí tu progreso.
                </p>
              </div>
            </div>
          ) : (
            <ListGroup
              inset
              header="Tus últimas sesiones"
              footer={lastSets.length > 0 ? `Última vez: ${lastSets.map(setLabel).join(" · ")}` : undefined}
            >
              {/* Las más recientes primero: si hay 20 sesiones, se ven las últimas */}
              {history.slice(-6).reverse().map((entry) => (
                <ListRow
                  key={entry.date}
                  title={shortDate(entry.date)}
                  subtitle={entry.bestSetLabel ? decimalComma(entry.bestSetLabel) : `${entry.completedSets} series`}
                  value={
                    <span className="tabular-nums">
                      {entry.bestEstimated1RmKg ? `${kg(entry.bestEstimated1RmKg)} kg` : `${Math.round(entry.volumeKg)} kg vol.`}
                    </span>
                  }
                />
              ))}
            </ListGroup>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseFocus;
