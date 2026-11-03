import { readMealsDone as readMealsDoneFor } from "@/shared/lib/mealsDone";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Apple, Check, ChevronRight, Clock, LockKeyhole, Trophy } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
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
  const className = "flex min-h-[7.5rem] min-w-0 flex-col rounded-media bg-card p-4 text-left transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
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

  const weekMarks = DAYS_ORDER.map((day, index) => ({
    letter: ["L", "M", "X", "J", "V", "S", "D"][index],
    scheduled: scheduledDays.some((plan) => plan.day === day),
    isToday: index === todayIndex,
  }));

  const sessionName = String(sessionTitle).split(" · ")[0];
  const sessionFocus = String(sessionTitle).includes(" · ") ? String(sessionTitle).split(" · ").slice(1).join(" · ") : "";

  return (
    <div className="flex w-full flex-col pb-4">
      {/* Cabecera compacta: fecha y saludo discreto, sin titular de marketing */}
      <header>
        <p className="text-[13px] font-medium text-muted-foreground">{greetingDate}</p>
        <h2 data-nav-title className="mt-0.5 text-[22px] font-semibold leading-7 text-foreground">
          {firstName ? `Hola, ${firstName}.` : "Hola."}{" "}
          <span className="font-normal text-muted-foreground">
            {completedToday
              ? "Buen trabajo."
              : todayPlan?.type === "gimnasio"
                ? "A entrenar."
                : todayPlan?.type === "actividad"
                  ? `A ${todayPlan.sport || "moverte"}.`
                  : "Hoy, a recuperar."}
          </span>
        </h2>
      </header>

      {/* Entrenamiento de hoy */}
      <section className="mt-6" aria-label="Entrenamiento de hoy">
        <p className="mb-2 text-[13px] font-medium text-muted-foreground">Entrenamiento de hoy</p>
        {activeWorkout && activeWorkoutIsToday ? (
          <div className="rounded-2xl bg-card p-4 lg:max-w-xl">
            <p className="text-[13px] font-medium text-primary">En curso</p>
            <h3 className="mt-0.5 text-[17px] font-semibold leading-6">{planTitle(activeWorkout.plan)}</h3>
            <p className="mt-0.5 text-[15px] tabular-nums text-muted-foreground">
              {Object.values(activeWorkout.logs).flat().filter((set) => set.done && !set.isWarmup).length} de {Object.values(activeWorkout.logs).flat().filter((set) => !set.isWarmup).length} series
            </p>
            <Button size="lg" className="mt-4 w-full" onClick={() => {
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
            className="group block w-full rounded-2xl bg-card p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:max-w-xl"
            aria-label={`Empezar ${sessionTitle}`}
          >
            <span className="flex items-center gap-3.5">
              {dayPhoto && (
                <span aria-hidden="true" className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-secondary">
                  <img key={dayPhoto} src={dayPhoto} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
                </span>
              )}
              <span className="block min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold leading-6">{sessionName}</span>
                {sessionFocus && <span className="block truncate text-[15px] text-muted-foreground">{sessionFocus}</span>}
                {sessionDetail.length > 0 && (
                  <span className="mt-0.5 block text-[13px] tabular-nums text-muted-foreground">
                    {sessionDetail.map((part, index) => (
                      <span key={`${index}-${part}`}>{index > 0 && " · "}{part}</span>
                    ))}
                  </span>
                )}
              </span>
            </span>
            <span className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-primary text-[17px] font-semibold text-primary-foreground transition-opacity duration-150 group-active:opacity-80">
              Empezar entreno
            </span>
          </button>
        ) : completedToday ? (
          <button
            type="button"
            onClick={() => { void hapticTap(); onNavigate("training"); }}
            className="flex w-full items-center gap-3.5 rounded-2xl bg-card p-4 text-left transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:max-w-xl"
            aria-label="Ver el resumen de la sesión de hoy"
          >
            <span aria-hidden="true" className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
              <img src={sessionCover || BRAND_PHOTOS.gym} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[13px] font-medium text-success">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />Hecho hoy
              </span>
              <span className="block truncate text-[17px] font-semibold leading-6">{todayPlan ? sessionName : "Sesión completada"}</span>
              <span className="block text-[13px] text-muted-foreground">{nextSession ?? "Hoy toca recuperar."}</span>
            </span>
            <span className="shrink-0 text-[15px] font-medium text-primary">Resumen</span>
          </button>
        ) : (
          <div className="rounded-2xl bg-card p-4 lg:max-w-xl">
            <h3 className="text-[17px] font-semibold leading-6">Hoy toca descansar</h3>
            <p className="mt-0.5 text-[15px] text-muted-foreground">{nextSession ?? "Tu plan aún no tiene sesiones."}</p>
            <Button type="button" variant="secondary" size="lg" className="mt-4 w-full" onClick={() => { void hapticTap(); onNavigate("training"); }}>Entrenar igualmente</Button>
          </div>
        )}
        {activeWorkout && !activeWorkoutIsToday && (
          <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-3 lg:max-w-xl">
            <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">Tienes una sesión sin terminar del {activeWorkoutDate}.</p>
            <Button size="sm" onClick={() => {
              void hapticTap();
              if (onResumeWorkout) onResumeWorkout();
              else onNavigate("training");
            }}>Reanudar</Button>
            <Button type="button" variant="plain" size="sm" onClick={() => { void hapticTap(); void discardActiveWorkout(); }}>
              Descartar
            </Button>
          </div>
        )}
      </section>

      {/* Semana compacta: sesiones hechas y días con sesión, sin navegación por días */}
      <section className="mt-7 lg:max-w-xl" aria-label={`Esta semana: ${sessionCount} de ${scheduledDays.length} sesiones`}>
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-medium text-muted-foreground">Esta semana</p>
          <p className="text-[13px] tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{sessionCount}</span> de {scheduledDays.length} sesiones</p>
        </div>
        <div aria-hidden="true" className="mt-2.5 grid grid-cols-7 gap-1">
          {weekMarks.map((mark) => (
            <span key={mark.letter} className="flex flex-col items-center gap-1.5">
              <span className={cn("text-[12px]", mark.isToday ? "font-semibold text-foreground" : "text-muted-foreground")}>{mark.letter}</span>
              <span className={cn("h-1 w-full rounded-full", mark.scheduled ? (mark.isToday ? "bg-primary" : "bg-foreground/35") : "bg-secondary")} />
            </span>
          ))}
        </div>
      </section>

      {/* Progreso: filas con valores reales */}
      <section className="mt-7 lg:max-w-xl">
        <p className="mb-1 text-[13px] font-medium text-muted-foreground">Progreso</p>
        <ul data-home-rows className="divide-y divide-border/60">
          <li>
            <HomeRow
              icon={nutrition ? <Apple className="h-5 w-5" strokeWidth={1.75} /> : <LockKeyhole className="h-5 w-5" strokeWidth={1.75} />}
              title="Nutrición"
              detail={<><span>{nutritionMain}</span>{nutritionExtra && <span>{` · ${nutritionExtra}`}</span>}</>}
              value={nutrition && calorieTarget ? `${calorieTarget.toLocaleString("es-ES")} kcal` : undefined}
              onClick={() => onNavigate("nutrition")}
            />
          </li>
          <li>
            <HomeRow
              icon={<Trophy className="h-5 w-5" strokeWidth={1.75} />}
              title={lastPr ? lastPr.exercise_name : "Récords"}
              detail={lastPr
                ? `${lastPr.reps} reps · ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(lastPr.achieved_at))}`
                : "Tu primer récord llegará entrenando"}
              value={lastPr ? `${lastPr.weight.toLocaleString("es-ES")} kg` : undefined}
              onClick={() => onNavigate("progress")}
            />
          </li>
        </ul>
      </section>
      {discardDialog}
    </div>
  );
};

/** Fila de Hoy: icono de línea, título, detalle y valor a la derecha. */
const HomeRow = ({ icon, title, detail, value, onClick }: { icon: ReactNode; title: string; detail: ReactNode; value?: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={() => { void hapticTap(); onClick(); }}
    className="flex min-h-[60px] w-full items-center gap-3 py-3 text-left transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span aria-hidden="true" className="flex h-5 w-5 shrink-0 text-muted-foreground">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-medium text-foreground">{title}</span>
      <span className="block truncate text-[13px] tabular-nums text-muted-foreground">{detail}</span>
    </span>
    {value && <span className="shrink-0 text-[15px] font-semibold tabular-nums text-foreground">{value}</span>}
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" strokeWidth={2} aria-hidden="true" />
  </button>
);

export default HomeOverview;
