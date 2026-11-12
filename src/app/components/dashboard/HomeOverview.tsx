import { readMealsDone as readMealsDoneFor } from "@/shared/lib/mealsDone";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Beef, Flame, Check, ChevronRight, Clock, Dumbbell, Play, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { supabase } from "@/shared/integrations/supabase/client";
import type { DayPlan } from "@/shared/types/training";
import type { UserSection } from "@/app/components/UserSidebar";
import { formatTrainingTitle } from "@/shared/lib/trainingDisplay";
import { hapticTap } from "@/shared/lib/native";
import { nutritionMacroError } from "@/shared/lib/nutritionValidation";
import { cn } from "@/shared/lib/utils";
import { readActiveWorkout, clearActiveWorkout, clearPendingOfflineSeries, isActiveWorkoutToday, formatDraftDate, ACTIVE_WORKOUT_EVENT, type ActiveWorkout } from "@/shared/lib/activeWorkout";
import { toast } from "sonner";
import { useConfirm } from "@/app/components/admin/content/useConfirm";
import { useSessionCover } from "@/shared/hooks/useSessionCover";
import { useExerciseMetadata } from "@/shared/hooks/useExerciseMetadata";
import { BRAND_PHOTOS, useBrandPhotos } from "@/shared/lib/brandPhotos";
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
  /** «Entreno vacío»: eliges los ejercicios y empiezas, sin rutina (como en el iPhone). */
  onEmptyWorkout?: () => void;
  /** «Editar» en «Tu programa»: abre el editor de la rutina. */
  onEditRoutine?: () => void;
  profileName?: string;
  macros?: Macros | null;
  completedThisWeek?: number;
  /** Sesiones de la rutina (su clave `day`) hechas esta semana: se marcan con un check dorado. */
  completedDays?: string[];
  completedToday?: boolean;
  /** Fechas locales (AAAA-MM-DD) de esta semana con algún entreno o actividad hecha: la tira de días. */
  trainedDates?: string[];
  nutrition?: boolean;
  planStatus?: string;
}

