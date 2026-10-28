import { readMealsDone as readMealsDoneFor } from "@/shared/lib/mealsDone";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Apple, Check, ChevronRight, Clock, LockKeyhole, Moon, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ProgressRing } from "@/shared/components/ui/progress-ring";
import { supabase } from "@/shared/integrations/supabase/client";
import type { DayPlan } from "@/shared/types/training";
import type { UserSection } from "@/app/components/UserSidebar";
import { formatTrainingTitle } from "@/shared/lib/trainingDisplay";
import { hapticTap } from "@/shared/lib/native";
import { isIOSNative } from "@/shared/lib/platform";
import { nutritionMacroError } from "@/shared/lib/nutritionValidation";
import { cn } from "@/shared/lib/utils";
import { readActiveWorkout, clearActiveWorkout, clearPendingOfflineSeries, isActiveWorkoutToday, formatDraftDate, ACTIVE_WORKOUT_EVENT, type ActiveWorkout } from "@/shared/lib/activeWorkout";
import { toast } from "sonner";
import { useConfirm } from "@/app/components/admin/content/useConfirm";
import { useSessionCover } from "@/shared/hooks/useSessionCover";
import { useExerciseMetadata } from "@/shared/hooks/useExerciseMetadata";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";

interface Macros {
  protein: number;
  carbs: number;
  fats: number;
  calories?: number;
}

interface Meal {
  name: string;
  description: string;
}

interface Props {
  dayPlans: DayPlan[];
  meals?: Meal[];
  userId?: string;
  /** Navegación del panel. «training» sin día abre la rutina de hoy. */
  onNavigate: (section: UserSection, day?: string) => void;
  onStartWorkout?: () => void;
  onResumeWorkout?: () => void;
  profileName?: string;
  macros?: Macros | null;
  completedThisWeek?: number;
  completedToday?: boolean;
  nutrition?: boolean;
  planStatus?: string;
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const planTitle = (plan: DayPlan) =>
  plan.type === "gimnasio"
    ? formatTrainingTitle(plan.routine_name, plan.muscle_focus) || "Entrenamiento de fuerza"
    : plan.sport || "Actividad";

// Misma lectura del descanso que el registro de series ("90 s", "2 min", "60-90 s").
const restSeconds = (rest: string) => {
  const values = rest.match(/\d+/g)?.map(Number) || [];
  if (values.length === 0) return 60;
  const value = values[values.length - 1];
  return /min/i.test(rest) ? value * 60 : value;
};

/** Duración orientativa: unos 45 s por serie más su descanso, redondeada a 5 min. */
const estimateMinutes = (plan: DayPlan) => {
  const seconds = (plan.exercises ?? []).reduce(
    (total, exercise) => total + (Number(exercise.series) || 0) * (45 + restSeconds(String(exercise.rest ?? ""))),
    0,
  );
  return seconds > 0 ? Math.max(5, Math.round(seconds / 300) * 5) : null;
};

/**
 * Tarjeta compacta de Hoy (como las de Fitness): anillo arriba, título y una línea gris.
 * Exportada para que los teléfonos de la web pública pinten exactamente la misma tarjeta.
 * Sin onClick se pinta como imagen estática (no enfocable).
 */
export const OverviewRow = ({
  icon,
  title,
  description,
  value,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  /** Cifra grande, como en la landing y en Fitness: lo primero que se lee. */
  value?: ReactNode;
  onClick?: () => void;
}) => {
  const className = "flex min-h-[7.5rem] min-w-0 flex-col rounded-2xl bg-card p-4 text-left transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const inner = (
    <>
      <span className="flex items-start justify-between">
        <span aria-hidden="true">{icon}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={2.5} aria-hidden="true" />
      </span>
      {value != null && <span className="mt-auto block pt-4 type-figure text-[40px] font-bold leading-none tracking-tight tabular-nums">{value}</span>}
      <span className={`${value != null ? "mt-2" : "mt-auto pt-4"} block type-headline`}>{title}</span>
      <span className="mt-0.5 block type-footnote tabular-nums text-muted-foreground">{description}</span>
    </>
  );
  if (!onClick) return <div className={className}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={() => {
        void hapticTap();
        onClick();
      }}
      className={className}
    >
      {inner}
    </button>
  );
};

