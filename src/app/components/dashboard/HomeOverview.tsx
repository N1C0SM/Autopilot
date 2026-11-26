import { readMealsDone as readMealsDoneFor } from "@/shared/lib/mealsDone";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, Clock, Dumbbell, Flame, Play } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { supabase } from "@/shared/integrations/supabase/client";
import type { DayPlan } from "@/shared/types/training";
import type { UserSection } from "@/app/components/UserSidebar";
import { formatTrainingTitle } from "@/shared/lib/trainingDisplay";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { nutritionMacroError } from "@/shared/lib/nutritionValidation";
import { groupedInt } from "@/shared/lib/workoutSummaryFormat";
import { cn } from "@/shared/lib/utils";
import { readActiveWorkout, clearActiveWorkout, clearPendingOfflineSeries, isActiveWorkoutToday, formatDraftDate, ACTIVE_WORKOUT_EVENT, type ActiveWorkout } from "@/shared/lib/activeWorkout";
import { toast } from "sonner";
import { useConfirm } from "@/app/components/admin/content/useConfirm";
import { useSessionCover } from "@/shared/hooks/useSessionCover";
import { useExerciseMetadata } from "@/shared/hooks/useExerciseMetadata";
import { BRAND_PHOTOS, useBrandPhotos } from "@/shared/lib/brandPhotos";
import { nextPendingSession, routineSessions, ROUTINE_KEYS } from "@/shared/lib/routineOrder";
import ResponsiveSheet from "@/app/components/dashboard/ResponsiveSheet";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import ExerciseLoop, { prefetchMedia } from "@/app/components/ExerciseLoop";
import { todayMedia } from "@/shared/lib/mediaPrefetch";
import { fastImage, HERO_SIDE } from "@/shared/lib/fastImage";
import { beginFirstImage, noteImageShown } from "@/shared/lib/mediaTiming";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
// Músculos y duración de la sesión: la misma regla que Entrenar (`sessionSummary.ts`).
import { countLabel as plural, estimateMinutes, sessionMuscles } from "@/shared/lib/sessionSummary";

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
  /** Navegación del panel (Nutrición y Progreso). */
  onNavigate: (section: UserSection, day?: string) => void;
  /** Empieza la sesión indicada (su clave `day`): cualquier sesión se hace cualquier día. */
  onStartWorkout?: (day: string) => void;
  /** Marca una actividad como hecha en la fecha local. */
  onCompleteActivity?: (day: string) => Promise<boolean>;
  onResumeWorkout?: () => void;
  /** «Ver plan» y la cifra de Sesiones: abre Entrenar (la rutina con lo hecho esta semana). */
  onOpenPlan?: () => void;
  /** «Editar plan» en la tarjeta de un plan sin sesiones: abre el editor de la rutina. */
  onEditRoutine?: () => void;
  profileName?: string;
  macros?: Macros | null;
  completedThisWeek?: number;
  /** Sesiones de la rutina (su clave `day`) hechas esta semana. */
  completedDays?: string[];
  completedToday?: boolean;
  /** Fechas locales (AAAA-MM-DD) de esta semana con algún entreno o actividad hecha: el punto de cada día. */
  trainedDates?: string[];
  /** Qué sesiones (`day_label`) se hicieron cada fecha de esta semana: la tarjeta de un día pasado. */
  doneByDate?: Record<string, string[]>;
  nutrition?: boolean;
}

const WEEKDAYS = [["L", "lunes"], ["M", "martes"], ["X", "miércoles"], ["J", "jueves"], ["V", "viernes"], ["S", "sábado"], ["D", "domingo"]] as const;
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase("es") + text.slice(1);

interface WeekDay {
  letter: string;
  name: string;
  day: number;
  /** Fecha local AAAA-MM-DD. */
  key: string;
  /** 0 = lunes … 6 = domingo. */
  index: number;
  /** Clave de la sesión de ese día en el plan (`DayPlan.day`: «Lunes»…«Domingo»). */
  planKey: string;
  isToday: boolean;
}

/** La semana en curso, de lunes a domingo (como `weekDays` en `HomeView.swift`). */
const weekDays = (now: Date): WeekDay[] => {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const today = localDate(now);
  return WEEKDAYS.map(([letter, name], index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    return { letter, name, day: date.getDate(), key: localDate(date), index, planKey: ROUTINE_KEYS[index], isToday: localDate(date) === today };
  });
};

