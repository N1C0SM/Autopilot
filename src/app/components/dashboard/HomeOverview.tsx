import { readMealsDone as readMealsDoneFor } from "@/shared/lib/mealsDone";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Flame as Apple, Check, ChevronRight, Clock, Dumbbell, LockKeyhole } from "lucide-react";
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
import { nextPendingSession, routineSessions } from "@/shared/lib/routineOrder";

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
  /** Navegación del panel. «training» sin día abre la siguiente sesión. */
  onNavigate: (section: UserSection, day?: string) => void;
  /** Abre la rutina indicada para verla/editar sus ejercicios (toque en «Tus rutinas»). */
  onEditRoutine?: (day: string) => void;
  /** Empieza la sesión indicada (la clave `day` de la siguiente pendiente). */
  onStartWorkout?: (day: string) => void;
  onResumeWorkout?: () => void;
  profileName?: string;
  macros?: Macros | null;
  completedThisWeek?: number;
  /** Sesiones de la rutina (su clave `day`) hechas esta semana: se marcan con un check dorado. */
  completedDays?: string[];
  completedToday?: boolean;
  nutrition?: boolean;
  planStatus?: string;
}

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
  const className = "flex min-h-[7.5rem] min-w-0 flex-col rounded-card bg-card p-4 text-left transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const inner = (
    <>
      <span className="flex items-start justify-between">
        <span aria-hidden="true">{icon}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={2.5} aria-hidden="true" />
      </span>
      {value != null && <span className="mt-auto block pt-4 type-figure font-figure font-bold leading-none tracking-tight tabular-nums">{value}</span>}
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
  onEditRoutine,
  onStartWorkout,
  onResumeWorkout,
  profileName,
  macros,
  completedThisWeek = 0,
  completedDays = [],
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
  // Sin días de la semana: la sesión de hoy es la siguiente de la rutina que falta esta semana.
  const sessions = routineSessions(dayPlans);
  const todayPlan = nextPendingSession(sessions, completedDays);
  const todayPlanNumber = todayPlan ? sessions.indexOf(todayPlan) + 1 : 0;
  const weekComplete = sessions.length > 0 && !todayPlan;

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
  const sessionCount = Math.min(completedThisWeek, sessions.length);
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

  const nextSession = todayPlan
    ? `Siguiente: ${planTitle(todayPlan)}.`
    : weekComplete
      ? sessions.length === 1 ? "Has hecho tu sesión de esta semana." : `Has hecho tus ${sessions.length} sesiones de esta semana.`
      : null;

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

  // Una marca por sesión de la rutina (no por día): hecha, la siguiente o pendiente.
  const sessionMarks = sessions.map((plan, index) => ({
    key: plan.day,
    number: index + 1,
    name: planTitle(plan).split(" · ")[0],
    done: completedDays.includes(plan.day),
    isNext: plan === todayPlan,
  }));

  const sessionName = String(sessionTitle).split(" · ")[0];
  const sessionFocus = String(sessionTitle).includes(" · ") ? String(sessionTitle).split(" · ").slice(1).join(" · ") : "";

  return (
    <div className="flex w-full flex-col pb-4 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)] lg:items-start lg:gap-x-10 xl:gap-x-14">
      {/* Cabecera del rediseño (ChatGPT): «Hoy» grande y el saludo en gris */}
      <header className="lg:col-span-2">
        <h2 data-nav-title className="type-large-title leading-tight text-foreground sm:text-[44px] sm:leading-[48px]">Hoy</h2>
        <p className="mt-1 type-subhead text-muted-foreground">
          {firstName ? `Hola, ${firstName}.` : "Hola."}{" "}
          {completedToday
            ? "Buen trabajo."
            : todayPlan?.type === "gimnasio"
              ? "A entrenar."
              : todayPlan?.type === "actividad"
                ? `A ${todayPlan.sport || "moverte"}.`
                : weekComplete
                  ? "Semana completa."
                  : ""}
        </p>
      </header>

      {/* Siguiente sesión de la rutina: la que toca hoy, sea el día que sea */}
      <section className="mt-6 lg:col-start-1 lg:row-start-2 lg:mt-8" aria-label="Tu siguiente sesión">
        {activeWorkout && activeWorkoutIsToday ? (
          <div className="rounded-2xl bg-card p-4">
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
              if (onStartWorkout && todayPlan) onStartWorkout(todayPlan.day);
              else onNavigate("training", todayPlan?.day);
            }}
            className="group relative flex min-h-[156px] w-full overflow-hidden rounded-[22px] border border-border bg-card text-left transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Empezar ${sessionTitle}`}
          >
            {/* Rediseño (ChatGPT): texto a la izquierda, foto a la derecha fundida con la tarjeta y chevron dorado. */}
            {dayPhoto && (
              <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[55%] overflow-hidden bg-secondary">
                <img key={dayPhoto} src={dayPhoto} alt="" decoding="async" className="h-full w-full object-cover object-[50%_30%]" />
                <span className="absolute inset-0 bg-gradient-to-r from-card via-card/55 to-transparent" />
              </span>
            )}
            <span className={cn("relative flex min-w-0 flex-1 flex-col p-[18px]", dayPhoto ? "pr-32" : "pr-16")}>
              <span className="type-footnote text-muted-foreground">
                {`${todayPlan?.type === "actividad" ? "Siguiente actividad" : "Siguiente sesión"} · ${todayPlanNumber} de ${sessions.length}`}
              </span>
              <span className="mt-1.5 line-clamp-2 text-[22px] font-bold leading-7 tracking-[-0.02em]">{sessionName}</span>
              {sessionFocus && <span className="mt-0.5 line-clamp-2 type-subhead text-muted-foreground">{sessionFocus}</span>}

              {sessionDetail.length > 0 && (
                <span className="mt-auto flex items-center gap-1.5 pt-3.5 type-footnote tabular-nums text-muted-foreground">
                  <Dumbbell aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span>
                    {sessionDetail.map((part, index) => (
                      <span key={`${index}-${part}`}>{index > 0 && " · "}{part}</span>
                    ))}
                  </span>
                </span>
              )}
            </span>
            <span aria-hidden="true" className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary transition-opacity group-active:opacity-80">
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
            </span>
          </button>
        ) : completedToday ? (
          <button
            type="button"
            onClick={() => { void hapticTap(); onNavigate("training"); }}
            className="flex w-full items-center gap-3.5 rounded-2xl bg-card p-4 text-left transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ver el resumen de la sesión de hoy"
          >
            <span aria-hidden="true" className="h-14 w-14 shrink-0 overflow-hidden rounded-media bg-secondary">
              <img src={BRAND_PHOTOS.gym} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[13px] font-medium text-success">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />Hecho hoy
              </span>
              <span className="block truncate text-[17px] font-semibold leading-6">Sesión completada</span>
              <span className="block text-[13px] text-muted-foreground">{nextSession ?? "Hoy toca recuperar."}</span>
            </span>
            <span className="shrink-0 text-[15px] font-medium text-primary">Resumen</span>
          </button>
        ) : (
          // Semana completa (o plan sin sesiones): la misma tarjeta que la sesión, con foto real fundida a la derecha y sin dibujos (como `RestCard` en la app).
          <div className="relative overflow-hidden rounded-[22px] border border-border bg-card p-[18px]">
            <img src={BRAND_PHOTOS.gym} alt="" aria-hidden="true" decoding="async" className="absolute inset-y-0 right-0 h-full w-[210px] object-cover object-[50%_35%] opacity-80" />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-card via-card/80 to-card/10" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{weekComplete ? "Semana completa" : "Tu plan"}</p>
              <h3 className="mt-1.5 pr-24 text-[22px] font-bold leading-tight tracking-tight">{weekComplete ? "Toca recuperar" : "Aún no tiene sesiones"}</h3>
              <p className="mt-1 pr-24 type-subhead text-muted-foreground">
                {weekComplete ? `${nextSession} El lunes empieza otra vuelta.` : "Edita tu rutina para añadir tus sesiones."}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="mt-5 w-full"
                onClick={() => {
                  void hapticTap();
                  if (sessions[0] && onStartWorkout) { onStartWorkout(sessions[0].day); return; }
                  if (onEditRoutine) { onEditRoutine(sessions[0]?.day ?? "Lunes"); return; }
                  onNavigate("training");
                }}
              >
                {weekComplete ? "Entrenar igualmente" : "Editar mi rutina"}
              </Button>
            </div>
          </div>
        )}
        {activeWorkout && !activeWorkoutIsToday && (
          <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-3">
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

      {/* Semana compacta: una marca por sesión de la rutina, sin días de la semana */}
      <section className="mt-3 rounded-[22px] border border-border bg-card p-4 lg:col-start-2 lg:row-start-3 lg:mt-4 lg:p-5" aria-label={`Esta semana: ${sessionCount} de ${sessions.length} sesiones`}>
        <div className="flex items-center justify-between">
          <p className="type-headline text-foreground">Esta semana</p>
          <button
            type="button"
            onClick={() => {
              void hapticTap();
              const next = sessions.find((p) => !completedDays.includes(p.day)) ?? sessions[0];
              if (onEditRoutine && next) { onEditRoutine(next.day); return; }
              onNavigate("training");
            }}
            className="-mr-2 inline-flex min-h-11 items-center gap-1 px-2 type-subhead font-semibold text-primary transition-opacity active:opacity-60"
          >
            Ver detalle
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
        {/* Un círculo por sesión: dorado con check si está hecha, anillo dorado la siguiente y gris las pendientes. */}
        {sessionMarks.length > 0 && (
          <div aria-hidden="true" className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(sessionMarks.length, 3)}, minmax(0, 1fr))` }}>
            {sessionMarks.map((mark) => (
              <span key={mark.key} className="flex min-w-0 flex-col items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
                    mark.done
                      ? "bg-primary text-primary-foreground"
                      : mark.isNext
                        ? "border-2 border-primary text-primary"
                        : "border border-foreground/25 text-muted-foreground",
                  )}
                >
                  {mark.done ? <Check className="h-4 w-4" strokeWidth={3} /> : mark.number}
                </span>
                <span className={cn("max-w-full truncate text-[12px]", mark.isNext ? "font-semibold text-foreground" : "text-muted-foreground")}>{mark.name}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Tus rutinas: cada una con sus ejercicios y un botón para empezar */}
      {dayPlans.length > 0 && (
        <section className="mt-3 lg:col-start-1 lg:row-start-3 lg:mt-4">
          <p className="mb-2 type-headline text-foreground">Tus rutinas</p>
          <div className="space-y-3">
            {dayPlans.map((plan) => (
              <div key={plan.day} className="rounded-[22px] border border-border bg-card p-4">
                <button
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    if (onEditRoutine) onEditRoutine(plan.day);
                  }}
                  className="flex w-full items-start gap-3 text-left transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Ver y editar ${formatTrainingTitle(plan.routine_name, plan.muscle_focus) || "Entrenamiento"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block type-subhead font-semibold text-foreground">{formatTrainingTitle(plan.routine_name, plan.muscle_focus) || "Entrenamiento"}</span>
                    {plan.muscle_focus && <span className="mt-0.5 block type-footnote text-muted-foreground">{plan.muscle_focus}</span>}
                    {(plan.exercises ?? []).length > 0 && (
                      <span className="mt-3 flex flex-col gap-1">
                        {(plan.exercises ?? []).slice(0, 4).map((ex, i) => (
                          <span key={`${i}-${ex.name}`} className="flex items-center gap-1.5 type-footnote text-muted-foreground">
                            <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                            <span className="min-w-0 truncate">{ex.name}</span>
                            <span className="ml-auto shrink-0 tabular-nums">{ex.series}×{ex.reps}</span>
                          </span>
                        ))}
                        {(plan.exercises ?? []).length > 4 && (
                          <span className="type-footnote text-muted-foreground">+ {(plan.exercises ?? []).length - 4} más</span>
                        )}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.5} aria-hidden="true" />
                </button>
                <Button
                  type="button"
                  size="lg"
                  className="mt-4 w-full"
                  onClick={() => { void hapticTap(); if (onStartWorkout) onStartWorkout(plan.day); else onNavigate("training", plan.day); }}
                >
                  Empezar
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Nutrición en su tarjeta: kcal del día o, sin plan, la insignia Plus */}
      <div className="mt-3 lg:col-start-1 lg:row-start-3 lg:mt-4">
        <HomeRow
          icon={nutrition ? <Apple className="h-[22px] w-[22px]" strokeWidth={1.75} /> : <LockKeyhole className="h-5 w-5" strokeWidth={1.75} />}
          locked={!nutrition}
          title="Nutrición"
          detail={<><span>{nutritionMain}</span>{nutritionExtra && <span>{` · ${nutritionExtra}`}</span>}</>}
          value={nutrition && calorieTarget ? `${calorieTarget.toLocaleString("es-ES")} kcal` : undefined}
          onClick={() => onNavigate("nutrition")}
        />
      </div>
      {discardDialog}
    </div>
  );
};

/** Fila-tarjeta de Hoy (rediseño): título y una línea gris; valor, icono dorado (gris con candado si está bloqueada) y chevron. */
const HomeRow = ({ icon, title, detail, value, locked = false, onClick }: { icon: ReactNode; title: string; detail: ReactNode; value?: string; locked?: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={() => { void hapticTap(); onClick(); }}
    className="flex min-h-[72px] w-full items-center gap-3.5 rounded-[22px] border border-border bg-card px-[18px] py-4 text-left transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span className="min-w-0 flex-1">
      <span className="block truncate type-headline text-foreground">{title}</span>
      <span className="mt-0.5 line-clamp-2 type-footnote tabular-nums text-muted-foreground">{detail}</span>
    </span>
    {value && <span className="shrink-0 type-subhead font-semibold tabular-nums text-foreground">{value}</span>}
    <span aria-hidden="true" className={cn("flex shrink-0", locked ? "text-muted-foreground" : "text-primary")}>{icon}</span>
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.5} aria-hidden="true" />
  </button>
);

export default HomeOverview;