const HomeOverview = ({
  dayPlans,
  meals = [],
  userId,
  onNavigate,
  onStartWorkout,
  onResumeWorkout,
  profileName,
  macros,
  completedThisWeek = 0,
  completedToday = false,
  nutrition = true,
  planStatus,
}: Props) => {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(() => userId ? readActiveWorkout(userId) : null);
  useEffect(() => {
    const refresh = () => setActiveWorkout(userId ? readActiveWorkout(userId) : null);
    refresh();
    window.addEventListener(ACTIVE_WORKOUT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ACTIVE_WORKOUT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [userId]);
  const activeWorkoutIsToday = isActiveWorkoutToday(activeWorkout);
  const activeWorkoutDate = activeWorkout ? formatDraftDate(activeWorkout.date) : "";

  const { ask: confirmDiscard, dialog: discardDialog } = useConfirm();
  const discardActiveWorkout = async () => {
    if (!userId || !activeWorkout) return;
    const ok = await confirmDiscard({
      title: "¿Descartar la sesión?",
      description: "Se borrarán las series de ese día y no contará como hecha.",
      confirmLabel: "Descartar",
    });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("workout_logs")
        .delete()
        .eq("user_id", userId)
        .eq("day_label", activeWorkout.plan.day)
        .eq("logged_at", activeWorkout.date);
      if (error) throw error;
      clearPendingOfflineSeries(userId);
      clearActiveWorkout(userId);
      setActiveWorkout(null);
      toast.success("Sesión descartada");
    } catch {
      toast.error("No se pudo descartar la sesión. Comprueba la conexión.");
    }
  };

  const [completedMeals, setCompletedMeals] = useState<Set<string>>(new Set());

  // «Hoy» es solo el día de hoy: nada de tira semanal. Todo lo del día se calcula
  // aquí arriba, antes de las portadas y los metadatos que lo usan (nada de TDZ).
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const todayName = DAYS_ORDER[todayIndex];
  const todayPlan = dayPlans.find((plan) => plan.day === todayName);
  const scheduledDays = dayPlans.filter((plan) => plan.type === "gimnasio" || plan.type === "actividad");

  // Foto del día: portada de IA de la sesión de hoy, con la imagen del primer
  // ejercicio como respaldo y la foto de marca si aún no hay ninguna (siempre
  // hay una foto real en un día de gimnasio).
  const exerciseMetadata = useExerciseMetadata(dayPlans);
  const isGymDay = todayPlan?.type === "gimnasio";
  const exercisesForCover = isGymDay ? todayPlan.exercises ?? [] : [];
  const firstExercise = exercisesForCover[0];
  const firstExerciseImage = firstExercise
    ? (exerciseMetadata.byId[firstExercise.exercise_id] || exerciseMetadata.byName[firstExercise.name])?.image_url || firstExercise.image_url || null
    : null;
  const sessionCover = useSessionCover(exercisesForCover.map((exercise) => exercise.exercise_id), firstExerciseImage);
  const dayPhoto = isGymDay ? sessionCover || BRAND_PHOTOS.gym : null;

  const exerciseCount = exercisesForCover.length;
  const firstName = profileName?.trim().split(/\s+/)[0];
  const dateLabel = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const greetingDate = dateLabel.charAt(0).toLocaleUpperCase("es") + dateLabel.slice(1);
  const sessionCount = Math.min(completedThisWeek, scheduledDays.length);
  const doneMealCount = meals.filter((meal) => completedMeals.has(meal.name)).length;
  const macroError = macros ? nutritionMacroError(macros) : null;
  const calorieTarget = macros && !macroError
    ? Number(macros.calories) || Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fats * 9)
    : null;
  const canStart = !completedToday && Boolean(todayPlan);
  const sessionTitle = todayPlan ? planTitle(todayPlan) : "";

  const sessionDetail: string[] = [];
  if (todayPlan?.type === "gimnasio") {
    const totalSeries = exercisesForCover.reduce((total, exercise) => total + (Number(exercise.series) || 0), 0);
    const minutes = estimateMinutes(todayPlan);
    if (exerciseCount) sessionDetail.push(`${exerciseCount} ${exerciseCount === 1 ? "ejercicio" : "ejercicios"}`);
    if (totalSeries) sessionDetail.push(`${totalSeries} ${totalSeries === 1 ? "serie" : "series"}`);
    if (minutes) sessionDetail.push(`unos ${minutes} min`);
  } else if (todayPlan?.type === "actividad") {
    sessionDetail.push(...[todayPlan.intensity, todayPlan.duration].filter((value): value is string => Boolean(value)));
  }

  const nextSession = (() => {
    for (let offset = 1; offset <= 7; offset++) {
      const day = DAYS_ORDER[(todayIndex + offset) % 7];
      const plan = scheduledDays.find((candidate) => candidate.day === day);
      if (plan) {
        const dayName = day.toLocaleLowerCase("es");
        const when = offset === 1 ? "mañana" : offset === 7 ? `el próximo ${dayName}` : `el ${dayName}`;
        return `Tu próxima sesión es ${when}: ${planTitle(plan)}.`;
      }
    }
    return null;
  })();

  const calorieLabel = calorieTarget ? `${calorieTarget.toLocaleString("es-ES")} kcal` : null;
  const nutritionMain = !nutrition
    ? "Plan de nutrición"
    : meals.length
      ? `${doneMealCount} de ${meals.length} comidas`
      : calorieLabel
        ? "Objetivo diario"
        : macroError
          ? "Objetivos por revisar"
          : "Ver plan de hoy";
  const nutritionExtra = !nutrition
    ? isIOSNative() ? null : "Incluido en Plus"
    : meals.length
      ? macroError ? "Objetivos por revisar" : null
      : calorieLabel && macroError ? "Objetivos por revisar" : null;

  // Widget «Último récord»: la mejor marca más reciente del usuario.
  const [lastPr, setLastPr] = useState<{ exercise_name: string; weight: number; reps: number; achieved_at: string } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void supabase.from("personal_records").select("exercise_name, weight, reps, achieved_at")
      .eq("user_id", userId).order("achieved_at", { ascending: false }).limit(1)
      .then(({ data }) => { if (!cancelled) setLastPr(data?.[0] ?? null); });
    return () => { cancelled = true; };
  }, [userId]);

  const readMealsDone = useCallback(() => {
    setCompletedMeals(new Set(readMealsDoneFor(userId)));
  }, [userId]);

  useEffect(() => {
    readMealsDone();
    // MealsList avisa al marcar/desmarcar una comida: Hoy debe reflejarlo.
    window.addEventListener("autopilot:meals-updated", readMealsDone);
    return () => window.removeEventListener("autopilot:meals-updated", readMealsDone);
  }, [readMealsDone]);

  if (planStatus === "plan_pending") {
    return (
      <EmptyState
        className="flex-1"
        icon={Clock}
        title="Tu entrenador está preparando tu plan"
        description="Te avisaremos cuando esté listo."
      />
    );
  }

  return (
    // Con la sesión hecha no hay acción que centrar: el contenido se apila sin huecos.
    <div className={cn("flex w-full flex-col", !(completedToday && !activeWorkout) && "flex-1")}>
      {/* Saludo arriba a todo el ancho y la sesión de hoy debajo, en una sola columna */}
      <div className="flex flex-1 flex-col">
        <div>
        <p className="type-subhead font-semibold text-muted-foreground">{greetingDate}</p>
        <h2 data-nav-title className="mt-0.5 type-large-title lg:text-[44px] lg:leading-[52px]">
          {firstName ? `Hola, ${firstName}.` : "Hola."}
          <span className="block text-muted-foreground">
            {completedToday
              ? "Buen trabajo."
              : todayPlan?.type === "gimnasio"
                ? "A entrenar."
                : todayPlan?.type === "actividad"
                  ? `A ${todayPlan.sport || "moverte"}.`
                  : "Hoy, a recuperar."}
          </span>
        </h2>
        </div>

        {/* Acción principal: debajo del saludo. En móvil sigue centrada en el hueco que queda. */}
        <div className={cn("flex flex-col", completedToday && !activeWorkout ? "mt-6" : "flex-1 justify-center py-8 md:py-10 lg:mt-10 lg:flex-none lg:justify-start lg:py-0")}>
          {/* Foto del día: la sesión de hoy, siempre con una foto real */}
          {dayPhoto && !activeWorkout && (
            <div aria-hidden="true" className="relative mb-4 h-48 overflow-hidden rounded-[28px] bg-card lg:mb-6 lg:h-[340px]">
              <img
                key={dayPhoto}
                src={dayPhoto}
                alt=""
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-[50%_30%] lg:object-[50%_0%] animate-in fade-in duration-500 motion-reduce:animate-none"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </div>
          )}
          {activeWorkout && activeWorkoutIsToday ? (
            <div className="w-full lg:max-w-md">
              <p className="type-caption1 font-semibold text-primary">EN CURSO · HOY</p>
              <h3 className="mt-1 type-title1">{planTitle(activeWorkout.plan)}</h3>
              <p className="mt-2 type-subhead tabular-nums text-muted-foreground">
                {Object.values(activeWorkout.logs).flat().filter((set) => set.done && !set.isWarmup).length} de {Object.values(activeWorkout.logs).flat().filter((set) => !set.isWarmup).length} series
              </p>
              <Button size="lg" className="mt-5 w-full" onClick={() => {
                void hapticTap();
                if (onResumeWorkout) onResumeWorkout();
                else onNavigate("training");
              }}>Continuar entreno</Button>
              <Button type="button" variant="plain" size="sm" className="mt-1 w-full" onClick={() => { void hapticTap(); void discardActiveWorkout(); }}>
                Descartar sesión
              </Button>
            </div>
          ) : canStart ? (
            <button
              type="button"
              onClick={() => {
                void hapticTap();
                if (onStartWorkout) onStartWorkout();
                else onNavigate("training");
              }}
              className="group block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              aria-label={`Empezar ${sessionTitle}`}
            >
              <span className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
                <span className="block min-w-0">
                  <span className="block truncate type-title1">{String(sessionTitle).split(" · ")[0]}</span>
                  {String(sessionTitle).includes(" · ") && (
                    <span className="mt-0.5 block truncate type-subhead text-muted-foreground">{String(sessionTitle).split(" · ").slice(1).join(" · ")}</span>
                  )}
                  {sessionDetail.length > 0 && (
                    <span className="mt-1 block type-subhead tabular-nums text-muted-foreground">
                      {sessionDetail.map((part, index) => (
                        <span key={`${index}-${part}`}>{index > 0 && " · "}{part}</span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="flex h-[50px] w-full shrink-0 items-center justify-center rounded-[14px] bg-primary px-5 type-headline text-primary-foreground transition-[opacity,transform] duration-150 ease-out group-active:scale-[0.98] group-active:opacity-80 md:w-auto md:min-w-[14rem]">
                  Empezar entreno
                </span>
              </span>
            </button>
          ) : completedToday ? (
            // Hecho: una tarjeta compacta con la sesión, no un estado vacío.
            <button
              type="button"
              onClick={() => { void hapticTap(); onNavigate("training"); }}
              className="flex w-full items-center gap-3.5 rounded-2xl bg-card p-4 text-left transition-transform duration-150 active:scale-[0.98] lg:max-w-2xl"
              aria-label="Ver el resumen de la sesión de hoy"
            >
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="h-5 w-5" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block type-footnote font-semibold text-success">Hecho hoy</span>
                <span className="block truncate type-headline">{todayPlan ? String(planTitle(todayPlan)).split(" · ")[0] : "Sesión completada"}</span>
              </span>
              <span className="shrink-0 type-subhead text-primary">Resumen</span>
            </button>
          ) : (
            <EmptyState
              rest
              icon={Moon}
              title="Hoy toca descansar"
              description={nextSession ?? "Tu plan aún no tiene sesiones."}
              action={<Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => { void hapticTap(); onNavigate("training"); }}>Entrenar igualmente</Button>}
            />
          )}
          {activeWorkout && !activeWorkoutIsToday && (
            <div className="mt-4 rounded-2xl bg-card px-4 py-3 text-left">
              <p className="type-footnote text-muted-foreground">
                Tienes una sesión sin terminar del {activeWorkoutDate}.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => {
                  void hapticTap();
                  if (onResumeWorkout) onResumeWorkout();
                  else onNavigate("training");
                }}>Reanudar</Button>
                <Button type="button" variant="plain" size="sm" onClick={() => { void hapticTap(); void discardActiveWorkout(); }}>
                  Descartar
                </Button>
              </div>
            </div>
          )}
        </div>

      {/* Widgets de Inicio: dos cuadrados lado a lado, Nutrición y Último récord. */}
      <section className="mt-8 lg:mt-12">
      <div className="grid grid-cols-2 gap-3 lg:gap-4 [&>*]:aspect-square">
        <OverviewRow
          title="Nutrición"
          value={nutrition && calorieTarget ? <>{calorieTarget.toLocaleString("es-ES")}<span className="ml-1 font-sans type-subhead font-semibold text-muted-foreground">kcal</span></> : undefined}
          onClick={() => onNavigate("nutrition")}
          icon={
            nutrition ? (
              <ProgressRing value={meals.length ? (doneMealCount / meals.length) * 100 : 0} size={32} stroke={3.5}>
                <Apple className="h-[14px] w-[14px]" strokeWidth={2.25} />
              </ProgressRing>
            ) : (
              <ProgressRing value={0} size={32} stroke={3.5} className="text-muted-foreground">
                <LockKeyhole className="h-[14px] w-[14px]" strokeWidth={2.25} />
              </ProgressRing>
            )
          }
          description={<><span>{nutritionMain}</span>{nutritionExtra && <span>{` · ${nutritionExtra}`}</span>}</>}
        />
        <OverviewRow
          title={lastPr ? lastPr.exercise_name : "Récords"}
          value={lastPr ? <>{lastPr.weight.toLocaleString("es-ES")}<span className="ml-1 font-sans type-subhead font-semibold text-muted-foreground">kg</span></> : undefined}
          onClick={() => onNavigate("progress")}
          icon={(
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Trophy className="h-[14px] w-[14px]" strokeWidth={2.25} />
            </span>
          )}
          description={lastPr
            ? `${lastPr.reps} reps · ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(lastPr.achieved_at))}`
            : "Tu primer récord llegará entrenando"}
        />
      </div>
      </section>
      </div>
      {discardDialog}
    </div>
  );
};

export default HomeOverview;
