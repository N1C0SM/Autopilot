import { readMealsDone as readMealsDoneFor } from "@/shared/lib/mealsDone";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Flame as Apple, Flame, Check, ChevronRight, Clock, Dumbbell, LockKeyhole } from "lucide-react";
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
import ResponsiveSheet from "@/app/components/dashboard/ResponsiveSheet";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { ListGroup, ListRow } from "@/shared/components/ui/list";

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
  hasPlan?: boolean;
  preparingRoutine?: boolean;
  onPrepareRoutine?: () => void;
  /** Navegación del panel. «training» sin día abre la siguiente sesión. */
  onNavigate: (section: UserSection, day?: string) => void;
  /** Empieza la sesión indicada (la clave `day` de la siguiente pendiente). */
  onStartWorkout?: (day: string) => void;
  /** Marca una actividad como hecha en la fecha local. */
  onCompleteActivity?: (day: string) => Promise<boolean>;
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
  hasPlan = true,
  preparingRoutine = false,
  onPrepareRoutine,
  onNavigate,
  onStartWorkout,
  onCompleteActivity,
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<DayPlan | null>(null);
  const [previewCompleted, setPreviewCompleted] = useState(false);

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
  const previewResumable = Boolean(activeWorkout && previewPlan?.day === activeWorkout.plan.day);
  const previewExercises = previewPlan?.exercises ?? [];
  const previewSets = previewExercises.reduce((total, exercise) => total + (Number(exercise.series) || 0), 0);
  const previewDescription = previewCompleted
    ? "Tu sesión de hoy ya está registrada."
    : previewPlan?.type === "gimnasio"
      ? [
        previewExercises.length && `${previewExercises.length} ${previewExercises.length === 1 ? "ejercicio" : "ejercicios"}`,
        previewSets && `${previewSets} ${previewSets === 1 ? "serie" : "series"}`,
      ].filter(Boolean).join(" · ")
      : [previewPlan?.intensity, previewPlan?.duration].filter(Boolean).join(" · ");

  const openSessionPreview = (plan: DayPlan | null, completed = false) => {
    setPreviewPlan(plan);
    setPreviewCompleted(completed);
    setPreviewOpen(true);
  };

  const startPreviewSession = () => {
    if (!previewPlan) return;
    void hapticTap();
    setPreviewOpen(false);
    if (previewResumable && onResumeWorkout) onResumeWorkout();
    else if (onStartWorkout) onStartWorkout(previewPlan.day);
    else onNavigate("training", previewPlan.day);
  };

  const completePreviewActivity = async () => {
    if (!previewPlan) return;
    if (onCompleteActivity) {
      if (!await onCompleteActivity(previewPlan.day)) return;
    } else {
      void hapticTap();
      onNavigate("training", previewPlan.day);
    }
    setPreviewOpen(false);
  };

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
  const routineSubtitle = (plan: DayPlan) => {
    if (plan.muscle_focus) return plan.muscle_focus;
    const titleParts = planTitle(plan).split(" · ");
    if (titleParts.length > 1) return titleParts.slice(1).join(" · ");
    if (plan.type === "actividad") return [plan.intensity, plan.duration].filter(Boolean).join(" · ") || "Sesión de actividad";
    const count = plan.exercises?.length ?? 0;
    return count ? `${count} ${count === 1 ? "ejercicio" : "ejercicios"}` : "Sesión de entrenamiento";
  };
  const routinePhoto = (plan: DayPlan) => {
    const first = plan.exercises?.[0];
    if (!first) return plan.cover_url ?? null;
    const metadata = exerciseMetadata.byId[first.exercise_id] || exerciseMetadata.byName[first.name];
    return plan.cover_url || metadata?.image_url || first.image_url || null;
  };

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
    <div className="flex w-full flex-col gap-5 pb-4">
      {/* Cabecera del rediseño (ChatGPT): «Hoy» grande y el saludo en gris */}
      <header>
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
      <section aria-label="Tu siguiente sesión">
        {!hasPlan ? (
          <div className="rounded-[22px] bg-card p-4">
            <EmptyState
              icon={Dumbbell}
              title="Prepara tu rutina inicial gratis"
              description="Te la preparamos en unos segundos."
            />
            <Button
              size="lg"
              className="mt-4 w-full"
              disabled={preparingRoutine}
              onClick={onPrepareRoutine}
            >
              {preparingRoutine ? "Preparando…" : "Preparar mi rutina gratis"}
            </Button>
          </div>
        ) : activeWorkout && activeWorkoutIsToday ? (
          <div className="rounded-2xl bg-card p-4">
            <p className="text-[13px] font-medium text-primary">En curso</p>
            <h3 className="mt-0.5 text-[17px] font-semibold leading-6">{planTitle(activeWorkout.plan)}</h3>
            <p className="mt-0.5 text-[15px] tabular-nums text-muted-foreground">
              {Object.values(activeWorkout.logs).flat().filter((set) => set.done && !set.isWarmup).length} de {Object.values(activeWorkout.logs).flat().filter((set) => !set.isWarmup).length} series
            </p>
            <Button size="lg" className="mt-4 w-full" onClick={() => {
              void hapticTap();
              openSessionPreview(activeWorkout.plan);
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
              openSessionPreview(todayPlan);
            }}
            className="group relative flex min-h-[156px] w-full overflow-hidden rounded-[22px] bg-card text-left transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0 lg:flex-col lg:rounded-[28px]"
            aria-label={`Ver la sesión ${sessionTitle}`}
          >
            {/* Rediseño (ChatGPT): texto a la izquierda, foto a la derecha fundida con la tarjeta y chevron dorado. */}
            {dayPhoto && (
              <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[55%] overflow-hidden bg-secondary lg:relative lg:inset-auto lg:block lg:h-[340px] lg:w-full">
                <img key={dayPhoto} src={dayPhoto} alt="" decoding="async" className="h-full w-full object-cover object-[50%_30%]" />
                <span className="absolute inset-0 bg-gradient-to-r from-card via-card/55 to-transparent lg:bg-gradient-to-b lg:from-transparent lg:to-black/55" />
              </span>
            )}
            <span className={cn("relative flex min-w-0 flex-1 flex-col p-[18px] lg:flex-none lg:p-6", dayPhoto ? "pr-32 lg:pr-6" : "pr-16")}>
              <span className="type-footnote text-muted-foreground lg:font-semibold lg:uppercase lg:tracking-wide lg:text-primary">
                {`${todayPlan?.type === "actividad" ? "Siguiente actividad" : "Siguiente sesión"} · ${todayPlanNumber} de ${sessions.length}`}
              </span>
              <span className="mt-1.5 line-clamp-2 text-[22px] font-bold leading-7 tracking-[-0.02em] lg:text-[32px] lg:leading-tight">{sessionName}</span>
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
              <span className="mt-5 hidden type-subhead font-semibold text-primary lg:block">Ver la sesión</span>
            </span>
            <span aria-hidden="true" className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary transition-opacity group-active:opacity-80 lg:hidden">
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
            </span>
          </button>
        ) : completedToday ? (
          <button
            type="button"
            onClick={() => { void hapticTap(); openSessionPreview(null, true); }}
            className="group w-full overflow-hidden rounded-[28px] bg-card text-left transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Hecho hoy: Sesión completada. ${nextSession ?? ""}`}
            aria-description="Abre el resumen del entreno de hoy"
          >
            <span aria-hidden="true" className="relative block h-[210px] w-full overflow-hidden bg-secondary">
              <img src={BRAND_PHOTOS.gym} alt="" decoding="async" className="h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/80" />
              <span className="absolute bottom-[18px] left-[18px] inline-flex items-center gap-1.5 text-[12px] font-bold tracking-[0.067em] text-primary">
                <Check className="h-3 w-3" strokeWidth={2.5} />
                HECHO HOY
              </span>
            </span>
            <span className="flex items-center gap-3 p-[18px]">
              <span className="min-w-0 flex-1">
                <span className="block type-title2">Sesión completada</span>
                <span className="block line-clamp-2 type-footnote text-muted-foreground">{nextSession ?? "Buen trabajo. Hoy toca recuperar."}</span>
              </span>
              <span className="shrink-0 type-subhead font-semibold text-primary">Resumen</span>
            </span>
          </button>
        ) : (
          // Semana completa (o plan sin sesiones): la misma tarjeta que la sesión, con foto real fundida a la derecha y sin dibujos (como `RestCard` en la app).
          <div className="relative overflow-hidden rounded-[22px] bg-card p-[18px]">
            <img src={BRAND_PHOTOS.gym} alt="" aria-hidden="true" decoding="async" className="absolute inset-y-0 right-0 h-full w-[210px] object-cover object-[50%_35%] opacity-80" />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-card via-card/80 to-card/10" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{weekComplete ? "Semana completa" : "Tu plan"}</p>
              <h3 className="mt-1.5 pr-24 text-[22px] font-bold leading-tight tracking-tight">{weekComplete ? "Toca recuperar" : "Aún no tiene sesiones"}</h3>
              <p className="mt-1 pr-24 type-subhead text-muted-foreground">
                {weekComplete ? `${nextSession} El lunes empieza otra vuelta.` : "Edita tu rutina para añadir tus sesiones."}
              </p>
              <Button type="button" variant="secondary" size="lg" className="mt-5 w-full" onClick={() => { void hapticTap(); onNavigate("training"); }}>
                {weekComplete ? "Entrenar igualmente" : "Ir a Entrenar"}
              </Button>
            </div>
          </div>
        )}
        {activeWorkout && !activeWorkoutIsToday && (
          <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-3">
            <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">Tienes una sesión sin terminar del {activeWorkoutDate}.</p>
            <Button size="sm" onClick={() => {
              void hapticTap();
              openSessionPreview(activeWorkout.plan);
            }}>Reanudar</Button>
            <Button type="button" variant="plain" size="sm" onClick={() => { void hapticTap(); void discardActiveWorkout(); }}>
              Descartar
            </Button>
          </div>
        )}
      </section>

      {sessions.length > 0 && (
        <section className="lg:hidden" aria-label="Tu programa" data-home-routines>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="type-title3">Tu programa</h3>
            <span className="type-footnote text-muted-foreground">{sessions.length} {sessions.length === 1 ? "sesión" : "sesiones"}</span>
          </div>
          <div className="overflow-hidden rounded-[22px] bg-card">
            {sessions.map((plan, index) => (
              <button
                key={plan.day}
                type="button"
                onClick={() => openSessionPreview(plan)}
                className="relative flex min-h-[76px] w-full items-center gap-3.5 px-3.5 py-2.5 text-left transition-colors active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                aria-label={`Ver sesión ${planTitle(plan)}`}
              >
                <ExerciseThumb image={routinePhoto(plan)} name={planTitle(plan)} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-headline">{planTitle(plan).split(" · ")[0]}</span>
                  <span className="mt-0.5 block truncate type-footnote text-muted-foreground">{routineSubtitle(plan)}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {index < sessions.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[70px] right-3.5 h-px bg-border/60" />}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* El diseño ancho de la app nativa muestra el resumen semanal y nutrición. */}
      <section className="hidden rounded-[22px] bg-card p-4 lg:block" aria-label={`Esta semana: ${sessionCount} de ${sessions.length} sesiones`}>
        <div className="flex items-center justify-between">
          <p className="type-headline text-foreground">Esta semana</p>
          <button
            type="button"
            onClick={() => { void hapticTap(); onNavigate("training"); }}
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

      <div className="hidden lg:block">
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
      <ResponsiveSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={previewCompleted ? "Completado hoy" : previewPlan?.type === "actividad" ? "Siguiente actividad" : "Siguiente sesión"}
        description={previewCompleted ? "Tu sesión de hoy ya está registrada." : `${previewPlan ? planTitle(previewPlan) : ""}${previewDescription ? ` · ${previewDescription}` : ""}`}
        footer={
          previewCompleted ? (
            <Button size="lg" className="w-full" onClick={() => { void hapticTap(); setPreviewOpen(false); onNavigate("progress"); }}>
              Ver mi progreso
            </Button>
          ) : previewPlan ? (
            previewPlan.type === "actividad" ? (
              <Button size="lg" className="w-full" onClick={() => void completePreviewActivity()}>
                Marcar actividad como hecha
              </Button>
            ) : (
              <Button size="lg" className="w-full" onClick={startPreviewSession}>
                {previewResumable ? "Continuar entreno" : "Empezar entrenamiento"}
              </Button>
            )
          ) : null
        }
      >
        {previewCompleted ? null : previewPlan?.type === "gimnasio" ? (
          previewExercises.length ? (
            <ListGroup aria-label="Ejercicios de la sesión">
              {previewExercises.map((exercise, index) => {
                const metadata = exerciseMetadata.byId[exercise.exercise_id] || exerciseMetadata.byName[exercise.name];
                const image = metadata?.image_url || exercise.image_url;
                const info = [exercise.rest, exercise.muscle_group || metadata?.muscle_group].filter(Boolean).join(" · ");
                return (
                  <ListRow
                    key={`${previewPlan.day}-${exercise.exercise_id || exercise.name}-${index}`}
                    leading={<ExerciseThumb image={image} name={exercise.name} size="md" />}
                    title={exercise.name}
                    subtitle={info || undefined}
                    value={`${exercise.series} × ${exercise.reps}`}
                  />
                );
              })}
            </ListGroup>
          ) : (
            <p className="py-4 type-subhead text-muted-foreground">Esta sesión no tiene ejercicios todavía.</p>
          )
        ) : previewPlan ? (
          <ListGroup aria-label="Detalle de la actividad">
            <ListRow icon={<Flame />} title="Intensidad" value={previewPlan.intensity || "—"} />
            <ListRow icon={<Clock />} title="Duración" value={previewPlan.duration || "—"} />
          </ListGroup>
        ) : null}
      </ResponsiveSheet>
    </div>
  );
};

/** Fila-tarjeta de Hoy (rediseño): título y una línea gris; valor, icono dorado (gris con candado si está bloqueada) y chevron. */
const HomeRow = ({ icon, title, detail, value, locked = false, onClick }: { icon: ReactNode; title: string; detail: ReactNode; value?: string; locked?: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={() => { void hapticTap(); onClick(); }}
    className="flex min-h-[72px] w-full items-center gap-3.5 rounded-[22px] bg-card px-[18px] py-4 text-left transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
