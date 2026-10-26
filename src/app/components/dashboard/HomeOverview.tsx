import { readMealsDone as readMealsDoneFor } from "@/shared/lib/mealsDone";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Apple, Check, ChevronRight, Clock, LockKeyhole, Moon, Sparkles } from "lucide-react";
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
  /** Al ir a «training» puede pedirse un día concreto: la tira de la semana lo usa. */
  onNavigate: (section: UserSection, day?: string) => void;
  onStartWorkout?: () => void;
  onResumeWorkout?: () => void;
  profileName?: string;
  macros?: Macros | null;
  completedThisWeek?: number;
  completedToday?: boolean;
  /** Días (day_label) ya completados esta semana, para pintar ✓ en la tira. */
  completedDays?: Set<string>;
  coaching?: boolean;
  nutrition?: boolean;
  planStatus?: string;
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

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

interface ChatPreviewMessage {
  id: string;
  sender_id: string;
  content: string;
  media_type: string | null;
  created_at: string;
}

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
      {value != null && <span className="mt-auto block pt-4 font-rounded text-[30px] font-bold leading-none tracking-tight tabular-nums">{value}</span>}
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
  completedDays,
  coaching = true,
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

  // Foto del día: portada generada con IA según los ejercicios del día
  const exercisesForCover = todayPlan?.type === "gimnasio" ? todayPlan.exercises ?? [] : [];
  const exerciseMetadata = useExerciseMetadata(dayPlans);
  const coverExercises = exercisesForCover;
  const firstExercise = coverExercises[0];
  const sessionCover = useSessionCover(
    coverExercises.map((e) => e.exercise_id),
    firstExercise ? (exerciseMetadata.byId[firstExercise.exercise_id] || exerciseMetadata.byName[firstExercise.name])?.image_url || firstExercise.image_url || null : null,
  );

  const [chatMessages, setChatMessages] = useState<ChatPreviewMessage[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [completedMeals, setCompletedMeals] = useState<Set<string>>(new Set());
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const todayName = DAYS_ORDER[todayIndex];
  const todayPlan = dayPlans.find((plan) => plan.day === todayName);
  const scheduledDays = dayPlans.filter((plan) => plan.type === "gimnasio" || plan.type === "actividad");
  const plannedDays = new Set(scheduledDays.map((plan) => plan.day));
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

  const readMealsDone = useCallback(() => {
    setCompletedMeals(new Set(readMealsDoneFor(userId)));
  }, [userId]);

  useEffect(() => {
    readMealsDone();
    // MealsList avisa al marcar/desmarcar una comida: Hoy debe reflejarlo.
    window.addEventListener("autopilot:meals-updated", readMealsDone);
    return () => window.removeEventListener("autopilot:meals-updated", readMealsDone);
  }, [readMealsDone]);

  useEffect(() => {
    if (!userId || !coaching) return;
    let active = true;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, sender_id, content, media_type, created_at")
        .eq("conversation_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2);
      if (!active) return;
      if (error) {
        setChatError(true);
      } else {
        setChatMessages((data || []).reverse());
      }
      setChatLoaded(true);
    };

    void loadMessages();
    const channel = supabase
      .channel(`home-chat-preview-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_user_id=eq.${userId}`,
      }, (payload) => {
        if (!active) return;
        const message = payload.new as ChatPreviewMessage;
        setChatMessages((current) => [...current, message].slice(-2));
        setChatError(false);
        setChatLoaded(true);
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, coaching]);

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

  const openWeek = () => {
    void hapticTap();
    onNavigate("training", DAYS_ORDER[todayIndex]);
  };

  return (
    // Con la sesión hecha no hay acción que centrar: el contenido se apila sin huecos.
    <div className={cn("flex w-full flex-col", !(completedToday && !activeWorkout) && "flex-1")}>
      {/* En web: dos columnas — saludo + semana a la izquierda, acción a la derecha */}
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[1fr_320px] lg:gap-x-12 lg:items-start">
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

        {scheduledDays.length > 0 && (
          // La semana de un vistazo — clickable: navega a Entrenamiento
          <ol aria-label="Tu semana" className="mt-6 grid grid-cols-7 rounded-2xl bg-card px-2 py-3 md:max-w-sm lg:max-w-xs">
            {DAYS_ORDER.map((day, index) => {
              const isToday = index === todayIndex;
              const trains = plannedDays.has(day);
              const done = Boolean(completedDays?.has(day)) || (isToday && completedToday);
              return (
                <li key={day} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${day}${isToday ? ", hoy" : ""}: ${done ? "completado" : trains ? "con sesión" : "descanso"} — ver entrenamiento`}
                    onClick={() => { void hapticTap(); onNavigate("training", day); }}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full type-subhead transition-opacity active:opacity-60",
                      done
                        ? "bg-primary text-primary-foreground"
                        : isToday
                          ? "bg-primary/15 font-semibold text-primary"
                          : trains
                            ? "text-foreground hover:bg-secondary"
                            : "text-muted-foreground hover:bg-secondary/50",
                    )}
                  >
                    {done ? <Check className="h-[18px] w-[18px]" strokeWidth={2.5} /> : DAY_LETTERS[index]}
                  </button>
                  <span
                    aria-hidden="true"
                    className={cn("h-[5px] w-[5px] rounded-full", trains && !done ? "bg-primary" : "bg-transparent")}
                  />
                </li>
              );
            })}
          </ol>
        )}
        </div>

        {/* Acción principal: centrada en móvil/tablet, columna derecha en web */}
        <div className={cn("flex flex-col lg:flex-none lg:min-w-[320px] lg:max-w-sm lg:py-0 lg:pt-16", completedToday && !activeWorkout ? "pt-3" : "flex-1 justify-center py-8 md:py-10")}>
          {/* Foto del día: portada generada con IA según los ejercicios */}
          {sessionCover && !activeWorkout && (
            <div aria-hidden="true" className="mb-4 h-48 overflow-hidden rounded-[28px] bg-card lg:mb-6">
              <img key={sessionCover} src={sessionCover} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_30%] animate-in fade-in duration-500" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </div>
          )}
          {activeWorkout && activeWorkoutIsToday ? (
            <div className="w-full">
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
              <span className="mt-6 flex h-[50px] w-full items-center justify-center rounded-[14px] bg-primary px-5 type-headline text-primary-foreground transition-[opacity,transform] duration-150 ease-out group-active:scale-[0.98] group-active:opacity-80 md:w-auto md:min-w-[12rem] md:inline-flex lg:w-full lg:flex">
                Empezar entreno
              </span>
            </button>
          ) : completedToday ? (
            // Hecho: una tarjeta compacta con la sesión, no un estado vacío.
            <button
              type="button"
              onClick={() => { void hapticTap(); onNavigate("training"); }}
              className="flex w-full items-center gap-3.5 rounded-2xl bg-card p-4 text-left transition-transform duration-150 active:scale-[0.98]"
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
              description={nextSession ?? "Tu plan aún no tiene sesiones esta semana."}
              action={<Button type="button" variant="secondary" size="lg" className="w-full" onClick={openWeek}>Entrenar igualmente</Button>}
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

      {/* Tarjetas secundarias: Nutrición + Progreso, en su sección con título (todo el ancho en web). */}
      <section className="mt-8 lg:col-span-2 lg:mt-12">
      <h3 className="mb-3 type-title3">Resumen</h3>
      <div className="grid grid-cols-2 gap-3 lg:gap-4">
        <OverviewRow
          title="Nutrición"
          value={nutrition && calorieTarget ? <>{calorieTarget.toLocaleString("es-ES")}<span className="ml-1 type-subhead font-semibold text-muted-foreground">kcal</span></> : undefined}
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
          description={(
            <>
              <span>{nutritionMain}</span>
              {nutritionExtra && <span>{` · ${nutritionExtra}`}</span>}
            </>
          )}
        />
        <OverviewRow
          title="Progreso"
          value={scheduledDays.length ? <>{sessionCount}<span className="type-title3 text-muted-foreground">/{scheduledDays.length}</span></> : undefined}
          onClick={() => onNavigate("progress")}
          icon={(
            <ProgressRing value={scheduledDays.length ? (sessionCount / scheduledDays.length) * 100 : 0} size={32} stroke={3.5}>
              <Sparkles className="h-[14px] w-[14px]" strokeWidth={2.25} />
            </ProgressRing>
          )}
          description={
            scheduledDays.length ? (
              <>
                <span>{`${sessionCount} de ${scheduledDays.length} ${scheduledDays.length === 1 ? "sesión" : "sesiones"}`}</span>
                <span> esta semana</span>
              </>
            ) : "Sin sesiones esta semana"
          }
        />
      </div>
      </section>
      </div>
      {discardDialog}
    </div>
  );
};

export default HomeOverview;