/** «Hoy», «Ayer», «Mañana» o «Lunes 24»: el título del día elegido (como `dayTitle` en la app). */
const dayTitle = (day: WeekDay, todayIndex: number) =>
  day.isToday ? "Hoy" : day.index === todayIndex - 1 ? "Ayer" : day.index === todayIndex + 1 ? "Mañana" : `${capitalized(day.name)} ${day.day}`;
/** «hoy», «ayer», «mañana» o «el lunes 24», para las frases («Completado el lunes 24»). */
const dayPhrase = (day: WeekDay, todayIndex: number) =>
  day.isToday ? "hoy" : day.index === todayIndex - 1 ? "ayer" : day.index === todayIndex + 1 ? "mañana" : `el ${day.name} ${day.day}`;
/** «Sesión de hoy», «Sesión del lunes 24». */
const ofDay = (day: WeekDay, todayIndex: number) => {
  const phrase = dayPhrase(day, todayIndex);
  return phrase.startsWith("el ") ? `del ${phrase.slice(3)}` : `de ${phrase}`;
};

const planTitle = (plan: DayPlan) =>
  plan.type === "gimnasio"
    ? formatTrainingTitle(plan.routine_name, plan.muscle_focus) || "Entrenamiento de fuerza"
    : plan.sport || "Actividad";