const WEEKDAYS = [["L", "lunes"], ["M", "martes"], ["X", "miércoles"], ["J", "jueves"], ["V", "viernes"], ["S", "sábado"], ["D", "domingo"]] as const;
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** La semana en curso, de lunes a domingo (como `weekDays` en `HomeView.swift`). */
const weekDays = (now: Date) => {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const today = localDate(now);
  return WEEKDAYS.map(([letter, name], index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    return { letter, name, day: date.getDate(), key: localDate(date), isToday: localDate(date) === today };
  });
};

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
  onEmptyWorkout,
  onEditRoutine,
  profileName,
  macros,
  completedThisWeek = 0,
  completedDays = [],
  completedToday = false,
  trainedDates = [],
  nutrition = true,
  planStatus,
}: Props) => {
  useBrandPhotos(); // repinta las fotos de marca cuando llega su URL actual
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
    // Como la maqueta: «60 min · 6 ejercicios».
    const minutes = estimateMinutes(todayPlan);
    if (minutes) sessionDetail.push(`${minutes} min`);
    if (exerciseCount) sessionDetail.push(`${exerciseCount} ${exerciseCount === 1 ? "ejercicio" : "ejercicios"}`);
  } else if (todayPlan?.type === "actividad") {
    sessionDetail.push(...[todayPlan.intensity, todayPlan.duration].filter((value): value is string => Boolean(value)));
  }

  const nextSession = todayPlan
    ? `Siguiente: ${planTitle(todayPlan)}.`
    : weekComplete
      ? sessions.length === 1 ? "Has hecho tu sesión de esta semana." : `Has hecho tus ${sessions.length} sesiones de esta semana.`
      : null;

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

  const sessionName = String(sessionTitle).split(" · ")[0];
  // El foco tal cual (como en «Tu plan»); sin él, lo que el título lleva tras el «·».
  const sessionFocus = todayPlan?.muscle_focus?.trim() || (String(sessionTitle).includes(" · ") ? String(sessionTitle).split(" · ").slice(1).join(" · ") : "");
  const week = weekDays(now);
  const trained = new Set(trainedDates);
  // Cifras del día: objetivo de kcal y proteína (anillo = comidas marcadas hoy) y sesiones de la semana.
  const mealsProgress = meals.length ? doneMealCount / meals.length : 0;
  const proteinTarget = macros && !macroError ? Math.round(macros.protein) : null;
  const headline = completedToday
    ? "Buen trabajo hoy."
    : weekComplete
      ? "Semana completa."
      : "La constancia crea el cambio.";

  const startToday = () => {
    if (!todayPlan) return;
    void hapticTap();
    if (todayPlan.type !== "gimnasio") openSessionPreview(todayPlan);
    else if (onStartWorkout) onStartWorkout(todayPlan.day);
    else onNavigate("training", todayPlan.day);
  };

  return (
    // Diseño de ChatGPT: la misma columna en el móvil y, más grande y centrada, en la web ancha (como el iPhone).
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 pb-4">
      {/* Saludo: «Hoy» pequeño, el nombre grande y una línea en gris */}
      <header>
        <h2 data-nav-title className="type-subhead font-medium text-muted-foreground">Hoy</h2>
        <p className="mt-0.5 truncate text-[34px] font-bold leading-[40px] tracking-[-0.02em] text-foreground">{firstName || "Hola"}</p>
        <p className="mt-1 type-subhead text-muted-foreground">{headline}</p>
      </header>

      {/* La semana en curso: un día por píldora, hoy con borde dorado y un punto en los días entrenados */}
      <ol aria-label="Esta semana" className="grid grid-cols-7 gap-1.5">
        {week.map((day) => {
          const done = trained.has(day.key);
          return (
            <li
              key={day.key}
              aria-label={`${day.name} ${day.day}${day.isToday ? ", hoy" : ""}${done ? ", entrenaste" : ""}`}
              aria-current={day.isToday ? "date" : undefined}
              className={cn(
                "flex h-[68px] min-w-0 flex-col items-center justify-center gap-1 rounded-full bg-card",
                day.isToday && "ring-[1.5px] ring-inset ring-primary",
              )}
            >
              <span aria-hidden="true" className="text-[11px] font-medium text-muted-foreground">{day.letter}</span>
              <span aria-hidden="true" className={cn("text-[17px] font-semibold leading-none tabular-nums", day.isToday ? "text-primary" : "text-foreground")}>{day.day}</span>
              <span aria-hidden="true" className={cn("h-1 w-1 rounded-full", done ? "bg-primary" : "bg-transparent")} />
            </li>
          );
        })}
      </ol>

      {/* Siguiente sesión de la rutina: la que toca hoy, sea el día que sea */}
      <section aria-label="Tu siguiente sesión">
        {!hasPlan ? (
          <div className="rounded-[28px] bg-card p-4">
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
          <div className="rounded-[28px] bg-card p-5">
            <p className="type-footnote font-semibold text-primary">En curso</p>
            <h3 className="mt-1 text-[22px] font-bold leading-7 tracking-[-0.02em]">{planTitle(activeWorkout.plan)}</h3>
            <p className="mt-0.5 type-subhead tabular-nums text-muted-foreground">
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
        ) : canStart && todayPlan ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                void hapticTap();
                openSessionPreview(todayPlan);
              }}
              className="relative flex min-h-[188px] w-full overflow-hidden rounded-[28px] bg-card text-left transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[240px]"
              aria-label={`Ver la sesión ${sessionTitle}`}
            >
              {/* Foto de la sesión a la derecha, fundida con la tarjeta */}
              {dayPhoto && (
                // Fundida con una máscara (no con un degradado del color de la tarjeta): sin corte sobre la luz de la tarjeta.
                <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[58%] overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_60%)]">
                  <img key={dayPhoto} src={dayPhoto} alt="" decoding="async" className="h-full w-full object-cover object-[50%_30%]" />
                </span>
              )}
              <span className={cn("relative flex min-w-0 flex-1 flex-col p-5 sm:p-7", dayPhoto ? "pr-36 sm:pr-64" : "pr-20")}>
                <span className="flex items-center gap-1.5 type-footnote font-semibold text-muted-foreground">
                  <Dumbbell aria-hidden="true" className="h-4 w-4 text-primary" strokeWidth={2} />
                  {todayPlan.type === "actividad" ? "Actividad" : "Entrenamiento"}
                </span>
                <span className="mt-2 line-clamp-2 text-[28px] font-bold leading-8 tracking-[-0.02em] sm:text-[34px] sm:leading-10">{sessionName}</span>
                {sessionFocus && <span className="mt-1 line-clamp-2 type-subhead text-muted-foreground">{sessionFocus}</span>}
                {sessionDetail.length > 0 && (
                  <span className="mt-auto pt-4 type-footnote tabular-nums text-muted-foreground">{sessionDetail.join(" · ")}</span>
                )}
              </span>
            </button>
            {/* Empezar a un toque: el botón redondo dorado de la maqueta */}
            <button
              type="button"
              onClick={startToday}
              aria-label={todayPlan.type === "actividad" ? `Ver la actividad ${sessionName}` : `Empezar ${sessionName}`}
              className="btn-gold absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:bottom-6 sm:right-6"
            >
              <Play aria-hidden="true" className="ml-0.5 h-6 w-6" fill="currentColor" strokeWidth={0} />
            </button>
          </div>
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
          <div className="relative overflow-hidden rounded-[28px] bg-card p-5">
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

      {/* Tu día en tres cifras con anillo: kcal y proteína del objetivo y las sesiones de la semana */}
      <section aria-label="Tu día" className="grid grid-cols-3 gap-3">
        <MetricTile
          icon={Flame}
          progress={mealsProgress}
          value={calorieTarget ? calorieTarget.toLocaleString("es-ES") : null}
          caption="kcal"
          label="Calorías"
          onClick={() => onNavigate("nutrition")}
        />
        <MetricTile
          icon={Beef}
          progress={mealsProgress}
          value={proteinTarget ? String(proteinTarget) : null}
          caption="g proteína"
          label="Proteína"
          onClick={() => onNavigate("nutrition")}
        />
        <MetricTile
          icon={Dumbbell}
          progress={sessions.length ? sessionCount / sessions.length : 0}
          value={sessions.length ? `${sessionCount}/${sessions.length}` : null}
          caption="sesiones"
          label="Sesiones"
          onClick={() => onNavigate("training")}
        />
      </section>

      {/* Tu plan: lo hecho esta semana con su barra y, debajo, las sesiones de la rutina */}
      {sessions.length > 0 && (
        <section aria-label="Tu plan" data-home-routines>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="type-title3">Tu plan</h3>
            {onEditRoutine && (
              <button type="button" onClick={() => { void hapticTap(); onEditRoutine(); }} className="-my-3 ml-auto min-h-11 px-1 type-subhead font-semibold text-primary active:opacity-60">
                Editar
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-[22px] bg-card">
            <div className="px-[18px] pb-4 pt-[18px]">
              <p className="type-headline">Esta semana</p>
              <p className="mt-0.5 type-footnote tabular-nums text-muted-foreground">
                {sessionCount} de {sessions.length} {sessions.length === 1 ? "sesión completada" : "sesiones completadas"}
              </p>
              <div
                role="progressbar"
                aria-label="Sesiones de esta semana"
                aria-valuemin={0}
                aria-valuemax={sessions.length}
                aria-valuenow={sessionCount}
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
              >
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(sessionCount / sessions.length) * 100}%` }} />
              </div>
            </div>
            {sessions.map((plan) => {
              const done = completedDays.includes(plan.day);
              return (
                <button
                  key={plan.day}
                  type="button"
                  onClick={() => openSessionPreview(plan)}
                  className="relative flex min-h-[76px] w-full items-center gap-3.5 px-3.5 py-2.5 text-left transition-colors active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  aria-label={`Ver sesión ${planTitle(plan)}${done ? ", hecha esta semana" : ""}`}
                >
                  <span aria-hidden="true" className="absolute left-3.5 right-3.5 top-0 h-px bg-border/60" />
                  <ExerciseThumb image={routinePhoto(plan)} name={planTitle(plan)} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-headline">{planTitle(plan).split(" · ")[0]}</span>
                    <span className="mt-0.5 block truncate type-footnote text-muted-foreground">{routineSubtitle(plan)}</span>
                  </span>
                  {done ? (
                    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {onEmptyWorkout && (
        <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => { void hapticTap(); onEmptyWorkout(); }}>
          <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
          Entreno vacío
        </Button>
      )}

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

/**
 * Cifra del día con anillo (diseño de ChatGPT): anillo dorado con su icono, la cifra grande y debajo
 * su unidad en gris («kcal», «g proteína»). Sin cifra, «Sin datos» y su nombre, sin guiones.
 */
const MetricTile = ({ icon: Icon, progress, value, caption, label, onClick }: {
  icon: LucideIcon;
  progress: number;
  value: string | null;
  caption: string;
  label: string;
  onClick: () => void;
}) => {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <button
      type="button"
      onClick={() => { void hapticTap(); onClick(); }}
      className="flex min-w-0 flex-col items-start rounded-[22px] bg-card p-3.5 text-left transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
      aria-label={value ? `${label}: ${value} ${caption}` : `${label}: sin datos`}
    >
      <span aria-hidden="true" className="relative flex h-10 w-10 items-center justify-center">
        <svg viewBox="0 0 40 40" className="absolute inset-0 h-10 w-10 -rotate-90">
          <circle cx="20" cy="20" r={radius} fill="none" strokeWidth="3.5" className="stroke-secondary" />
          {clamped > 0 && (
            <circle cx="20" cy="20" r={radius} fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-primary"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped)} />
          )}
        </svg>
        <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
      </span>
      <span aria-hidden="true" className={cn("mt-3 max-w-full truncate leading-7 sm:leading-8", value ? "text-[24px] font-bold tracking-[-0.02em] tabular-nums sm:text-[30px]" : "type-footnote text-muted-foreground")}>
        {value ?? "Sin datos"}
      </span>
      <span aria-hidden="true" className="mt-0.5 max-w-full truncate type-footnote text-muted-foreground">{value ? caption : label}</span>
    </button>
  );
};

export default HomeOverview;