/** Lo que dice la tarjeta del día elegido. Es `DayCard` en `HomeView.swift`. */
type DayCard =
  | { kind: "starter" }
  | { kind: "empty" }
  | { kind: "rest"; title: string; line: string }
  | { kind: "trained"; line: string }
  | { kind: "session"; plan: DayPlan; status: "start" | "resume" | "done"; doneOn?: string; detail?: string };

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
  onOpenPlan,
  onEditRoutine,
  profileName,
  macros,
  completedThisWeek = 0,
  completedDays = [],
  completedToday = false,
  trainedDates = [],
  doneByDate = {},
  nutrition = true,
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
      setPreview((current) => ({ ...current, open: false }));
      toast.success("Sesión descartada");
    } catch {
      toast.error("No se pudo descartar la sesión. Comprueba la conexión.");
    }
  };

  const [completedMeals, setCompletedMeals] = useState<Set<string>>(new Set());
  const readMealsDone = useCallback(() => {
    setCompletedMeals(new Set(readMealsDoneFor(userId)));
  }, [userId]);
  useEffect(() => {
    readMealsDone();
    // MealsList avisa al marcar/desmarcar una comida: Hoy debe reflejarlo.
    window.addEventListener("autopilot:meals-updated", readMealsDone);
    return () => window.removeEventListener("autopilot:meals-updated", readMealsDone);
  }, [readMealsDone]);

  // La semana (lunes a domingo) y el día elegido en la tira: hoy al entrar. Cambiar de día solo
  // cambia la tarjeta con lo que ya hay en el plan: nunca vuelve a pedir nada a la red.
  const now = new Date();
  const week = weekDays(now);
  const todayIndex = week.findIndex((day) => day.isToday);
  const [selectedKey, setSelectedKey] = useState(() => localDate(now));
  const selected = week.find((day) => day.key === selectedKey) ?? week[todayIndex];
  const previousIndex = useRef(selected.index);
  const [slideFrom, setSlideFrom] = useState<"left" | "right" | null>(null);
  const [announce, setAnnounce] = useState("");
  const trained = new Set(trainedDates);

  // La sesión de hoy es la siguiente de la rutina que falta esta semana, sea el día que sea
  // (nunca «descanso» solo por el día de la semana). Los demás días, la sesión del plan para ese día.
  const sessions = routineSessions(dayPlans);
  const todayPlan = nextPendingSession(sessions, completedDays);
  const weekComplete = sessions.length > 0 && !todayPlan;
  const nextLine = todayPlan
    ? `Siguiente: ${planTitle(todayPlan).split(" · ")[0]}.`
    : weekComplete
      ? sessions.length === 1 ? "Has hecho tu sesión de esta semana." : `Has hecho tus ${sessions.length} sesiones de esta semana.`
      : "";
  const doneDateOf = (day: string) => Object.keys(doneByDate).find((date) => doneByDate[date]?.includes(day));

  const cardFor = (day: WeekDay): DayCard => {
    if (!hasPlan) return { kind: "starter" };
    if (sessions.length === 0) return { kind: "empty" };
    const doneThere = sessions.find((session) => doneByDate[day.key]?.includes(session.day));
    if (day.isToday) {
      if (activeWorkout && activeWorkoutIsToday) {
        const sets = Object.values(activeWorkout.logs).flat().filter((set) => !set.isWarmup);
        return { kind: "session", plan: activeWorkout.plan, status: "resume", detail: `${sets.filter((set) => set.done).length} de ${plural(sets.length, "serie", "series")}` };
      }
      if (completedToday) {
        return doneThere
          ? { kind: "session", plan: doneThere, status: "done", doneOn: day.key, detail: nextLine || undefined }
          : { kind: "trained", line: nextLine || "Buen trabajo. Hoy toca recuperar." };
      }
      if (todayPlan) return { kind: "session", plan: todayPlan, status: "start" };
      return { kind: "rest", title: "Semana completa", line: `${nextLine} El lunes empieza otra vuelta.` };
    }
    if (doneThere) return { kind: "session", plan: doneThere, status: "done", doneOn: day.key };
    if (trained.has(day.key)) return { kind: "trained", line: "Ya cuenta en tu semana." };
    const planned = sessions.find((session) => session.day === day.planKey);
    if (planned) {
      return completedDays.includes(planned.day)
        ? { kind: "session", plan: planned, status: "done", doneOn: doneDateOf(planned.day) }
        : { kind: "session", plan: planned, status: "start" };
    }
    return { kind: "rest", title: "Descanso", line: "Recuperar también forma parte del plan." };
  };
  const card = cardFor(selected);
  const cardPlan = card.kind === "session" ? card.plan : null;

  // Foto de la sesión: su portada (propia o de IA), la del primer ejercicio en movimiento y,
  // si aún no hay ninguna, la de marca (siempre hay una foto real en una sesión de gimnasio).
  const exerciseMetadata = useExerciseMetadata(dayPlans);
  const metaOf = (exercise: { exercise_id: string; name: string }) => exerciseMetadata.byId[exercise.exercise_id] || exerciseMetadata.byName[exercise.name];
  const isGymCard = cardPlan?.type === "gimnasio";
  const coverExercises = isGymCard ? cardPlan.exercises ?? [] : [];
  const firstExercise = coverExercises[0];
  // Siempre a tamaño de portada (1000 px), la misma que abre el entreno: la del plan puede ser la original de ~2 MB.
  const firstExerciseImage = firstExercise
    ? fastImage(metaOf(firstExercise)?.image_url || firstExercise.image_url || null, HERO_SIDE) ?? null
    : null;
  const aiCover = useSessionCover(coverExercises.map((exercise) => exercise.exercise_id), firstExerciseImage);
  const ownCover = cardPlan?.cover_url ? fastImage(cardPlan.cover_url, HERO_SIDE) ?? null : null;
  const cardPhoto = isGymCard ? ownCover || aiCover || BRAND_PHOTOS.gym : null;
  // Sin portada propia, la sesión se mueve con el clip de su primer ejercicio (como `routineThumb`).
  const cardVideo = isGymCard && !ownCover && firstExercise && cardPhoto === firstExerciseImage
    ? metaOf(firstExercise)?.video_url || firstExercise.video_url || null
    : null;

  // Hoy: cuenta hasta la primera foto (solo en modo de medida) y precarga la sesión de hoy por
  // detrás: sus miniaturas, la foto grande del primer ejercicio (la que abre el entreno) y su clip.
  // Igual que `prefetchToday` en la app (`MediaPrefetch.today`).
  useEffect(() => { beginFirstImage("hoy"); }, []);
  const todayExercises = todayPlan?.type === "gimnasio" ? todayPlan.exercises ?? [] : [];
  const todayMediaKey = JSON.stringify(todayExercises.map((exercise) => {
    const metadata = metaOf(exercise);
    return [metadata?.image_url || exercise.image_url || null, metadata?.video_url || exercise.video_url || null];
  }));
  useEffect(() => {
    const items = (JSON.parse(todayMediaKey) as [string | null, string | null][]).map(([image, video]) => ({ image, video }));
    if (items.length > 0) prefetchMedia(todayMedia(items));
  }, [todayMediaKey]);

  // Saludo: la fecha, el nombre grande y una línea.
  const firstName = profileName?.trim().split(/\s+/)[0];
  const dateLabel = capitalized(new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(now));
  const headline = completedToday
    ? "Buen trabajo hoy."
    : weekComplete
      ? "Semana completa."
      : "La constancia crea el cambio.";

  // Cifras del día: objetivo de kcal y proteína (la barra = comidas marcadas hoy) y sesiones de la semana.
  const macroError = macros ? nutritionMacroError(macros) : null;
  const calorieTarget = macros && !macroError
    ? Number(macros.calories) || Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fats * 9)
    : null;
  const proteinTarget = macros && !macroError ? Math.round(macros.protein) : null;
  const doneMealCount = meals.filter((meal) => completedMeals.has(meal.name)).length;
  const mealsProgress = meals.length ? doneMealCount / meals.length : null;
  const mealsDetail = meals.length ? `${doneMealCount} de ${plural(meals.length, "comida hecha", "comidas hechas")} hoy` : null;
  const sessionCount = Math.min(completedThisWeek, sessions.length);

  // Hoja de la sesión: sus ejercicios y su acción (o lo registrado, si ya está hecha).
  const [preview, setPreview] = useState<{ open: boolean; plan: DayPlan | null; done: boolean; day: WeekDay }>(() => ({ open: false, plan: null, done: false, day: selected }));
  const previewPlan = preview.plan;
  const previewResumable = Boolean(activeWorkout && previewPlan && previewPlan.day === activeWorkout.plan.day && !preview.done);
  const previewExercises = previewPlan?.exercises ?? [];
  const previewSets = previewExercises.reduce((total, exercise) => total + (Number(exercise.series) || 0), 0);
  const previewSummary = previewPlan?.type === "gimnasio"
    ? [previewExercises.length && plural(previewExercises.length, "ejercicio", "ejercicios"), previewSets && plural(previewSets, "serie", "series")].filter(Boolean).join(" · ")
    : [previewPlan?.intensity, previewPlan?.duration].filter(Boolean).join(" · ");
  const previewTitle = preview.done
    ? `Completado ${dayPhrase(preview.day, todayIndex)}`
    : `${previewPlan?.type === "actividad" ? "Actividad" : "Sesión"} ${ofDay(preview.day, todayIndex)}`;
  const previewDescription = previewPlan
    ? `${planTitle(previewPlan)}${previewSummary ? ` · ${previewSummary}` : ""}`
    : "Tu sesión de hoy ya está registrada.";

  const openPreview = (plan: DayPlan | null, done = false) => {
    void hapticTap();
    setPreview({ open: true, plan, done, day: selected });
  };

  const startPreviewSession = () => {
    if (!previewPlan) return;
    void hapticTap();
    setPreview((current) => ({ ...current, open: false }));
    if (previewResumable && onResumeWorkout) onResumeWorkout();
    else onStartWorkout?.(previewPlan.day);
  };

  const completePreviewActivity = async () => {
    if (!previewPlan || !onCompleteActivity) return;
    if (!await onCompleteActivity(previewPlan.day)) return;
    setPreview((current) => ({ ...current, open: false }));
  };

  /** La acción dorada de la tarjeta: empezar (o continuar) a un toque; una actividad abre su hoja. */
  const runCardAction = () => {
    if (card.kind !== "session") return;
    void hapticTap();
    if (card.status === "resume" && onResumeWorkout) onResumeWorkout();
    else if (card.plan.type !== "gimnasio") openPreview(card.plan);
    else onStartWorkout?.(card.plan.day);
  };

  const openPlan = () => {
    void hapticTap();
    onOpenPlan?.();
  };

  const cardSummary = (value: DayCard) => {
    switch (value.kind) {
      case "starter": return "Prepara tu rutina inicial gratis";
      case "empty": return "Tu plan aún no tiene sesiones";
      case "rest": return value.title;
      case "trained": return "Sesión completada";
      case "session": return `${planTitle(value.plan).split(" · ")[0]}${value.status === "done" ? ", hecha" : ""}`;
    }
  };

  const selectDay = (day: WeekDay) => {
    if (day.key === selected.key) return;
    void hapticSelection();
    setSlideFrom(day.index > previousIndex.current ? "right" : "left");
    previousIndex.current = day.index;
    setSelectedKey(day.key);
    setAnnounce(`${dayTitle(day, todayIndex)}: ${cardSummary(cardFor(day))}`);
  };

  return (
    // La misma columna en el móvil y, más grande y centrada, en la web ancha (como el iPhone).
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 pb-4">
      {/* Saludo: la fecha, el nombre grande y una línea en gris */}
      <header>
        <h2 data-nav-title className="type-subhead font-medium text-muted-foreground">{dateLabel}</h2>
        <p className="mt-0.5 truncate type-large-title text-foreground">{firstName || "Hola"}</p>
        <p className="mt-1 type-subhead text-muted-foreground">{headline}</p>
      </header>

      {/* La semana en píldoras: cada día se toca y cambia la tarjeta; el elegido en dorado, hoy con
          un aro discreto y un punto en los días entrenados */}
      <ol aria-label="Esta semana" className="grid grid-cols-7 gap-1 sm:gap-2">
        {week.map((day) => {
          const done = trained.has(day.key);
          const isSelected = day.key === selected.key;
          return (
            <li key={day.key} className="min-w-0">
              <button
                type="button"
                onClick={() => selectDay(day)}
                aria-pressed={isSelected}
                aria-current={day.isToday ? "date" : undefined}
                aria-label={`${day.name} ${day.day}${day.isToday ? ", hoy" : ""}${done ? ", entrenaste" : ""}`}
                className={cn(
                  "flex h-16 w-full min-w-11 flex-col items-center justify-center gap-1 rounded-full transition-[transform,background-color] duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isSelected ? "btn-gold bg-primary text-primary-foreground" : "bg-card text-foreground",
                  !isSelected && day.isToday && "ring-[1.5px] ring-inset ring-foreground/30",
                )}
              >
                <span aria-hidden="true" className={cn("type-caption2 font-medium", isSelected ? "text-primary-foreground/75" : "text-muted-foreground")}>{day.letter}</span>
                <span aria-hidden="true" className="type-headline leading-none tabular-nums">{day.day}</span>
                <span aria-hidden="true" className={cn("h-1 w-1 rounded-full", done ? (isSelected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent")} />
              </button>
            </li>
          );
        })}
      </ol>

      {/* La tarjeta del día elegido: su sesión del plan, el descanso o lo hecho */}
      <section aria-labelledby="hoy-dia">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 id="hoy-dia" className="min-w-0 truncate type-title3">{dayTitle(selected, todayIndex)}</h3>
          {hasPlan && onOpenPlan && (
            <button type="button" onClick={openPlan} className="-my-3 -mr-1 flex min-h-11 shrink-0 items-center gap-0.5 px-1 type-subhead font-semibold text-foreground transition-opacity active:opacity-60">
              Ver plan
              <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="sr-only" aria-live="polite">{announce}</p>
        <div
          key={selected.key}
          className={cn(
            slideFrom && "animate-in fade-in-0 duration-300 ease-out motion-reduce:animate-none",
            slideFrom === "right" && "slide-in-from-right-3",
            slideFrom === "left" && "slide-in-from-left-3",
          )}
        >
          {card.kind === "starter" ? (
            // Sin rutina todavía (también si la inicial quedó pendiente): la invitación con su botón, nunca un aviso
            // de espera. Es la misma tarjeta que Entrenar y que `StarterRoutineCard` en la app.
            <div className="flex min-h-[196px] flex-col justify-center rounded-[28px] bg-card p-4 sm:min-h-[248px]">
              <EmptyState
                icon={Dumbbell}
                title="Prepara tu rutina inicial gratis"
                description="Te la preparamos en unos segundos."
                className="py-6"
              />
              <Button size="lg" className="w-full" disabled={preparingRoutine} onClick={onPrepareRoutine}>
                {preparingRoutine ? "Preparando…" : "Preparar mi rutina gratis"}
              </Button>
            </div>
          ) : card.kind === "session" ? (
            <SessionCard
              plan={card.plan}
              status={card.status}
              detail={card.detail}
              photo={cardPhoto}
              video={cardVideo}
              metaMuscle={(exercise) => metaOf(exercise)?.muscle_group}
              onOpen={() => openPreview(card.plan, card.status === "done")}
              onAction={runCardAction}
            />
          ) : (
            <CalmCard
              title={card.kind === "empty" ? "Tu plan aún no tiene sesiones" : card.kind === "trained" ? "Sesión completada" : card.title}
              line={card.kind === "empty" ? "Edita tu rutina para añadir tus sesiones." : card.line}
              done={card.kind === "trained"}
              action={card.kind === "empty" && onEditRoutine ? (
                <Button type="button" variant="secondary" size="lg" onClick={() => { void hapticTap(); onEditRoutine(); }}>
                  Editar plan
                </Button>
              ) : undefined}
            />
          )}
        </div>
        {activeWorkout && !activeWorkoutIsToday && (
          <div className="mt-3 flex items-center gap-2 px-1">
            <p className="min-w-0 flex-1 type-footnote text-muted-foreground">Tienes una sesión sin terminar del {activeWorkoutDate}.</p>
            <Button size="sm" variant="secondary" onClick={() => { void hapticTap(); onResumeWorkout?.(); }}>Reanudar</Button>
            <Button type="button" variant="plain" size="sm" onClick={() => { void hapticTap(); void discardActiveWorkout(); }}>
              Descartar
            </Button>
          </div>
        )}
      </section>

      {/* Tu día en tres cifras: objetivo de kcal y de proteína y las sesiones de la semana */}
      <section aria-label="Tu día" className="grid grid-cols-3 gap-3">
        <DayFigure
          label="Calorías"
          value={calorieTarget ? groupedInt(calorieTarget) : null}
          unit="kcal al día"
          progress={calorieTarget ? mealsProgress : null}
          detail={mealsDetail}
          onClick={() => onNavigate("nutrition")}
        />
        <DayFigure
          label="Proteína"
          value={proteinTarget ? groupedInt(proteinTarget) : null}
          unit="g al día"
          progress={proteinTarget ? mealsProgress : null}
          detail={mealsDetail}
          onClick={() => onNavigate("nutrition")}
        />
        <DayFigure
          label="Sesiones"
          value={sessions.length ? `${sessionCount}/${sessions.length}` : null}
          unit="esta semana"
          progress={sessions.length ? sessionCount / sessions.length : null}
          spoken={sessions.length ? `${sessionCount} de ${sessions.length} esta semana` : undefined}
          empty="Por planificar"
          onClick={() => onOpenPlan?.()}
        />
      </section>

      {discardDialog}
      <ResponsiveSheet
        open={preview.open}
        onOpenChange={(open) => setPreview((current) => ({ ...current, open }))}
        title={previewTitle}
        description={previewDescription}
        footer={
          preview.done ? (
            <Button size="lg" className="w-full" onClick={() => { void hapticTap(); setPreview((current) => ({ ...current, open: false })); onNavigate("progress"); }}>
              Ver mi progreso
            </Button>
          ) : previewPlan ? (
            previewPlan.type === "actividad" ? (
              <Button size="lg" className="w-full" onClick={() => void completePreviewActivity()}>
                Marcar actividad como hecha
              </Button>
            ) : (
              <div className="flex flex-col gap-1">
                <Button size="lg" className="w-full" onClick={startPreviewSession}>
                  <Play className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} aria-hidden="true" />
                  {previewResumable ? "Continuar entreno" : "Empezar entrenamiento"}
                </Button>
                {previewResumable && (
                  <Button type="button" variant="plain" size="sm" className="w-full" onClick={() => { void hapticTap(); void discardActiveWorkout(); }}>
                    Descartar sesión
                  </Button>
                )}
              </div>
            )
          ) : null
        }
      >
        {preview.done ? null : previewPlan?.type === "gimnasio" ? (
          previewExercises.length ? (
            <ListGroup aria-label="Ejercicios de la sesión">
              {previewExercises.map((exercise, index) => {
                const metadata = metaOf(exercise);
                const image = metadata?.image_url || exercise.image_url;
                const video = metadata?.video_url || exercise.video_url;
                const info = [exercise.rest, exercise.muscle_group || metadata?.muscle_group].filter(Boolean).join(" · ");
                return (
                  <ListRow
                    key={`${previewPlan.day}-${exercise.exercise_id || exercise.name}-${index}`}
                    leading={<ExerciseThumb image={image} video={video} name={exercise.name} pattern={metadata?.movement_pattern} muscleGroup={exercise.muscle_group || metadata?.muscle_group} size="md" />}
                    title={exercise.name}
                    subtitle={info || undefined}
                    value={`${exercise.series} × ${exercise.reps}`}
                  />
                );
              })}
            </ListGroup>
          ) : (
            <p className="py-4 type-subhead text-muted-foreground">Añade ejercicios a esta sesión desde Entrenar.</p>
          )
        ) : previewPlan ? (
          <ListGroup aria-label="Detalle de la actividad">
            <ListRow icon={<Flame />} title="Intensidad" value={previewPlan.intensity || "Libre"} />
            <ListRow icon={<Clock />} title="Duración" value={previewPlan.duration || "Libre"} />
          </ListGroup>
        ) : null}
      </ResponsiveSheet>
    </div>
  );
};

/**
 * La sesión del día (como `sessionCard` en la app): «Entrenamiento», el nombre grande, sus músculos y
 * «45 min · 6 ejercicios», con la foto (o el ejercicio en movimiento) fundida a la derecha. La tarjeta
 * abre la hoja con los ejercicios; la píldora dorada empieza a un toque. Hecha, la marca «Hecha».
 */
const SessionCard = ({ plan, status, detail, photo, video, metaMuscle, onOpen, onAction }: {
  plan: DayPlan;
  status: "start" | "resume" | "done";
  detail?: string;
  photo: string | null;
  video: string | null;
  metaMuscle: (exercise: { exercise_id: string; name: string }) => string | null | undefined;
  onOpen: () => void;
  onAction: () => void;
}) => {
  const gym = plan.type === "gimnasio";
  const title = planTitle(plan);
  const name = title.split(" · ")[0];
  const muscles = sessionMuscles(plan, metaMuscle);
  const count = plan.exercises?.length ?? 0;
  const minutes = gym ? estimateMinutes(plan) : null;
  const line = detail ?? (gym
    ? [minutes && `${minutes}\u00a0min`, count && plural(count, "ejercicio", "ejercicios")].filter(Boolean).join(" · ")
    : [plan.intensity, plan.duration].filter(Boolean).join(" · "));
  const actionLabel = status === "resume" ? "Continuar" : gym ? "Empezar" : "Ver actividad";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver la sesión ${title}${status === "done" ? ", hecha" : ""}`}
        className="relative flex min-h-[196px] w-full flex-col overflow-hidden rounded-[28px] bg-card p-5 pb-[84px] text-left transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[248px] sm:p-7 sm:pb-[92px]"
      >
        {photo && (
          // Fundida con una máscara (no con un degradado del color de la tarjeta): sin corte sobre la luz de la tarjeta.
          <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[56%] overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_60%)]">
            <img key={photo} src={photo} alt="" decoding="async" onLoad={noteImageShown} className="h-full w-full object-cover object-[50%_30%]" />
            <ExerciseLoop src={video} poster={photo} />
          </span>
        )}
        <span className={cn("relative flex min-w-0 flex-col", photo ? "pr-32 sm:pr-60" : "pr-2")}>
          <span className="flex items-center gap-1.5 type-footnote font-semibold text-muted-foreground">
            {gym
              ? <Dumbbell aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              : <Flame aria-hidden="true" className="h-4 w-4" strokeWidth={2} />}
            {gym ? "Entrenamiento" : "Actividad"}
          </span>
          <span className="mt-2 line-clamp-2 break-words type-title1 sm:type-large-title">{name}</span>
          {muscles && <span className="mt-1 line-clamp-2 type-subhead text-muted-foreground">{muscles}</span>}
          {line && <span className="mt-2 line-clamp-2 type-footnote tabular-nums text-muted-foreground">{line}</span>}
        </span>
      </button>
      {status === "done" ? (
        // Hecha: una marca tranquila en el sitio del botón (la tarjeta sigue abriendo lo registrado).
        <span aria-hidden="true" className="pointer-events-none absolute bottom-5 left-5 flex h-11 items-center gap-1.5 rounded-full bg-secondary px-4 type-subhead font-semibold sm:bottom-7 sm:left-7">
          <Check className="h-4 w-4 text-primary" strokeWidth={3} />
          Hecha
        </span>
      ) : (
        <button
          type="button"
          onClick={onAction}
          aria-label={`${status === "resume" ? "Continuar" : gym ? "Empezar" : "Ver la actividad"} ${name}`}
          className="btn-gold absolute bottom-5 left-5 flex h-11 items-center gap-2 rounded-full bg-primary px-5 type-headline text-primary-foreground transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:bottom-7 sm:left-7"
        >
          {gym && <Play aria-hidden="true" className="h-4 w-4" fill="currentColor" strokeWidth={0} />}
          {actionLabel}
        </button>
      )}
    </div>
  );
};

/**
 * Descanso, semana completa, plan sin sesiones o un entreno hecho fuera del plan (como `calmCard` en la
 * app): título, una línea y, detrás, la foto de marca muy tenue. Misma altura que la sesión: al cambiar de
 * día la pantalla no salta.
 */
const CalmCard = ({ title, line, done = false, action }: { title: string; line: string; done?: boolean; action?: ReactNode }) => (
  <div className="relative flex min-h-[196px] flex-col overflow-hidden rounded-[28px] bg-card p-5 sm:min-h-[248px] sm:p-7">
    <img src={BRAND_PHOTOS.gym} alt="" aria-hidden="true" decoding="async" className="absolute inset-y-0 right-0 h-full w-[56%] object-cover object-[50%_35%] opacity-50 [mask-image:linear-gradient(to_right,transparent,#000_70%)]" />
    <div className="relative pr-32 sm:pr-60">
      <h4 className="type-title1 sm:type-large-title">{title}</h4>
      <p className="mt-1 type-subhead text-muted-foreground">{line}</p>
    </div>
    {(action || done) && (
      <div className="relative mt-auto pt-5">
        {done ? (
          <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-secondary px-4 type-subhead font-semibold">
            <Check className="h-4 w-4 text-primary" strokeWidth={3} aria-hidden="true" />
            Hecha
          </span>
        ) : action}
      </div>
    )}
  </div>
);

/**
 * Cifra del día (como `dayFigure` en la app): su nombre, la cifra en Big Shoulders, la unidad en gris y
 * una barra fina (comidas marcadas hoy o sesiones de la semana). Sin cifra, «Por calcular».
 */
const DayFigure = ({ label, value, unit, progress, detail, spoken, empty = "Por calcular", onClick }: {
  label: string;
  value: string | null;
  unit: string;
  progress: number | null;
  detail?: string | null;
  /** Lectura de VoiceOver de la cifra («1 de 3 esta semana»); por defecto, la cifra y su unidad. */
  spoken?: string;
  empty?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={() => { void hapticTap(); onClick(); }}
    className="flex min-h-[132px] min-w-0 flex-col items-start rounded-card bg-card p-3.5 text-left transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[152px] sm:p-5"
    aria-label={value ? `${label}: ${spoken ?? `${value} ${unit}`}${detail ? `, ${detail}` : ""}` : `${label}: ${empty.toLocaleLowerCase("es")}`}
  >
    <span aria-hidden="true" className="max-w-full truncate type-footnote font-semibold text-muted-foreground">{label}</span>
    <span aria-hidden="true" className="mt-2 flex h-9 max-w-full items-end sm:h-11">
      {value
        // Nunca «2.3…»: la cifra va entera y, si es larga, baja un poco en pantallas estrechas
        // (como `minimumScaleFactor` en la app).
        ? <span className={cn("whitespace-nowrap type-figure text-foreground sm:text-[44px]", value.length >= 5 ? "text-[clamp(24px,8.6vw,34px)]" : "text-[34px]")}>{value}</span>
        : <span className="type-subhead font-semibold text-muted-foreground">{empty}</span>}
    </span>
    {/* La unidad baja de línea con la letra grande (nunca «kcal al…»). */}
    {value && <span aria-hidden="true" className="mt-1 line-clamp-2 max-w-full break-words type-footnote text-muted-foreground">{unit}</span>}
    {progress != null && (
      <span aria-hidden="true" className="mt-auto block h-1 w-full overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
      </span>
    )}
  </button>
);

export default HomeOverview;
