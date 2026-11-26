import RecordCelebration, { type RecordMoment } from "@/app/components/dashboard/RecordCelebration";
import { useSessionCover } from "@/shared/hooks/useSessionCover";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, ChevronLeft, CloudOff, Flame, Clock, CalendarDays,
  TrendingDown, Plus, X, Info, Play, Pause, MoreHorizontal, ChevronDown,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Progress } from "@/shared/components/ui/progress";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import NavBar from "@/shared/components/native/NavBar";
import { toast } from "sonner";
import type { DayPlan, ExerciseTrackingMode, GymExerciseEntry } from "@/shared/types/training";
import ExercisePicker from "@/app/components/dashboard/ExercisePicker";
import RPEDialog from "@/app/components/dashboard/RPEDialog";
import { ExerciseThumb } from "@/app/components/ExerciseMedia";
import ExerciseLoop, { prefetchMedia, preloadExerciseLoop, useLoopsAllowed } from "@/app/components/ExerciseLoop";
import { fastImage, HERO_SIDE } from "@/shared/lib/fastImage";
import { workoutMedia } from "@/shared/lib/mediaPrefetch";
import { beginFirstImage, noteImageShown } from "@/shared/lib/mediaTiming";
import { loopUrl, nextLoopIndex } from "@/shared/lib/exerciseLoop";
import ExerciseFocus from "@/app/components/ExerciseFocus";
import { MuscleMap } from "@/app/components/MuscleMap";
import { inferMotionPattern } from "@/shared/lib/exerciseMotion";
import { useExerciseMetadata } from "@/shared/hooks/useExerciseMetadata";
import { getWorkoutAdvanced, getWorkoutLayout, getWorkoutRestPreference, getWorkoutView, setWorkoutAdvanced, setWorkoutView, WORKOUT_VIEW_EVENT, type WorkoutLayout } from "@/shared/lib/workoutPreferences";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { readActiveWorkout, saveActiveWorkout, clearActiveWorkout, clearPendingOfflineSeries, remainingRestSeconds, playRestBeep, formatElapsed } from "@/shared/lib/activeWorkout";
import { getProgressionSuggestion } from "@/shared/lib/workoutProgression";
import { parsePositiveWeight } from "@/shared/lib/weight";
import { WorkoutSummary } from "@/app/components/dashboard/WorkoutSummary";
import { ExerciseSwap } from "@/app/components/dashboard/ExerciseSwap";
import { formatTrainingTitle } from "@/shared/lib/trainingDisplay";
import { routineSessions } from "@/shared/lib/routineOrder";
import { hapticImpact, hapticNotify, hapticSelection, hapticSignature, hapticTap } from "@/shared/lib/native";
import SwipeSetEntry from "@/app/components/dashboard/SwipeSetEntry";
import LogAllSetsButton from "@/app/components/dashboard/LogAllSetsButton";
import NumericWeightPicker from "@/app/components/dashboard/NumericWeightPicker";
import {
  addWorkoutSetDrop,
  createWorkoutSetLogs,
  resolveConfirmWeight,
  formatWorkoutSetSummary,
  getWorkoutSetDropInputError,
  getWorkoutSetDrops,
  getWorkoutSetDropsInputError,
  getWorkoutSetInputError,
  isWorkoutSetWarmup,
  removeWorkoutSetDrop,
  setWorkoutSetWarmup,
  updateWorkoutSetDrop,
  type WorkoutSetDrop,
  type WorkoutSetLog,
} from "@/shared/lib/workoutSet";
import { getExerciseTrackingConfig } from "@/shared/lib/exerciseTrackingConfig";
import {
  getNextSupersetWork,
  getSupersetChain,
  toggleSupersetLink,
  type SupersetLinks,
} from "@/shared/lib/workoutSuperset";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/components/ui/drawer";
import { addExerciseLoad } from "@/shared/lib/muscleMapping";
import { FreeWorkoutPicker } from "@/app/components/dashboard/FreeWorkoutPicker";
import { celebratePersonalRecord } from "@/shared/lib/confetti";
import SaveRoutineSheet, { type SaveRoutineResult } from "@/app/components/dashboard/SaveRoutineSheet";
import { routineFromWorkout } from "@/shared/lib/customRoutines";
import { suggestSessionName } from "@/shared/lib/sessionIdentity";

interface Props {
  userId: string;
  dayPlans: DayPlan[];
  initialDay?: string;
  autoStart?: boolean;
  resume?: boolean;
  onAutoStartConsumed?: () => void;
  onExit?: () => void;
  onCancel?: () => void;
  onSessionModeChange?: (active: boolean) => void;
  /** Entreno vacío: al terminar, «Guardar como rutina» guarda lo hecho en «Mis rutinas». */
  onSaveAsRoutine?: (name: string, exercises: GymExerciseEntry[]) => Promise<SaveRoutineResult>;
  /** Ya hay siete sesiones en el plan: «Guardar como rutina» lo explica. */
  routineLimitReached?: boolean;
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Solo los días con sesión existen: un día sin plan nunca es navegable. */
const hasSessionIn = (plans: DayPlan[], day?: string | null) =>
  Boolean(day) && plans.some((p) => p.day === day && (p.type === "gimnasio" || p.type === "actividad"));

/** Primera sesión de la rutina: sin días de la semana, el orden es el de la rutina. */
const firstSessionIn = (plans: DayPlan[]): string | null => routineSessions(plans)[0]?.day ?? null;

// Un solo dorado: la intensidad del músculo es más o menos dorado, nunca naranja ni rojo.
const MUSCLE_INTENSITY = {
  low: { label: "Bajo", range: "1–2 series", fill: "hsl(var(--primary) / 0.4)" },
  medium: { label: "Medio", range: "3–5 series", fill: "hsl(var(--primary) / 0.7)" },
  high: { label: "Alto", range: "6+ series", fill: "hsl(var(--primary))" },
};

/** «1 serie» / «3 series»: el plural va con la cifra. */
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-ES")} ${n === 1 ? one : many}`;
/** Pesos en español: «62,5» (no «62.5»). */
const decimalComma = (text: string) => text.replace(/(\d)\.(\d)/g, "$1,$2");

// Tabla de series como Hevy, igual en la app: Serie · Anterior · kg · Reps · ✓, con la misma
// rejilla para la cabecera, las series y sus bajadas. Celdas de 44 pt (redondeo de celda, 14).
const SET_GRID = "grid grid-cols-[32px_64px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2";
const NUMBER_FIELD = "scroll-mb-48 h-11 w-full min-w-0 rounded-chip border-0 bg-secondary px-1 text-center type-headline tabular-nums outline-none transition-colors duration-150 placeholder:font-normal placeholder:text-muted-foreground/60 focus:bg-accent focus:ring-1 focus:ring-inset focus:ring-primary/40 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-inset aria-[invalid=true]:ring-destructive";
// Serie hecha: la fila entera se tiñe de dorado y las cifras quedan sobre el tinte, sin caja.
const DONE_FIELD = "bg-transparent";
/** «62,5 × 10» con espacios finos que no se parten. */
const TIMES = "\u202F×\u202F";

/** Columnas cortas de la tabla («kg», «Reps»), como `SetTableHeader` en la app. */
const setColumns = (config: { weightLabel: string; valueLabel: string; fixedBodyweight?: boolean }) => ({
  load: config.fixedBodyweight ? "PC"
    : /lastre/i.test(config.weightLabel) ? "Lastre"
      : /asist/i.test(config.weightLabel) ? "Asist."
        : /km/i.test(config.weightLabel) ? "km" : "kg",
  value: /seg/i.test(config.valueLabel) ? "Seg" : /min/i.test(config.valueLabel) ? "Min" : "Reps",
});

/** Descanso en «1:05». */
const restClock = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

const getMuscleIntensity = (sets: number) => sets >= 6
  ? MUSCLE_INTENSITY.high
  : sets >= 3
    ? MUSCLE_INTENSITY.medium
    : MUSCLE_INTENSITY.low;

function focusSetField(e: { currentTarget: HTMLInputElement }) {
  const el = e.currentTarget;
  el.select();
  // El teclado del móvil tarda en abrir: centra la serie para que no la tape.
  window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
}

const WorkoutTracker = ({ userId, dayPlans, initialDay, autoStart = false, resume = false, onAutoStartConsumed, onExit, onCancel, onSessionModeChange, onSaveAsRoutine, routineLimitReached = false }: Props) => {
  const [resumeDraft] = useState(() => resume ? readActiveWorkout(userId) : null);
  const [workoutView, setWorkoutViewState] = useState(() => getWorkoutView(userId));
  const [workoutLayout, setWorkoutLayoutState] = useState<WorkoutLayout>(() => getWorkoutLayout(userId));
  const [advanced, setAdvancedState] = useState(() => getWorkoutAdvanced(userId));
  // En la lista todos los ejercicios nacen abiertos; se guardan solo los que el usuario pliega.
  const [closedExercises, setClosedExercises] = useState<number[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const refresh = () => {
      setWorkoutViewState(getWorkoutView(userId));
      setWorkoutLayoutState(getWorkoutLayout(userId));
      setAdvancedState(getWorkoutAdvanced(userId));
    };
    window.addEventListener(WORKOUT_VIEW_EVENT, refresh);
    return () => window.removeEventListener(WORKOUT_VIEW_EVENT, refresh);
  }, [userId]);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const today = DAYS_ORDER[todayIndex];
  // La sesión abierta siempre existe: el borrador activo, la pedida (la siguiente pendiente
  // desde «Hoy») o la primera de la rutina. Nunca un día sin sesión.
  const [selectedDay, setSelectedDay] = useState<string>(() =>
    resumeDraft?.plan.day
    ?? (hasSessionIn(dayPlans, initialDay) ? initialDay! : firstSessionIn(dayPlans) ?? today));
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, WorkoutSetLog[]>>({});
  const [previousLogs, setPreviousLogs] = useState<Record<string, WorkoutSetLog[]>>({});
  const [previousSessionRpe, setPreviousSessionRpe] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [restTimer, setRestTimerState] = useState<number | null>(null);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
  // Pausa: marca absoluta; al reanudar, inicio y descanso se desplazan lo que duró.
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [completionReady, setCompletionReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  const setRestTimer = (seconds: number | null) => {
    setRestEndsAt(seconds === null ? null : Date.now() + seconds * 1000);
    setRestTimerState(seconds);
  };
  const pauseWorkout = useCallback(() => {
    if (!started || pausedAt !== null || workoutCompleted) return;
    setPausedAt(Date.now());
  }, [pausedAt, started, workoutCompleted]);
  const resumeWorkout = useCallback(() => {
    if (!started || pausedAt === null || sessionStartedAt === null) return;
    // Lo que duró la pausa desplaza el inicio y el fin del descanso: ni el reloj ni el descanso cuentan el tiempo parado.
    const shift = Date.now() - pausedAt;
    setSessionStartedAt((start) => start === null ? start : start + shift);
    setRestEndsAt((end) => end === null ? end : end + shift);
    setPausedAt(null);
  }, [pausedAt, sessionStartedAt, started]);
  /** Duración de la sesión al cerrarla (para el resumen); sin dato si se reabre la pantalla después. */
  const [completedDurationMs, setCompletedDurationMs] = useState<number | null>(null);
  const [restTarget, setRestTarget] = useState(0);
  const [rpeOpen, setRpeOpen] = useState(false);
  const [technique, setTechnique] = useState<{
    name: string;
    image?: string | null;
    video?: string | null;
    series?: string;
    reps?: string;
    rest?: string;
    category?: string | null;
    type?: string | null;
    pattern?: string | null;
    stimulus?: string | null;
    load?: string | null;
  } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [logsReady, setLogsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadLogs, setReloadLogs] = useState(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveAttemptRef = useRef(0);
  const saveTimeoutRef = useRef<number | null>(null);
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [personalRecords, setPersonalRecords] = useState<string[]>([]);
  const [recordMoment, setRecordMoment] = useState<RecordMoment | null>(null);
  const closeRecordMoment = useCallback(() => setRecordMoment(null), []);
  const [livePRs, setLivePRs] = useState<Record<string, string>>({});
  // Superseries: solo en memoria durante la sesión (no se guardan ni se envían).
  const [supersetLinks, setSupersetLinks] = useState<SupersetLinks>({});
  const restChainRef = useRef<number[] | null>(null);

  // Modo libre: plan virtual sin day_label, el usuario añade sus ejercicios
  const FREE_DAY = "__libre__";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [freeExercises, setFreeExercises] = useState<Array<{
    name: string;
    exercise_id: string;
    muscle_group?: string | null;
    exercise_type?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    tracking_mode?: ExerciseTrackingMode | null;
    series: number;
    reps: number;
    rest: string;
    weight: string | null;
  }>>([]);
  const restWasRunningRef = useRef(false);
  const exerciseLogsRef = useRef(exerciseLogs);
  const exerciseMetadata = useExerciseMetadata(dayPlans);

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  // El día identifica la rutina; la fecha identifica cuándo se entrena de verdad.
  // Se mantiene estable durante la sesión, incluso si pasa la medianoche.
  const currentDate = formatLocalDate(new Date());
  const [selectedDate, setSelectedDate] = useState(resumeDraft?.date ?? currentDate);
  const basePlan = resumeDraft?.plan.day === selectedDay ? resumeDraft.plan : dayPlans.find((p) => p.day === selectedDay);
  // Ejercicios añadidos durante la sesión: viven solo en esta sesión, nunca en la rutina guardada.
  const [sessionExtras, setSessionExtras] = useState<GymExerciseEntry[]>([]);
  const [extraPickerOpen, setExtraPickerOpen] = useState(false);
  // «Cambiar ejercicio» desde el «···» del ejercicio: abre su hoja de alternativas.
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  // Números del carrusel: el ejercicio que ves siempre queda a la vista.
  const stepRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const currentPlan = basePlan && sessionExtras.length > 0
    ? { ...basePlan, exercises: [...(basePlan.exercises ?? []), ...sessionExtras] }
    : basePlan;
  // Ejercicio a ejercicio: el siguiente ya tiene su foto y el principio de su vídeo descargados,
  // así que pasar al siguiente es instantáneo (como `ExerciseLoopPool.preload` en la app).
  const loopsAllowed = useLoopsAllowed();
  const upcomingIndex = workoutView === "focus" && expandedExercise !== null
    ? nextLoopIndex(expandedExercise, currentPlan?.exercises?.length ?? 0)
    : null;
  const upcoming = upcomingIndex === null ? null : currentPlan?.exercises?.[upcomingIndex] ?? null;
  const upcomingMeta = upcoming ? exerciseMetadata.byId[upcoming.exercise_id] || exerciseMetadata.byName[upcoming.name] : undefined;
  const upcomingPhoto = fastImage(upcomingMeta?.image_url || upcoming?.image_url || null, HERO_SIDE) ?? null;
  const upcomingVideo = upcomingMeta?.video_url || upcoming?.video_url || null;
  useEffect(() => {
    if (upcomingPhoto) { const image = new Image(); image.decoding = "async"; image.src = upcomingPhoto; }
    preloadExerciseLoop(upcomingVideo);
  }, [upcomingPhoto, upcomingVideo]);
  // Portada de la sesión: generada con IA según sus músculos; mientras tanto, la foto del primer ejercicio.
  const coverExercises = currentPlan?.exercises || [];
  const firstExercise = coverExercises[0];
  const sessionCover = useSessionCover(
    coverExercises.map((e) => e.exercise_id),
    firstExercise ? fastImage((exerciseMetadata.byId[firstExercise.exercise_id] || exerciseMetadata.byName[firstExercise.name])?.image_url || firstExercise.image_url || null, HERO_SIDE) ?? null : null,
  );
  // En modo libre usamos un plan virtual con los ejercicios añadidos manualmente
  const freePlan = selectedDay === FREE_DAY && freeExercises.length > 0
    ? { day: FREE_DAY, type: "gimnasio" as const, exercises: freeExercises, routine_name: "Sesión libre", muscle_focus: null, sport: null, intensity: null, duration: null }
    : undefined;
  const activePlan = freePlan ?? currentPlan;
  // Entreno que empieza: todas sus fotos (miniatura y grande) y los dos primeros clips, por detrás
  // (primero con lo que guarda el plan y, en cuanto llega, con lo de la biblioteca). Como
  // `MediaPrefetch.workout` en la app. Y, en modo de medida, el tiempo hasta su primera foto.
  useEffect(() => { if (started) beginFirstImage("entreno"); }, [started]);
  const workoutMediaKey = started
    ? JSON.stringify((activePlan?.exercises ?? []).map((exercise) => {
      const meta = exerciseMetadata.byId[exercise.exercise_id] || exerciseMetadata.byName[exercise.name];
      return [meta?.image_url || exercise.image_url || null, meta?.video_url || exercise.video_url || null];
    }))
    : "";
  useEffect(() => {
    if (!workoutMediaKey) return;
    const items = (JSON.parse(workoutMediaKey) as [string | null, string | null][]).map(([image, video]) => ({ image, video }));
    if (items.length > 0) prefetchMedia(workoutMedia(items));
  }, [workoutMediaKey]);
  const trainingTitle = formatTrainingTitle(activePlan?.routine_name, activePlan?.muscle_focus);
  // La firma ignora los extras: añadir un ejercicio no debe recargar ni borrar las series ya hechas.
  const currentPlanSignature = JSON.stringify((freePlan ?? basePlan) || null);
  useEffect(() => { setSessionExtras([]); }, [selectedDay]);
  // El plan puede llegar o cambiar después de montar: el día abierto siempre tiene sesión.
  useEffect(() => {
    if (started || resumeDraft) return;
    if (hasSessionIn(dayPlans, selectedDay)) return;
    const next = (hasSessionIn(dayPlans, initialDay) ? initialDay! : firstSessionIn(dayPlans)) ?? today;
    if (next === selectedDay) return;
    setLogsReady(false);
    setCompletionReady(false);
    setSelectedDay(next);
  }, [dayPlans, initialDay, resumeDraft, selectedDay, started, today]);
  const addSessionExercises = (entries: GymExerciseEntry[]) => {
    const existing = new Set((activePlan?.exercises ?? []).map((e) => e.name));
    const fresh = entries.filter((e) => !existing.has(e.name));
    if (fresh.length === 0) return;
    setSessionExtras((prev) => [...prev, ...fresh]);
    setExerciseLogs((logs) => ({ ...createWorkoutSetLogs(fresh, previousLogs), ...logs }));
    void hapticTap();
  };
  const planExercises = activePlan?.exercises;
  const exerciseNames = useMemo(() => (planExercises ?? []).map((exercise) => exercise.name), [planExercises]);
  const startWorkout = (exerciseIndex = 0) => {
    if (!logsReady || loadError) return;
    const actualDate = formatLocalDate(new Date());
    if (actualDate !== selectedDate) {
      setLogsReady(false);
      setSelectedDate(actualDate);
      return;
    }
    setStarted(true);
    setExpandedExercise(exerciseIndex);
    setClosedExercises([]);
    onSessionModeChange?.(true);
  };

  useEffect(() => {
    if (!resumeDraft && !started && !workoutCompleted && selectedDate !== currentDate) {
      setLogsReady(false);
      setSelectedDate(currentDate);
    }
  }, [currentDate, selectedDate, started, workoutCompleted, resumeDraft]);

  // Start with a clean overview; the first exercise opens when the user starts.
  useEffect(() => {
    setStarted(false);
    setExpandedExercise(null);
    setClosedExercises([]);
    setRestTimer(null);
    setTechnique(null);
    setSwaps({});
    setLivePRs({});
    setPersonalRecords([]);
    setSaveError(false);
    // Las superseries son de la sesión: al cambiar de día no se arrastran.
    setSupersetLinks({});
    restChainRef.current = null;
  }, [selectedDay]);

  // Load existing logs + previous session
  useEffect(() => {
    let active = true;
    const restoreOfflineDraft = () => {
      if (!resumeDraft || resumeDraft.date !== selectedDate || resumeDraft.plan.day !== selectedDay) return false;
      setExerciseLogs(resumeDraft.logs);
      setSwaps(resumeDraft.swaps ?? {});
      setSupersetLinks(resumeDraft.supersetLinks ?? {});
      setStarted(true);
      setExpandedExercise(resumeDraft.expandedExercise ?? 0);
      setClosedExercises([]);
      setRestEndsAt(resumeDraft.restEndsAt);
      setPausedAt(resumeDraft.pausedAt ?? null);
      setRestTimerState(remainingRestSeconds(resumeDraft.restEndsAt, resumeDraft.pausedAt ?? undefined));
      setRestTarget(resumeDraft.restTarget);
      setLogsReady(true);
      setCompletionReady(true);
      setLoadError(false);
      onSessionModeChange?.(true);
      return true;
    };
    const loadLogs = async () => {
      setLogsReady(false);
      setCompletionReady(false);
      setLoadError(false);
      setWorkoutCompleted(false);
      setShowCompletionSummary(false);
      setSaveStatus("idle");
      setSavedAt(null);
      setExerciseLogs({});
      setPreviousLogs({});
      setPreviousSessionRpe(null);
      const [currentResult, completionResult, previousResult] = await Promise.all([
        supabase
          .from("workout_logs")
          .select("exercise_name, sets_completed")
          .eq("user_id", userId)
          .eq("day_label", selectedDay)
          .eq("logged_at", selectedDate),
        supabase
          .from("day_completions")
          .select("id, rpe")
          .eq("user_id", userId)
          .eq("day_label", selectedDay)
          .eq("completed_at", selectedDate)
          .maybeSingle(),
        supabase
          .from("workout_logs")
          .select("exercise_name, sets_completed, logged_at, rpe")
          .eq("user_id", userId)
          .eq("day_label", selectedDay)
          .lt("logged_at", selectedDate)
          .order("logged_at", { ascending: false })
          .limit(20),
      ]);

      if (!active) return;
      if (currentResult.error || completionResult.error || previousResult.error) {
        if (restoreOfflineDraft()) return;
        setLoadError(true);
        setCompletionReady(true);
        toast.error("No se pudo cargar tu sesión e historial. No se sobrescribirá ningún registro; comprueba la conexión e inténtalo de nuevo.");
        return;
      }
      setWorkoutCompleted(Boolean(completionResult.data));
      // La pantalla de victoria solo aparece al terminar, nunca al volver a la pestaña.
      setShowCompletionSummary(false);
      setSessionRpe(completionResult.data?.rpe ?? null);
      setCompletionReady(true);
      const data = currentResult.data;
      const prevData = previousResult.data;
      const prev: Record<string, WorkoutSetLog[]> = {};
      if (prevData && prevData.length > 0) {
        const lastDate = prevData[0].logged_at;
        prevData
          .filter((row) => row.logged_at === lastDate)
          .forEach((row) => {
            prev[row.exercise_name] = row.sets_completed as unknown as WorkoutSetLog[];
          });
      }
      if (data && data.length > 0) {
        const logs: Record<string, WorkoutSetLog[]> = {};
        data.forEach((row) => {
          logs[row.exercise_name] = row.sets_completed as unknown as WorkoutSetLog[];
        });
        const base = activePlan?.type === "gimnasio" && activePlan.exercises ? createWorkoutSetLogs(activePlan.exercises, prev) : {};
        Object.keys(logs).forEach((k) => { if (!Array.isArray(logs[k]) || logs[k].length === 0) delete logs[k]; });
        setExerciseLogs({ ...base, ...logs });
      } else if (activePlan?.type === "gimnasio" && activePlan.exercises) {
        setExerciseLogs(createWorkoutSetLogs(activePlan.exercises, prev));
      } else {
        setExerciseLogs({});
      }

      // Previous session logs (last workout on this day)
      if (prevData && prevData.length > 0) {
        const lastDate = prevData[0].logged_at;
        setPreviousLogs(prev);
        setPreviousSessionRpe(prevData.find((row) => row.logged_at === lastDate && row.rpe !== null)?.rpe ?? null);
      } else {
        setPreviousLogs({});
      }
      const draft = readActiveWorkout(userId);
      if (!completionResult.data && draft?.date === selectedDate && draft.plan.day === selectedDay) {
        setExerciseLogs(draft.logs);
        setSwaps(draft.swaps ?? {});
        setSupersetLinks(draft.supersetLinks ?? {});
        // Si hay borrador de hoy, la sesión está abierta: se restaura siempre
        // (también al recargar en la pestaña Entrenamiento, no solo desde Hoy).
        setStarted(true);
        setExpandedExercise(draft.expandedExercise ?? 0);
        setClosedExercises([]);
        setRestEndsAt(draft.restEndsAt);
        setPausedAt(draft.pausedAt ?? null);
        setRestTimerState(remainingRestSeconds(draft.restEndsAt, draft.pausedAt ?? undefined));
        setRestTarget(draft.restTarget);
        onSessionModeChange?.(true);
      } else if (completionResult.data && draft?.date === selectedDate && draft.plan.day === selectedDay) {
        clearActiveWorkout(userId);
      }
      setLoadError(false);
      setLogsReady(true);
    };
    void loadLogs().catch(() => {
      if (!active) return;
      if (restoreOfflineDraft()) return;
      setLoadError(true);
      setCompletionReady(true);
      toast.error("No se pudo cargar tu sesión e historial. No se sobrescribirá ningún registro; comprueba la conexión e inténtalo de nuevo.");
    });
    return () => {
      active = false;
    };
  }, [selectedDay, selectedDate, userId, currentPlanSignature, reloadLogs]);

  useEffect(() => {
    if (!autoStart) return;
    // Inicio abre la sesión pedida (la siguiente pendiente), aunque antes se consultara otra.
    // Sin sesión pedida no se auto-arranca ninguna.
    if (started) {
      onAutoStartConsumed?.();
      return;
    }
    if (!hasSessionIn(dayPlans, initialDay)) {
      onAutoStartConsumed?.();
      return;
    }
    if (selectedDay !== initialDay) {
      setLogsReady(false);
      setSelectedDay(initialDay!);
      return;
    }
    if (selectedDate !== currentDate) {
      setLogsReady(false);
      setSelectedDate(currentDate);
      return;
    }
    if (!logsReady) {
      if (loadError) onAutoStartConsumed?.();
      return;
    }
    if (currentPlan?.type === "gimnasio" && !workoutCompleted && !loadError) {
      setStarted(true);
      setExpandedExercise(0);
      setClosedExercises([]);
      onSessionModeChange?.(true);
    }
    onAutoStartConsumed?.();
  }, [autoStart, currentDate, currentPlan?.type, dayPlans, initialDay, loadError, logsReady, onAutoStartConsumed, onSessionModeChange, selectedDate, selectedDay, started, workoutCompleted]);

  // Absolute deadline: suspended timers cannot extend the athlete's rest.
  useEffect(() => {
    if (restEndsAt === null) return;
    // En pausa el descanso se congela: no corre ni suena.
    if (pausedAt !== null) { setRestTimerState(remainingRestSeconds(restEndsAt, pausedAt)); return; }
    const sync = () => {
      const remaining = remainingRestSeconds(restEndsAt);
      setRestTimerState(remaining);
      if (remaining === null) {
        setRestEndsAt(null);
        try { navigator.vibrate?.([200, 100, 200]); } catch { /* noop */ }
        playRestBeep();
        void hapticNotify("success");
      }
    };
    sync();
    const interval = window.setInterval(sync, 250);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [restEndsAt, pausedAt]);

  // Session clock: absolute start mark, restored from the draft so reloads don't reset it.
  useEffect(() => {
    if (!started || workoutCompleted) return;
    if (sessionStartedAt === null) {
      const draft = readActiveWorkout(userId);
      setSessionStartedAt(draft?.date === selectedDate && typeof draft.startedAt === "number" ? draft.startedAt : Date.now());
    }
  }, [started, workoutCompleted, sessionStartedAt, userId, selectedDate]);
  useEffect(() => {
    if (!started || workoutCompleted || sessionStartedAt === null) return;
    const sync = () => setSessionElapsedMs(pausedAt !== null ? pausedAt - sessionStartedAt : Math.max(0, Date.now() - sessionStartedAt));
    sync();
    const interval = window.setInterval(sync, 250);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [started, workoutCompleted, pausedAt, sessionStartedAt]);
  useEffect(() => { if (!started) { setSessionStartedAt(null); setPausedAt(null); setSessionElapsedMs(0); } }, [started]);
  useEffect(() => {
    if (!started || !logsReady || workoutCompleted || activePlan?.type !== "gimnasio") return;
    const saved = saveActiveWorkout({ version: 1, userId, date: selectedDate, plan: activePlan,
      logs: exerciseLogs, swaps, supersetLinks, expandedExercise, restEndsAt, restTarget, startedAt: sessionStartedAt ?? undefined, pausedAt });
    if (!saved) setSaveError(true);
  }, [started, logsReady, workoutCompleted, userId, selectedDate, currentPlanSignature, sessionExtras, exerciseLogs, swaps, supersetLinks, expandedExercise, restEndsAt, restTarget, sessionStartedAt, pausedAt]);

  useEffect(() => {
    if (started && expandedExercise !== null) {
      setClosedExercises((closed) => closed.filter((index) => index !== expandedExercise));
    }
  }, [started, expandedExercise]);

  // Copia siempre fresca de las series: el efecto de abajo la lee al acabar el
  // descanso sin depender de `exerciseLogs` en sus dependencias.
  useEffect(() => {
    exerciseLogsRef.current = exerciseLogs;
  }, [exerciseLogs]);

  // Superserie: al terminar (o cerrar) el descanso que cierra la ronda, se
  // vuelve a abrir el primer ejercicio de la cadena con series pendientes.
  useEffect(() => {
    if (restTimer !== null) {
      restWasRunningRef.current = true;
      return;
    }
    if (!restWasRunningRef.current) return;
    restWasRunningRef.current = false;
    const chain = restChainRef.current;
    restChainRef.current = null;
    if (!chain || !started || workoutCompleted) return;
    const pendingIndex = chain.find((index) =>
      (exerciseLogsRef.current[exerciseNames[index]] || []).some((set) => !set.done),
    );
    if (pendingIndex !== undefined) setExpandedExercise(pendingIndex);
  }, [restTimer, exerciseNames, started, workoutCompleted]);

  // Precarga a 0 ms: mientras se entrena el ejercicio actual, se cargan en
  // caché las fotos del anterior y del siguiente. Al cambiar de ejercicio la
  // imagen ya está en memoria y la transición es instantánea.
  useEffect(() => {
    if (!started || workoutCompleted || expandedExercise === null) return;
    const list = activePlan?.exercises || [];
    for (const idx of [expandedExercise - 1, expandedExercise + 1, expandedExercise + 2]) {
      const ex = list[idx];
      if (!ex) continue;
      const meta = exerciseMetadata.byId[ex.exercise_id] || exerciseMetadata.byName[ex.name];
      const url = fastImage(meta?.image_url || ex.image_url, HERO_SIDE);
      if (url) {
        const pre = new Image();
        pre.decoding = "async";
        pre.src = url;
      }
    }
  }, [started, workoutCompleted, expandedExercise, currentPlan, exerciseMetadata]);

  const adjustRest = (delta: number) => {
    const remaining = remainingRestSeconds(restEndsAt);
    if (remaining === null) return;
    const next = Math.max(5, remaining + delta);
    setRestTimer(next);
    if (next > restTarget) setRestTarget(next);
  };
  // «Saltar»: el descanso termina ya (en una superserie, se vuelve al primero con series pendientes).
  const skipRest = () => setRestTimer(null);

  // Pantalla siempre encendida durante la sesión
  useEffect(() => {
    if (!started || workoutCompleted) return;
    type WakeLock = { release: () => Promise<void> };
    let lock: WakeLock | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLock> } };
    const request = async () => {
      try { lock = (await nav.wakeLock?.request("screen")) ?? null; } catch { /* noop */ }
    };
    void request();
    const onVisible = () => { if (document.visibilityState === "visible") void request(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [started, workoutCompleted]);

  const updateSet = <Field extends keyof WorkoutSetLog>(
    exerciseName: string,
    setIndex: number,
    field: Field,
    value: WorkoutSetLog[Field],
  ) => {
    setExerciseLogs((prev) => {
      const sets = [...(prev[exerciseName] || [])];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      return { ...prev, [exerciseName]: sets };
    });
  };

  // Dropsets: las bajadas viven dentro de la misma serie y no tocan ni el
  // temporizador de descanso ni los contadores de series.
  const mutateSet = (exerciseName: string, setIndex: number, mutate: (set: WorkoutSetLog) => WorkoutSetLog) => {
    setExerciseLogs((prev) => {
      const sets = [...(prev[exerciseName] || [])];
      const set = sets[setIndex];
      if (!set) return prev;
      sets[setIndex] = mutate(set);
      return { ...prev, [exerciseName]: sets };
    });
  };

  const addDrop = (exerciseName: string, setIndex: number) => {
    mutateSet(exerciseName, setIndex, addWorkoutSetDrop);
    void hapticTap();
  };

  const updateDrop = (exerciseName: string, setIndex: number, dropIndex: number, patch: Partial<WorkoutSetDrop>) => {
    mutateSet(exerciseName, setIndex, (set) => updateWorkoutSetDrop(set, dropIndex, patch));
  };

  const removeDrop = (exerciseName: string, setIndex: number, dropIndex: number) => {
    mutateSet(exerciseName, setIndex, (set) => removeWorkoutSetDrop(set, dropIndex));
    void hapticTap();
  };

  // Calentamiento: la serie se sigue guardando y se puede marcar con ✓, pero
  // deja de contar en volumen, récords y series completadas.
  const toggleWarmup = (exerciseName: string, setIndex: number) => {
    mutateSet(exerciseName, setIndex, (set) => setWorkoutSetWarmup(set, !isWorkoutSetWarmup(set)));
    // El récord en directo de esa serie deja de ser válido al pasar a calentamiento.
    setLivePRs((prev) => {
      const key = `${exerciseName}#${setIndex}`;
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    void hapticTap();
  };

  const toggleSetDone = (exerciseName: string, setIndex: number, restSeconds?: number, suggestedWeight?: string) => {
    const rawSet = exerciseLogs[exerciseName]?.[setIndex];
    const wasDone = rawSet?.done;
    if (!rawSet) return;
    // Un toque: si el peso está vacío, se usa el que se ve sugerido en gris.
    const resolved = wasDone ? rawSet.weight : resolveConfirmWeight(rawSet.weight, suggestedWeight);
    const ghost = resolved !== rawSet.weight;
    const set = ghost ? { ...rawSet, weight: resolved } : rawSet;
    if (!wasDone) {
      const inputError = getWorkoutSetInputError(set) ?? getWorkoutSetDropsInputError(set);
      if (inputError) {
        void hapticNotify("error");
        toast.error(inputError);
        return;
      }
    }
    if (ghost) updateSet(exerciseName, setIndex, "weight", resolved);
    updateSet(exerciseName, setIndex, "done", !wasDone);
    if (!wasDone) void hapticSignature();

    const exerciseIndex = activePlan?.exercises?.findIndex((exercise) => exercise.name === exerciseName) ?? -1;
    const sets = exerciseLogs[exerciseName] || [];

    // Superserie: mientras el siguiente miembro de la cadena tenga series
    // pendientes no hay descanso y se abre ese ejercicio. Si a la cadena ya no
    // le quedan series pendientes, el descanso arranca como siempre.
    const hasPendingSets = (index: number) => (exerciseLogs[exerciseNames[index]] || [])
      .some((candidate, candidateIndex) => !candidate.done && !(index === exerciseIndex && candidateIndex === setIndex));
    const continuesSuperset = !wasDone && exerciseIndex >= 0
      ? getNextSupersetWork(exerciseNames, supersetLinks, exerciseIndex, hasPendingSets)
      : null;

    // Start rest timer when marking set as done
    if (!wasDone) {
      void hapticImpact("medium");
      if (continuesSuperset === null) {
        // Si el usuario eligió un descanso global, manda; si no, el prescrito
        // por el plan (antes el fallback estaba muerto y siempre eran 60 s).
        const configuredRest = getWorkoutRestPreference(userId);
        const effectiveRest = configuredRest ?? restSeconds ?? 60;
        setRestTarget(effectiveRest);
        setRestTimer(effectiveRest);
      }
      // Récord en directo: supera el mejor peso de la sesión anterior. Ni la
      // serie de calentamiento ni las de calentamiento previas cuentan.
      const isWarmup = isWorkoutSetWarmup(set);
      const w = parsePositiveWeight(set.weight);
      const prevBest = Math.max(0, ...(previousLogs[exerciseName] || [])
        .filter((s) => s.done && !isWorkoutSetWarmup(s))
        .map((s) => parsePositiveWeight(s.weight) || 0));
      if (!isWarmup && w && prevBest > 0 && w > prevBest) {
        const diff = Math.round((w - prevBest) * 10) / 10;
        setLivePRs((prev) => ({ ...prev, [`${exerciseName}#${setIndex}`]: `+${diff} kg` }));
        void hapticImpact("heavy");
        void hapticNotify("success");
        setRecordMoment({ exercise: exerciseName, diff: `+${diff.toLocaleString("es-ES")} kg`, key: Date.now() });
        void celebratePersonalRecord();
        try { navigator.vibrate?.([50, 100, 50, 100, 200]); } catch { /* noop */ }
      }
    } else {
      void hapticTap();
      setLivePRs((prev) => {
        const next = { ...prev };
        delete next[`${exerciseName}#${setIndex}`];
        return next;
      });
    }

    if (!wasDone && exerciseIndex >= 0) {
      if (continuesSuperset !== null) {
        setExpandedExercise(continuesSuperset);
        return;
      }

      // Descanso normal (con o sin superserie): al acabar la ronda se retoma la
      // cadena por el primer ejercicio con series pendientes.
      const chain = getSupersetChain(exerciseNames, supersetLinks, exerciseIndex);
      restChainRef.current = chain.length > 1 ? chain : null;
      const exerciseFinished = sets.length > 0 && sets.every((candidate, candidateIndex) =>
        candidateIndex === setIndex || candidate.done,
      );
      if (chain.length === 1 && exerciseFinished) {
        const nextIndex = (activePlan?.exercises || []).findIndex((candidate, candidateIndex) =>
          candidateIndex > exerciseIndex && (exerciseLogs[candidate.name] || []).some((candidateSet) => !candidateSet.done),
        );
        if (nextIndex >= 0) setExpandedExercise(nextIndex);
      }
    }
  };

  const parseRestSeconds = (rest: string): number => {
    const values = rest.match(/\d+/g)?.map(Number) || [];
    if (values.length === 0) return 60;
    const value = values.length > 1 ? values[values.length - 1] : values[0];
    return /min/i.test(rest) ? value * 60 : value;
  };

  const persistLogs = async (rpe?: number) => {
    const rows = Object.entries(exerciseLogs).map(([name, sets]) => ({
      user_id: userId,
      day_label: selectedDay,
      exercise_name: name,
      sets_completed: JSON.parse(JSON.stringify(sets)),
      logged_at: selectedDate,
      rpe: rpe ?? sessionRpe,
    }));

    const pendingKey = `autopilot:series-pendientes:${userId}`;
    const write = saveQueueRef.current.then(async () => {
      if (rows.length === 0) return;
      try {
        const { error } = await supabase.from("workout_logs").upsert(rows, {
          onConflict: "user_id,day_label,logged_at,exercise_name",
        });
        if (error) throw error;
        localStorage.removeItem(pendingKey);
      } catch (e) {
        // Sin cobertura: guardamos en el móvil y se envía al volver la señal.
        try { localStorage.setItem(pendingKey, JSON.stringify(rows)); } catch { /* lleno */ }
        throw e;
      }
    });
    saveQueueRef.current = write.catch(() => undefined);
    await write;
  };

  // Al recuperar la señal, envía las series que quedaron guardadas en el móvil.
  useEffect(() => {
    const pendingKey = `autopilot:series-pendientes:${userId}`;
    const flush = async () => {
      const raw = localStorage.getItem(pendingKey);
      if (!raw) return;
      try {
        const rows = JSON.parse(raw);
        const { error } = await supabase.from("workout_logs").upsert(rows, {
          onConflict: "user_id,day_label,logged_at,exercise_name",
        });
        if (!error) {
          localStorage.removeItem(pendingKey);
          setSaveError(false);
          setSaveStatus("saved");
          setSavedAt(new Date());
        }
      } catch { /* se reintenta en el próximo evento */ }
    };
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [userId]);

  const cancelPendingAutosave = () => {
    saveAttemptRef.current += 1;
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  };

  // Save each change so the session can be resumed after a connection drop or app close.
  useEffect(() => {
    const attempt = ++saveAttemptRef.current;
    if (!started || !logsReady || workoutCompleted || Object.keys(exerciseLogs).length === 0) return;
    setSaveStatus("pending");
    setSaveError(false);
    const timeout = window.setTimeout(async () => {
      saveTimeoutRef.current = null;
      setSaveStatus("saving");
      try {
        await persistLogs();
        if (attempt !== saveAttemptRef.current) return;
        setSavedAt(new Date());
        setSaveError(false);
        setSaveStatus("saved");
      } catch {
        if (attempt !== saveAttemptRef.current) return;
        setSaveError(true);
        setSaveStatus("error");
      }
    }, 800);
    saveTimeoutRef.current = timeout;
    return () => {
      window.clearTimeout(timeout);
      if (saveTimeoutRef.current === timeout) saveTimeoutRef.current = null;
    };
  }, [exerciseLogs, logsReady, selectedDay, selectedDate, started, workoutCompleted]);

  const detectAndSavePRs = async () => {
    // For each exercise with weight > 0, find best (weight, reps) and upsert.
    // Las series de calentamiento nunca se guardan como récord.
    const prsToInsert: Array<{
      user_id: string;
      exercise_name: string;
      weight: number;
      reps: number;
      estimated_1rm: number;
      achieved_at: string;
    }> = [];

    for (const [name, sets] of Object.entries(exerciseLogs)) {
      const completed = sets.flatMap((set) => {
        const weight = parsePositiveWeight(set.weight);
        return set.done && !isWorkoutSetWarmup(set) && weight !== null && Number.isFinite(set.reps) && set.reps > 0
          ? [{ ...set, parsedWeight: weight }]
          : [];
      });
      if (completed.length === 0) continue;

      // Best by estimated 1RM (Epley)
      let best = completed[0];
      let bestE1RM = best.parsedWeight * (1 + best.reps / 30);
      for (const s of completed) {
        const e1rm = s.parsedWeight * (1 + s.reps / 30);
        if (e1rm > bestE1RM) {
          best = s;
          bestE1RM = e1rm;
        }
      }

      // Check if it beats existing PR
      const { data: existing, error: lookupError } = await supabase
        .from("personal_records")
        .select("estimated_1rm")
        .eq("user_id", userId)
        .eq("exercise_name", name)
        .order("estimated_1rm", { ascending: false, nullsFirst: false })
        .limit(1);
      if (lookupError) throw lookupError;

      const currentBest = existing?.[0]?.estimated_1rm ?? 0;
      if (bestE1RM > Number(currentBest)) {
        prsToInsert.push({
          user_id: userId,
          exercise_name: name,
          weight: best.parsedWeight,
          reps: best.reps,
          estimated_1rm: Math.round(bestE1RM * 10) / 10,
          achieved_at: selectedDate,
        });
      }
    }

    if (prsToInsert.length > 0) {
      const { error } = await supabase.from("personal_records").upsert(prsToInsert, {
        onConflict: "user_id,exercise_name,weight,reps",
      });
      if (error) throw error;
      setPersonalRecords(prsToInsert.map((pr) => pr.exercise_name));
      toast.success(`Nuevo récord personal en ${prsToInsert.length} ejercicio${prsToInsert.length > 1 ? "s" : ""}`, { duration: 4000 });
    }
  };

  const finishWorkout = async () => {
    // Si faltan series, primero se pregunta: un toque no debe cerrar el día.
    if (completedSets < totalSets) {
      setFinishIncompleteOpen(true);
      return;
    }
    // Con todas hechas, el RPE (con opción de omitirlo) forma parte del cierre.
    setRpeOpen(true);
  };

  /** Cierra la sesión aunque falten series, tras la confirmación del usuario. */
  const finishWorkoutConfirmed = async () => {
    setFinishIncompleteOpen(false);
    setRpeOpen(true);
  };

  const saveAndExit = async () => {
    setSaving(true);
    setSaveStatus("saving");
    cancelPendingAutosave();
    try {
      await persistLogs();
      setSaveError(false);
      setSaveStatus("saved");
      setRestTimer(null);
      setStarted(false);
      setExpandedExercise(null);
      onSessionModeChange?.(false);
      toast.success("Entrenamiento guardado");
      onCancel?.();
    } catch {
      setSaveError(true);
      setSaveStatus("error");
      void hapticNotify("error");
      toast.error("No se pudo guardar el entrenamiento. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const [discardOpen, setDiscardOpen] = useState(false);
  // Confirmación cuando se termina sin completar todas las series (P0).
  const [finishIncompleteOpen, setFinishIncompleteOpen] = useState(false);
  // Última sesión completada: permite deshacer desde el toast o la ficha final.
  const lastCompletionRef = useRef<{ day: string; date: string } | null>(null);

  // Descartar: borra las series de hoy de este día y el borrador; no marca el día como hecho.
  const discardWorkout = async () => {
    setDiscardOpen(false);
    setSaving(true);
    cancelPendingAutosave();
    try {
      await saveQueueRef.current;
      const { error } = await supabase
        .from("workout_logs")
        .delete()
        .eq("user_id", userId)
        .eq("day_label", selectedDay)
        .eq("logged_at", selectedDate);
      if (error) throw error;
      clearPendingOfflineSeries(userId);
      clearActiveWorkout(userId);
      setExerciseLogs({});
      setRestTimer(null);
      setStarted(false);
      setExpandedExercise(null);
      setSaveStatus("idle");
      onSessionModeChange?.(false);
      void hapticNotify("warning");
      toast.success("Entrenamiento descartado");
      onCancel?.();
    } catch {
      void hapticNotify("error");
      toast.error("No se pudo descartar. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleRPEConfirm = async (rpe: number | null) => {
    setRpeOpen(false);
    setCompletedDurationMs(sessionStartedAt !== null ? Math.max(0, (pausedAt ?? Date.now()) - sessionStartedAt) : null);
    setSaving(true);
    setSaveStatus("saving");
    cancelPendingAutosave();
    setRestTimer(null);
    try {
      await persistLogs(rpe ?? undefined);
      setSaveError(false);
      setSaveStatus("saved");
    const { error: completionError } = await supabase.from("day_completions").upsert({
        user_id: userId,
        day_label: selectedDay,
        completed_at: selectedDate,
        rpe,
      });
      if (completionError) throw completionError;
      setSessionRpe(rpe);
      clearActiveWorkout(userId);
      setWorkoutCompleted(true);
      setStarted(false);
      setExpandedExercise(null);
      onSessionModeChange?.(false);
      setShowCompletionSummary(true);
      lastCompletionRef.current = { day: selectedDay, date: selectedDate };
      void hapticNotify("success");
      toast.success("Entrenamiento completado", {
        duration: 8000,
        action: { label: "Deshacer", onClick: () => { void undoCompletion(); } },
      });
      try {
        await detectAndSavePRs();
      } catch {
        toast.error("El entrenamiento se ha guardado, pero no se pudieron comprobar tus récords personales.");
      }
    } catch {
      setSaveError(true);
      setSaveStatus("error");
      void hapticNotify("error");
      toast.error("No se pudo guardar el entrenamiento. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  /** Deshace el "día completado" y reabre la sesión con las series ya registradas. */
  const undoCompletion = async () => {
    const completion = lastCompletionRef.current ?? { day: selectedDay, date: selectedDate };
    setSaving(true);
    try {
      const { error } = await supabase
        .from("day_completions")
        .delete()
        .eq("user_id", userId)
        .eq("day_label", completion.day)
        .eq("completed_at", completion.date);
      if (error) throw error;
      lastCompletionRef.current = null;
      setWorkoutCompleted(false);
      setShowCompletionSummary(false);
      if (activePlan?.type === "gimnasio") {
        setStarted(true);
        setExpandedExercise(0);
        setClosedExercises([]);
        saveActiveWorkout({
          version: 1,
          userId,
          date: selectedDate,
          plan: activePlan,
          logs: exerciseLogs,
          swaps,
          supersetLinks,
          expandedExercise: 0,
          restEndsAt: null,
          restTarget,
          startedAt: sessionStartedAt ?? Date.now(),
        });
        onSessionModeChange?.(true);
      }
      void hapticNotify("success");
      toast.success("Sesión de hoy reabierta");
    } catch {
      void hapticNotify("error");
      toast.error("No se pudo reabrir la sesión. Comprueba la conexión.");
    } finally {
      setSaving(false);
    }
  };

  /** Marca/desmarca un día de actividad como completado (running, cardio…). */
  const setActivityDone = async (done: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      if (done) {
        const { error } = await supabase.from("day_completions").upsert({
          user_id: userId,
          day_label: selectedDay,
          completed_at: selectedDate,
          rpe: null,
        });
        if (error) throw error;
        lastCompletionRef.current = { day: selectedDay, date: selectedDate };
        setWorkoutCompleted(true);
        void hapticNotify("success");
        toast.success("Actividad marcada como hecha", {
          duration: 8000,
          action: { label: "Deshacer", onClick: () => { void setActivityDone(false); } },
        });
      } else {
        const { error } = await supabase
          .from("day_completions")
          .delete()
          .eq("user_id", userId)
          .eq("day_label", selectedDay)
          .eq("completed_at", selectedDate);
        if (error) throw error;
        lastCompletionRef.current = null;
        setWorkoutCompleted(false);
        void hapticSelection();
        toast.success("Actividad desmarcada");
      }
    } catch {
      void hapticNotify("error");
      toast.error("No se pudo guardar la actividad. Comprueba la conexión.");
    } finally {
      setSaving(false);
    }
  };

  // Las series de calentamiento se guardan, pero no cuentan ni en el recuento
  // de series completadas ni en el volumen.
  const allLogEntries = Object.entries(exerciseLogs).flatMap(([name, sets]) =>
    sets.map((set) => ({ name, set })),
  );
  const workingLogEntries = allLogEntries.filter(({ set }) => !isWorkoutSetWarmup(set));
  const completedSets = workingLogEntries.filter(({ set }) => set.done).length;
  const totalSets = workingLogEntries.length;
  const totalVolume = workingLogEntries.reduce((total, { set }) => {
    if (!set.done) return total;
    const weight = parsePositiveWeight(set.weight);
    return total + (weight !== null ? weight * Math.max(0, set.reps) : 0);
  }, 0);
  const muscleSetCounts = (activePlan?.exercises || []).reduce<Record<string, number>>((counts, exercise) => {
    const completedSetsForExercise = (exerciseLogs[exercise.name] || [])
      .filter((set) => set.done && !isWorkoutSetWarmup(set)).length;
    if (completedSetsForExercise === 0) return counts;

    const metadata = exerciseMetadata.byId[exercise.exercise_id] || exerciseMetadata.byName[exercise.name];
    // Uses the swapped exercise name when the athlete replaced it, so synergists match what was really done.
    addExerciseLoad(counts, swaps[exercise.name] || exercise.name, exercise.muscle_group || metadata?.muscle_group, completedSetsForExercise);
    return counts;
  }, {});
  const previousVolume = Object.values(previousLogs).flat().reduce((total, set) => {
    const weight = set.done && !isWorkoutSetWarmup(set) ? parsePositiveWeight(set.weight) : null;
    return total + (weight !== null ? weight * Math.max(0, set.reps) : 0);
  }, 0);
  const musclesWorked = Object.keys(muscleSetCounts);
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  const completedExercises = activePlan?.exercises?.filter((exercise) => {
    const sets = exerciseLogs[exercise.name] || [];
    return sets.length > 0 && sets.every((set) => set.done);
  }).length || 0;
  const completedDateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
  // Entreno vacío terminado: lo hecho (ejercicios con series hechas) se puede guardar como rutina.
  const [routineSaved, setRoutineSaved] = useState(false);
  const performedRoutine = onSaveAsRoutine && workoutCompleted
    ? routineFromWorkout(activePlan?.exercises ?? [], exerciseLogs)
    : [];
  const saveAsRoutine = onSaveAsRoutine && performedRoutine.length > 0 ? (
    <SaveRoutineSheet
      exercises={performedRoutine}
      suggestedName={suggestSessionName({ day: "", type: "gimnasio", exercises: performedRoutine })}
      limitReached={routineLimitReached}
      saved={routineSaved}
      onSave={async (name, exercises) => {
        const result = await onSaveAsRoutine(name, exercises);
        if (result === "ok") setRoutineSaved(true);
        return result;
      }}
    />
  ) : undefined;
  const renderSummary = (inDialog: boolean) => (
    <WorkoutSummary
      sheet={inDialog}
      onDone={inDialog ? () => setShowCompletionSummary(false) : undefined}
      Title={inDialog ? DialogTitle : "h2"}
      Desc={inDialog ? DialogDescription : "p"}
      dateLabel={completedDateLabel}
      sessionTitle={trainingTitle || "Sesión de hoy"}
      totalVolume={totalVolume}
      previousVolume={previousVolume}
      completedSets={completedSets}
      durationMs={completedDurationMs}
      completedExercises={completedExercises}
      plannedExercises={currentPlan?.exercises?.length || 0}
      rpe={sessionRpe}
      records={personalRecords}
      muscles={musclesWorked}
      muscleSetCounts={muscleSetCounts}
      intensityFor={(muscle) => getMuscleIntensity(muscleSetCounts[muscle]).fill}
      current={Object.entries(exerciseLogs).map(([name, sets]) => ({ name, sets }))}
      previous={Object.entries(previousLogs).map(([name, sets]) => ({ name, sets }))}
      extraAction={saveAsRoutine}
    />
  );

  const focusMode = started && workoutView === "focus" && expandedExercise !== null;
  // Lista de toda la sesión: título grande en el contenido y el pequeño de la barra, oculto.
  const listMode = started && !focusMode;
  const exerciseListClass = started && !focusMode
    ? workoutLayout === "columns" ? "grid grid-cols-1 gap-3 md:grid-cols-2" : "flex flex-col gap-3"
    : focusMode ? "" : "overflow-hidden rounded-card bg-card";
  const paused = started && pausedAt !== null;
  const currentExerciseIndex = (activePlan?.exercises || []).findIndex((exercise) => {
    const sets = exerciseLogs[exercise.name] || [];
    return !(sets.length > 0 && sets.every((set) => set.done));
  });
  const sessionName = activePlan?.routine_name?.trim() || trainingTitle || "Entrenamiento";
  const exerciseCount = currentPlan?.exercises?.length ?? 0;
  // Avance en la barra de abajo, discreto: «3 de 12 series».
  const seriesProgress = `${completedSets.toLocaleString("es-ES")} de ${plural(totalSets, "serie", "series")}`;
  // Si el usuario eligió «Ejercicio a ejercicio», nunca caemos a la lista vertical en plena sesión.
  useEffect(() => {
    if (started && workoutView === "focus" && expandedExercise === null && planExercises?.length) setExpandedExercise(0);
  }, [started, workoutView, expandedExercise, planExercises?.length]);
  // El número del ejercicio que ves se desliza a la vista en el carrusel.
  useEffect(() => {
    if (!focusMode || expandedExercise === null) return;
    stepRefs.current[expandedExercise]?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [focusMode, expandedExercise, prefersReducedMotion]);
  // Las hojas que se abren desde un menú esperan a que el menú se cierre (foco y capas limpias).
  const afterMenu = (open: () => void) => { window.setTimeout(open, 0); };

  return (
    // En sesión ocupa la pantalla entera (el shell no pone barra ni pestañas): la barra
    // propia cubre la zona segura superior y el pie fijo, la del indicador de inicio.
    // Fuera de la sesión, la columna centrada de 680 de Hoy y Nutrición (web ancha = Mac).
    <div className={started ? "flex min-h-[calc(100dvh-0.5rem)] w-full min-w-0 flex-col" : "mx-auto w-full min-w-0 max-w-[680px]"}>
      <RecordCelebration moment={recordMoment} onDone={closeRecordMoment} />
      {!started && onCancel && (
        // Vista previa de una sesión abierta desde la rutina semanal: siempre hay vuelta.
        <button
          type="button"
          onClick={() => { void hapticTap(); onCancel(); }}
          className="mb-2 inline-flex min-h-11 items-center gap-0.5 pl-0.5 pr-2 text-foreground transition-opacity active:opacity-60 [touch-action:manipulation]"
        >
          <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
          <span className="type-body">Rutina semanal</span>
        </button>
      )}
      {started && !workoutCompleted && (
        // -mt-2 compensa el pt-2 del contenedor de sección: la barra nace pegada al borde superior.
        // Arriba solo «Salir», el nombre de la sesión y «···»: el avance vive, discreto, en la barra de abajo.
        <div className="sticky top-0 z-30 -mt-2">
          <NavBar
            title={sessionName}
            titleVisible={!listMode}
            titleAsHeading={!listMode}
            leading={
              <button
                type="button"
                onClick={() => { void hapticTap(); void saveAndExit(); }}
                disabled={saving}
                className="inline-flex h-11 items-center gap-0.5 pl-0.5 pr-2 text-foreground transition-opacity active:opacity-60 disabled:opacity-40 [touch-action:manipulation]"
              >
                <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
                <span className="type-body">Salir</span>
              </button>
            }
            trailing={
              <>
                {/* El guardado es automático y callado: solo se ve si falla. */}
                {saveStatus === "error" && (
                  <span role="status" className="flex h-11 w-11 items-center justify-center text-destructive">
                    <CloudOff className="h-5 w-5" aria-hidden="true" />
                    <span className="sr-only">Error al guardar</span>
                  </span>
                )}
                {/* Opciones de la sesión: añadir, cambiar de vista y de detalle; descartar, al final y en rojo. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Más acciones"
                      onClick={() => void hapticTap()}
                      disabled={saving}
                      className="inline-flex h-11 w-11 items-center justify-center transition-opacity active:opacity-60 disabled:opacity-40 [touch-action:manipulation]"
                    >
                      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-secondary text-foreground">
                        <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Todas las filas en la columna del check de «Más opciones por serie», como en iOS. */}
                    <DropdownMenuItem className="pl-10 md:pl-8" disabled={paused} onSelect={() => afterMenu(() => setExtraPickerOpen(true))}>
                      Añadir ejercicio
                    </DropdownMenuItem>
                    <DropdownMenuItem className="pl-10 md:pl-8" onSelect={() => setWorkoutView(userId, workoutView === "list" ? "focus" : "list")}>
                      {workoutView === "list" ? "Ver ejercicio a ejercicio" : "Ver toda la sesión"}
                    </DropdownMenuItem>
                    <DropdownMenuCheckboxItem checked={advanced} onCheckedChange={(on) => setWorkoutAdvanced(userId, on === true)}>
                      Más opciones por serie
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="pl-10 text-destructive focus:text-destructive md:pl-8" onSelect={() => setDiscardOpen(true)}>
                      Descartar entrenamiento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            }
          />
          <Progress
            value={progressPercent}
            aria-valuenow={Math.round(progressPercent)}
            aria-label="Progreso de la sesión"
            className="absolute inset-x-0 bottom-0 h-[2px] rounded-none bg-transparent [&>div]:bg-primary [&>div]:transition-[width] [&>div]:duration-500"
          />
        </div>
      )}
      {!started && (
        <div className="mb-2 flex items-center justify-end gap-1.5 type-footnote text-muted-foreground empty:hidden">
          {!workoutCompleted && saveStatus === "error" && <span role="status" className="text-destructive">Error al guardar</span>}
          {!workoutCompleted && (saveStatus === "pending" || saveStatus === "saving") && (
            <span role="status" aria-live="polite">
              {saveStatus === "pending" ? "Pendiente de guardar" : "Guardando…"}
            </span>
          )}
          {!workoutCompleted && saveStatus === "saved" && savedAt && (
            <span role="status" className="flex items-center gap-1"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Guardado</span>
          )}
        </div>
      )}

      {/* Selector de sesión: la rutina en orden, sin días de la semana. Se oculta durante la
          sesión para no cambiar de sesión con series a medias. */}
      {!started && routineSessions(dayPlans).length > 1 && (
        <div
          role="tablist"
          aria-label="Elige la sesión"
          className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-card bg-card p-1.5"
        >
          {routineSessions(dayPlans).map((session, index) => {
            const active = session.day === selectedDay;
            const name = (session.type === "gimnasio"
              ? formatTrainingTitle(session.routine_name, session.muscle_focus) || "Entrenamiento"
              : session.sport || "Actividad").split(" · ")[0];
            return (
              <button
                key={session.day}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Sesión ${index + 1}: ${name}`}
                disabled={saving}
                onClick={() => {
                  if (active) return;
                  void hapticSelection();
                  setLogsReady(false);
                  setCompletionReady(false);
                  setSelectedDay(session.day);
                }}
                className={`flex min-h-[52px] min-w-12 flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full px-2 transition-colors duration-150 disabled:opacity-40 ${
                  active ? "btn-gold bg-primary text-primary-foreground" : "text-muted-foreground active:bg-accent"
                }`}
              >
                <span className="type-subhead font-semibold tabular-nums">{index + 1}</span>
                <span className="max-w-full truncate type-caption1">{name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sin sesiones en el plan no hay nada que abrir: estado neutro, nunca una pantalla de descanso. */}
      {!currentPlan && !dayPlans.some((p) => p.type === "gimnasio" || p.type === "actividad") && (
        <EmptyState
          card
          className="mt-2"
          icon={CalendarDays}
          title="Tu plan aún no tiene sesiones"
          description="Edita tu rutina para añadir los días de la semana que quieras entrenar."
        />
      )}

      {/* Activity day */}
      {currentPlan?.type === "actividad" && (
        <section className={started ? "px-4" : ""}>
          <h2 className="px-4 pb-2 type-title2">{currentPlan.sport}</h2>
          <ListGroup>
            <ListRow icon={<Flame />} title="Intensidad" value={currentPlan.intensity} />
            <ListRow icon={<Clock />} title="Duración" value={currentPlan.duration} />
          </ListGroup>
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={saving || !completionReady || loadError}
            onClick={() => { void hapticTap(); void setActivityDone(!workoutCompleted); }}
          >
            {workoutCompleted ? "Actividad completada" : "Marcar actividad como hecha"}
          </Button>
          {workoutCompleted && (
            <Button variant="plain" size="sm" className="mt-1 w-full" onClick={() => { void hapticTap(); void setActivityDone(false); }} disabled={saving}>
              Desmarcar actividad
            </Button>
          )}
        </section>
      )}

      {/* Gym day */}
      {currentPlan?.type === "gimnasio" && (
        <div className={`flex flex-col gap-4 ${started ? "w-full flex-1 px-4 pt-3" : ""}`}>
          {/* Today's workout summary */}
          <section className={workoutCompleted || !completionReady || loadError || started ? "hidden" : "px-4 pt-2 md:px-0"}>
            {(() => {
              const [name, ...rest] = String(trainingTitle || selectedDay).split(" · ");
              return (
                <>
                  {sessionCover && <div aria-hidden="true" className="relative mb-4 h-48 overflow-hidden rounded-sheet bg-card">
                    <img key={sessionCover} src={sessionCover} alt="" decoding="async" onLoad={noteImageShown} className="absolute inset-0 h-full w-full object-cover object-[50%_30%] animate-in fade-in duration-500" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  </div>}
                  <h2 className="line-clamp-2 type-title1">{name}</h2>
                  {rest.length > 0 && <p className="mt-0.5 truncate type-subhead text-muted-foreground">{rest.join(" · ")}</p>}
                </>
              );
            })()}
            {!!currentPlan?.exercises?.length && (
              <p className="mt-1 type-footnote tabular-nums text-muted-foreground">
                {plural(currentPlan.exercises.length, "ejercicio", "ejercicios")} · {plural(totalSets, "serie", "series")}
              </p>
            )}

            {/* Antes de empezar, la única protagonista es la acción principal. */}
            <div className={completedSets > 0 ? "mt-4 flex items-center gap-3" : "sr-only"}>
              <Progress value={progressPercent} aria-valuenow={Math.round(progressPercent)} aria-label="Progreso de la sesión" className="flex-1" />
              <p role="status" className="shrink-0 type-footnote tabular-nums text-muted-foreground">
                {completedSets} de {plural(totalSets, "serie", "series")}
              </p>
            </div>

            {!started && (
              currentPlan?.exercises?.length ? (
                <Button
                  onClick={() => { void hapticTap(); startWorkout(0); }}
                  disabled={!logsReady || loadError}
                  size="lg"
                  className="mt-6 h-14 w-full gap-2 rounded-full type-headline active:scale-[0.98]"
                >
                  <Play className="h-5 w-5 fill-current" aria-hidden />
                  Empezar entrenamiento
                </Button>
              ) : (
                <p className="mt-4 type-subhead text-muted-foreground">
                  Añade ejercicios a esta sesión desde tu rutina y empieza cuando quieras.
                </p>
              )
            )}
          </section>

          {!completionReady && !loadError && (
            <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 py-12 md:min-h-0">
              <Spinner label="Comprobando tu sesión" />
              <p aria-hidden="true" className="type-subhead text-muted-foreground">Comprobando tu sesión…</p>
            </div>
          )}
          {loadError && (
            <div role="alert">
              <EmptyState
                className="min-h-[50dvh] md:min-h-0"
                icon={CloudOff}
                title="No pudimos cargar tu entrenamiento"
                description="Tus registros siguen intactos. Comprueba la conexión y vuelve a intentarlo."
                action={
                  <Button type="button" variant="plain" onClick={() => { void hapticTap(); setReloadLogs((value) => value + 1); }}>
                    Reintentar
                  </Button>
                }
              />
            </div>
          )}

          <Dialog open={workoutCompleted && showCompletionSummary} onOpenChange={setShowCompletionSummary}>
            {workoutCompleted && showCompletionSummary && (
              // Hoja grande con «Listo» propio: se oculta el aspa por defecto.
              <DialogContent onOpenAutoFocus={(event) => event.preventDefault()} className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden pb-[max(0.75rem,var(--safe-bottom))] [&>button:last-child]:hidden sm:max-h-[85dvh] sm:max-w-md sm:pt-2">
                {/* El resumen trae su propio margen lateral: se saca del de la hoja. */}
                <div className="-mx-4 flex min-h-0 flex-1 flex-col sm:-mx-6 [&_*]:min-w-0">
                  {renderSummary(true)}
                </div>
              </DialogContent>
            )}
          </Dialog>

          {workoutCompleted && !showCompletionSummary && (
            <div className="flex flex-col pb-24 sm:pb-8">
              <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
                {renderSummary(false)}
                <p className="pt-4 text-center type-footnote text-muted-foreground">
                  Toca recuperar: hidrátate, come bien y mañana vuelves más fuerte.
                </p>
                <Button type="button" variant="plain" className="mt-1 w-full shrink-0" onClick={() => { void hapticTap(); onExit?.(); }}>
                  Volver al inicio
                </Button>
                <Button type="button" variant="plain" size="sm" className="mt-1 w-full shrink-0" onClick={() => { void hapticTap(); void undoCompletion(); }} disabled={saving}>
                  Reabrir sesión de hoy
                </Button>
              </div>
            </div>
          )}

          {/* Ejercicio a ejercicio: los ejercicios numerados arriba y el ejercicio que toca, grande. */}
          {focusMode && !workoutCompleted && completionReady && !loadError && expandedExercise !== null && (() => {
            const active = currentPlan.exercises?.[expandedExercise];
            if (!active) return null;
            const meta = exerciseMetadata.byId[active.exercise_id] || exerciseMetadata.byName[active.name];
            // Siempre a tamaño de visor (1000 px): la foto del plan puede ser la original de ~2 MB.
            const img = fastImage(meta?.image_url || active.image_url, HERO_SIDE);
            const vid = meta?.video_url || active.video_url;
            const total = currentPlan.exercises?.length ?? 0;
            const activeName = swaps[active.name] || active.name;
            const activeMuscle = active.muscle_group || meta?.muscle_group;
            return (
              <div className="mx-auto w-full max-w-[680px]">
                {/* Carrusel numerado: el que ves con aro dorado, los hechos con su check y el resto en gris.
                    Tocar un número abre ese ejercicio; deslizar la foto hace lo mismo. */}
                <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
                  <div role="tablist" aria-label="Ejercicios de la sesión" className="flex w-max gap-2 py-0.5">
                    {(currentPlan.exercises || []).map((item, idx) => {
                      const itemSets = exerciseLogs[item.name] || [];
                      const done = itemSets.length > 0 && itemSets.every((set) => set.done);
                      const isActive = idx === expandedExercise;
                      return (
                        <button
                          key={`${item.name}-${idx}`}
                          ref={(node) => { stepRefs.current[idx] = node; }}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          aria-label={`${idx + 1}. ${swaps[item.name] || item.name}${done ? ", hecho" : ""}`}
                          onClick={() => { if (!isActive) { setExpandedExercise(idx); void hapticSelection(); } }}
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full type-headline tabular-nums transition-[transform,background-color,color] duration-200 active:scale-95 [touch-action:manipulation]",
                            isActive ? "bg-card text-primary ring-2 ring-inset ring-primary" : done ? "bg-primary/15 text-primary" : "bg-card text-muted-foreground",
                          )}
                        >
                          {done && !isActive ? <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" /> : idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <motion.div
                  key={expandedExercise}
                  initial={{ opacity: 0.4, x: 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.35}
                  onDragEnd={(_, info) => {
                    const swipe = info.offset.x + info.velocity.x * 0.2;
                    if (swipe < -60 && expandedExercise < total - 1) { setExpandedExercise(expandedExercise + 1); void hapticSelection(); }
                    else if (swipe > 60 && expandedExercise > 0) { setExpandedExercise(expandedExercise - 1); void hapticSelection(); }
                  }}
                  style={{ touchAction: "pan-y" }}
                  aria-label="Desliza para cambiar de ejercicio"
                  // El ejercicio en grande: su clip en bucle sobre la foto; sin foto, el ejercicio por su
                  // músculo en la silueta (nunca un hueco). Portada de 28, como las de Hoy.
                  className="relative mt-3 aspect-[16/10] max-h-[32dvh] w-full overflow-hidden rounded-sheet bg-card md:max-h-[340px] md:cursor-grab md:active:cursor-grabbing">
                  {img ? (
                    <img src={img} alt={activeName} draggable={false} decoding="async" onLoad={noteImageShown} {...{ fetchpriority: "high" }} loading="eager" className="h-full w-full object-cover" />
                  ) : (
                    <div className="pointer-events-none flex h-full w-full items-center justify-center px-6 py-4">
                      <MuscleMap primary={activeMuscle ? [activeMuscle] : []} size={84} dots={false} />
                    </div>
                  )}
                  <ExerciseLoop key={vid ?? active.name} src={vid} poster={img} priority />
                  {/* La ficha de técnica, a un toque y sin tapar el ejercicio. */}
                  <button
                    type="button"
                    aria-label={`Ver técnica de ${activeName}`}
                    onClick={() => { void hapticTap(); setTechnique({ name: active.name, image: img, video: vid, series: active.series != null ? String(active.series) : undefined, reps: active.reps != null ? String(active.reps) : undefined, rest: active.rest, category: active.muscle_group || meta?.muscle_group, type: active.exercise_type || meta?.exercise_type, pattern: meta?.movement_pattern || inferMotionPattern(active.name, active.muscle_group || meta?.muscle_group), stimulus: meta?.stimulus_type, load: meta?.load_level }); }}
                    className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center transition-opacity active:opacity-60"
                  >
                    <span className="material flex h-9 w-9 items-center justify-center rounded-full text-foreground">
                      <Info className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                  </button>
                </motion.div>
              </div>
            );
          })()}

          {/* Ejercicios: lista agrupada antes de empezar; en sesión, solo el ejercicio en foco o todos en tarjetas */}
          {!workoutCompleted && completionReady && !loadError && (
          <section className={started ? "mx-auto w-full max-w-[680px]" : "pb-28 md:pb-0"}>
          {listMode && (
            // Toda la sesión: el nombre grande y el avance por ejercicios; el tiempo y «Pausar», abajo.
            <header className="px-1 pb-4">
              <h1 className="line-clamp-2 type-title1">{sessionName}</h1>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={progressPercent} aria-valuenow={Math.round(progressPercent)} aria-label="Avance de la sesión" className="h-1.5 flex-1 [&>div]:bg-primary" />
                <span className="shrink-0 type-footnote tabular-nums text-muted-foreground">{completedExercises} de {plural(exerciseCount, "ejercicio", "ejercicios")}</span>
              </div>
            </header>
          )}
          {!started && exerciseCount > 0 && (
            <h3 className="px-4 pb-2 type-title3 md:px-0">Ejercicios</h3>
          )}
          <div className={`${exerciseListClass} ${paused ? "pointer-events-none opacity-40 transition-opacity" : ""}`} aria-disabled={paused || undefined}>
          {(currentPlan.exercises || []).map((ex, i) => {
            const isExpanded = workoutView === "list" ? !closedExercises.includes(i) : expandedExercise === i;
            if (focusMode && expandedExercise !== i) return null;
            const focused = focusMode && isExpanded;
            const sets = exerciseLogs[ex.name] || [];
            const doneSets = sets.filter((s) => s.done).length;
            // Minimalismo: las acciones (bajada / calentamiento) solo se ofrecen
            // en la primera serie pendiente, nunca en todas las filas.
            const firstPendingIndex = sets.findIndex((s) => !s.done);
            const allDone = doneSets === sets.length && sets.length > 0;
            const prevSets = previousLogs[ex.name];
            const restSec = parseRestSeconds(ex.rest);
            const metadata = exerciseMetadata.byId[ex.exercise_id] || exerciseMetadata.byName[ex.name];
            const exerciseVideo = metadata?.video_url || ex.video_url;
            const exerciseCategory = ex.muscle_group || metadata?.muscle_group;
            const exerciseType = ex.exercise_type || metadata?.exercise_type;
            // Patrón, estímulo y carga: con los tres se dibuja la huella del ejercicio.
            const exercisePattern = ("movement_pattern" in ex && typeof ex.movement_pattern === "string"
              ? ex.movement_pattern
              : metadata?.movement_pattern) ?? null;
            // Sin patrón en la ficha, el deducido: la miniatura y la ficha nunca enseñan un hueco.
            const exerciseMotionPattern = exercisePattern || inferMotionPattern(ex.name, exerciseCategory);
            const exerciseStimulus = metadata?.stimulus_type ?? null;
            const exerciseLoad = metadata?.load_level ?? null;
            const displayName = swaps[ex.name] || ex.name;
            const exerciseMeta = <>{plural(ex.series, "serie", "series")} · {ex.reps} reps · {ex.rest}</>;

            // Antes de empezar, la lista solo informa: cada fila abre la sesión en ese ejercicio.
            if (!started) {
              return (
                <button
                  key={`${selectedDay}-${i}`}
                  type="button"
                  onClick={() => { void hapticTap(); startWorkout(i); }}
                  className="flex w-full items-center gap-3 pl-3 text-left transition-colors duration-150 active:bg-accent [touch-action:manipulation]"
                >
                  <span className="relative shrink-0">
                    <ExerciseThumb image={metadata?.image_url || ex.image_url} video={exerciseVideo} name={ex.name} pattern={exerciseMotionPattern} stimulus={exerciseStimulus} load={exerciseLoad} muscleGroup={exerciseCategory} completed={allDone} />
                  </span>
                  <span className={`flex min-h-[68px] min-w-0 flex-1 flex-col justify-center py-2 pr-4 ${i > 0 ? "sep-t" : ""}`}>
                    <span className={`line-clamp-2 type-headline ${allDone ? "text-muted-foreground" : ""}`}>{displayName}</span>
                    <span className="mt-0.5 type-footnote tabular-nums text-muted-foreground">{exerciseMeta}</span>
                  </span>
                </button>
              );
            }

            const trackingConfig = getExerciseTrackingConfig({
              name: ex.name,
              skill_tag: metadata?.skill_tag ?? undefined,
              movement_pattern: "movement_pattern" in ex && typeof ex.movement_pattern === "string"
                ? ex.movement_pattern
                : metadata?.movement_pattern ?? undefined,
              exercise_type: exerciseType ?? undefined,
              tracking_mode: ex.tracking_mode ?? metadata?.tracking_mode ?? undefined,
            });
            const columns = setColumns(trackingConfig);
            // La progresión se calcula solo con las series de trabajo de la sesión anterior.
            const progression = getProgressionSuggestion(
              ex,
              prevSets?.filter((set) => !isWorkoutSetWarmup(set)),
              previousSessionRpe,
            );
            // Superserie: cadena a la que pertenece este ejercicio y, si no es el
            // último de la lista, el siguiente con el que se puede enlazar.
            const supersetChain = getSupersetChain(exerciseNames, supersetLinks, i);
            const isInSuperset = supersetChain.length > 1;
            const supersetPosition = supersetChain.indexOf(i) + 1;
            const isSupersetLinked = Boolean(supersetLinks[ex.name]);
            const nextExercise = currentPlan.exercises?.[i + 1] ?? null;
            const nextExerciseName = nextExercise ? swaps[nextExercise.name] || nextExercise.name : "";
            const openTechnique = () => setTechnique({
              name: ex.name,
              image: metadata?.image_url || ex.image_url,
              video: exerciseVideo,
              series: ex.series != null ? String(ex.series) : undefined,
              reps: ex.reps != null ? String(ex.reps) : undefined,
              rest: ex.rest,
              category: exerciseCategory,
              type: exerciseType,
              pattern: exerciseMotionPattern,
              stimulus: exerciseStimulus,
              load: exerciseLoad,
            });
            const toggleList = () => {
              void hapticSelection();
              setClosedExercises((closed) => closed.includes(i) ? closed.filter((index) => index !== i) : [...closed, i]);
            };

            // Nombre del ejercicio y una línea en gris: series, reps y descanso (y la superserie).
            // En foco, el nombre es el titular de la pantalla (Title 1); en la lista, el de la fila.
            const TextBox = focused ? "div" : "span";
            const NameTag = focused ? "h2" : "span";
            const exerciseText = (
              <TextBox className="min-w-0 flex-1 text-left">
                <NameTag className={cn("block", focused ? "line-clamp-2 type-title1" : `line-clamp-2 type-headline ${allDone ? "text-muted-foreground" : ""}`)}>
                  {displayName}
                </NameTag>
                {swaps[ex.name] && <span className="block truncate type-footnote text-muted-foreground">En lugar de {ex.name}</span>}
                <span className={cn("mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums text-muted-foreground", focused ? "type-subhead" : "type-footnote")}>
                  <span>{exerciseMeta}</span>
                  {isInSuperset && (
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 type-footnote font-medium text-muted-foreground">
                      Superserie {supersetPosition}/{supersetChain.length}
                    </span>
                  )}
                </span>
              </TextBox>
            );

            // Lo secundario, detrás del «···» del ejercicio: técnica, cambiar y superserie.
            const exerciseMenu = (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Opciones de ${displayName}`}
                    onClick={() => void hapticTap()}
                    className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center transition-opacity active:opacity-60 [touch-action:manipulation]", focused && "-mr-2.5 -mt-1.5")}
                  >
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-secondary text-foreground">
                      <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-w-[min(20rem,calc(100vw-2rem))]">
                  <DropdownMenuItem onSelect={() => { void hapticTap(); afterMenu(openTechnique); }}>
                    Ver técnica
                  </DropdownMenuItem>
                  {!allDone && (
                    <DropdownMenuItem onSelect={() => afterMenu(() => setSwapTarget(ex.name))}>
                      Cambiar ejercicio
                    </DropdownMenuItem>
                  )}
                  {(isSupersetLinked || nextExercise) && (
                    <DropdownMenuItem className="whitespace-normal" onSelect={() => { void hapticSelection(); setSupersetLinks((links) => toggleSupersetLink(links, ex.name)); }}>
                      {isSupersetLinked ? "Quitar de la superserie" : `Superserie con ${nextExerciseName}`}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );

            return (
              <div key={`${selectedDay}-${i}`} className={focused ? "" : "overflow-hidden rounded-card bg-card"}>
                {focused ? (
                  <div className="flex items-start gap-2 pt-4">
                    {exerciseText}
                    {exerciseMenu}
                  </div>
                ) : (
                  <div className="flex items-center pr-1">
                    {/* Toca la cabecera para plegar o desplegar el ejercicio. */}
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={toggleList}
                      className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-left transition-opacity active:opacity-70 [touch-action:manipulation]"
                    >
                      <span className="relative shrink-0">
                        <ExerciseThumb image={metadata?.image_url || ex.image_url} video={exerciseVideo} name={ex.name} pattern={exerciseMotionPattern} stimulus={exerciseStimulus} load={exerciseLoad} muscleGroup={exerciseCategory} completed={allDone} />
                        {/* Número de orden en la esquina: dorado el que toca ahora y los hechos. */}
                        <span aria-hidden="true" className={`absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full type-footnote font-bold tabular-nums ring-2 ring-card ${allDone || i === currentExerciseIndex ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                          {i + 1}
                        </span>
                      </span>
                      {exerciseText}
                    </button>
                    {exerciseMenu}
                    <button type="button" tabIndex={-1} aria-hidden="true" onClick={toggleList} className="flex h-11 w-9 shrink-0 items-center justify-center text-muted-foreground">
                      <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                )}
                {!allDone && (
                  <ExerciseSwap
                    trigger={false}
                    open={swapTarget === ex.name}
                    onOpenChange={(open) => setSwapTarget(open ? ex.name : null)}
                    original={ex.name}
                    current={swaps[ex.name]}
                    movementPattern={metadata?.movement_pattern}
                    muscleGroup={metadata?.muscle_group}
                    onSelect={async (name) => {
                      setSwaps((s) => {
                        const next = { ...s };
                        if (name) next[ex.name] = name;
                        else delete next[ex.name];
                        return next;
                      });
                      // Save preference to database
                      try {
                        await supabase.from("exercise_user_preferences").upsert({
                          user_id: userId,
                          original_exercise_name: ex.name,
                          preferred_exercise_name: name || null,
                          last_used_at: new Date().toISOString(),
                        }, {
                          onConflict: "user_id,original_exercise_name",
                        });
                      } catch (error) {
                        console.error("Failed to save exercise swap preference:", error);
                      }
                    }}
                  />
                )}

                {/* Tabla de series del ejercicio */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={focused ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className={focused ? "pt-4" : "px-2 pb-3"}>
                        {/* Cabecera de columnas: Serie · Anterior · kg · Reps · ✓ */}
                        {/* Alineada con las filas: el margen de la tarjeta (en foco) más el de cada fila. */}
                        <div aria-hidden="true" className={cn(SET_GRID, "pb-1.5 type-caption1 font-medium text-muted-foreground", focused ? "px-3" : "px-1.5")}>
                          <span className="text-center">Serie</span>
                          <span className="text-center">Anterior</span>
                          <span className="truncate text-center">{columns.load}</span>
                          <span className="truncate text-center">{columns.value}</span>
                          <span className="flex items-center justify-center">
                            <Check className="h-3.5 w-3.5" strokeWidth={2} />
                          </span>
                        </div>

                        {/* En foco la tabla es la tarjeta; en la lista ya va dentro de la del ejercicio. */}
                        <div className={cn("flex flex-col gap-1", focused && "rounded-card bg-card p-1.5")}>
                        {sets.map((set, si) => {
                          const mainError = !set.done ? getWorkoutSetInputError(set) : null;
                          const dropsError = !set.done ? getWorkoutSetDropsInputError(set) : null;
                          const drops = getWorkoutSetDrops(set);
                          // Una serie sin repeticiones todavía no es un error: es una serie por rellenar.
                          // Ese caso se avisa al intentar marcarla; aquí solo se señala lo mal escrito.
                          const repsMissing = !Number.isInteger(set.reps) || set.reps <= 0;
                          const dropRepsMissing = drops.some((drop) => !Number.isInteger(drop.reps) || drop.reps <= 0);
                          const inputError = (repsMissing ? null : mainError) ?? (dropRepsMissing ? null : dropsError);
                          const isWarmup = isWorkoutSetWarmup(set);
                          const isCurrent = si === firstPendingIndex;
                          const livePR = livePRs[`${ex.name}#${si}`];
                          const previous = prevSets?.[si];
                          const suffix = trackingConfig.valueSuffix ?? "";
                          const previousText = previous?.done
                            ? trackingConfig.fixedBodyweight
                              ? `${previous.reps}${suffix}`
                              : `${decimalComma(previous.weight) || (trackingConfig.kind === "weighted_bodyweight" ? "PC" : "—")}${TIMES}${previous.reps}${suffix}`
                            : "—";
                          // Serie hecha: la fila entera se tiñe de dorado y el círculo se rellena.
                          // La de calentamiento nunca lleva el color de serie hecha.
                          const checkClass = set.done
                            ? isWarmup
                              ? "bg-muted-foreground text-background"
                              : "bg-primary text-primary-foreground"
                            : inputError
                              ? "bg-secondary text-destructive ring-2 ring-inset ring-destructive"
                              : "bg-secondary text-muted-foreground";
                          const fieldTone = (sameAsPrevious: boolean) => cn(
                            NUMBER_FIELD,
                            set.done && DONE_FIELD,
                            (isWarmup || (!set.done && sameAsPrevious)) && "text-muted-foreground",
                          );
                          return (
                          <div
                            key={si}
                            aria-current={isCurrent ? "step" : undefined}
                            className={cn(
                              "rounded-chip px-1.5 py-1.5 transition-colors duration-300",
                              set.done && !isWarmup ? "bg-primary/15" : isCurrent ? "ring-1 ring-inset ring-primary/30" : "",
                            )}
                          >
                            {/* Segmento principal de la serie */}
                            <div className={SET_GRID}>
                              {/* Número de serie; «C» en las de calentamiento */}
                              <span className={cn("text-center type-headline tabular-nums", isCurrent ? "text-primary" : "text-muted-foreground")}>
                                {isWarmup ? <><span aria-hidden="true">C</span><span className="sr-only">Calentamiento</span></> : si + 1}
                              </span>
                              <span className="truncate text-center type-caption1 tabular-nums text-muted-foreground">
                                <span aria-hidden="true">{previousText}</span>
                                <span className="sr-only">{previous?.done ? `Anterior: ${previousText.replace(TIMES, " por ")}` : "Sin serie anterior"}</span>
                              </span>

                              {/* Peso */}
                              <div className="min-w-0">
                                {trackingConfig.fixedBodyweight ? (
                                  <div aria-label="Peso corporal" className={cn("flex h-11 w-full items-center justify-center rounded-chip type-headline text-muted-foreground", set.done ? DONE_FIELD : "bg-secondary")}>PC</div>
                                ) : (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  enterKeyHint="next"
                                  autoComplete="off"
                                  value={set.weight}
                                  onChange={(e) => updateSet(ex.name, si, "weight", e.target.value)}
                                  placeholder={decimalComma(String(progression?.weight || prevSets?.[si]?.weight || ex.weight || trackingConfig.weightPlaceholder || "kg"))}
                                  onFocus={focusSetField}
                                  aria-label={`Peso de la serie ${si + 1} de ${ex.name}`}
                                  aria-invalid={Boolean(inputError && mainError && set.weight.trim())}
                                  className={fieldTone(Boolean(prevSets?.[si]?.done && set.weight === prevSets[si].weight))}
                                />
                                )}
                              </div>

                              {/* Repeticiones */}
                              <div className="min-w-0">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  enterKeyHint="done"
                                  autoComplete="off"
                                  value={set.reps}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val)) updateSet(ex.name, si, "reps", val);
                                  }}
                                  onFocus={focusSetField}
                                  aria-label={`Repeticiones de la serie ${si + 1} de ${ex.name}`}
                                  className={cn(fieldTone(Boolean(prevSets?.[si]?.done && set.reps === prevSets[si].reps)), repsMissing && "text-muted-foreground")}
                                />
                              </div>

                              {/* ✓: marca la serie entera (bajadas incluidas) y arranca el descanso */}
                              <button
                                type="button"
                                onClick={() => toggleSetDone(ex.name, si, restSec, trackingConfig.fixedBodyweight ? undefined : String(progression?.weight || prevSets?.[si]?.weight || ex.weight || ""))}
                                aria-label={`${set.done ? "Desmarcar" : "Marcar"} serie ${si + 1} de ${ex.name}`}
                                className="flex h-11 w-11 items-center justify-center justify-self-center rounded-full transition-opacity duration-150 active:opacity-60 [touch-action:manipulation]"
                              >
                                {/* Al marcar, el círculo «salta» con un muelle (como Hevy/Fitness). */}
                                <motion.span
                                  key={set.done ? "done" : "pending"}
                                  initial={set.done && !prefersReducedMotion ? { scale: 0.6 } : { opacity: 0.7 }}
                                  animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                                  transition={prefersReducedMotion ? { duration: 0.15 } : { type: "spring", stiffness: 520, damping: 17 }}
                                  className={cn("flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150", checkClass)}
                                >
                                  <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
                                </motion.span>
                              </button>
                            </div>

                            {livePR && (
                              <motion.div
                                initial={{ opacity: 0, y: 2 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, ease: "easeOut" }}
                                className="ml-10 mt-1.5 flex w-fit origin-left items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 type-footnote font-semibold tabular-nums text-primary">
                                <span>Récord personal · {decimalComma(livePR)}</span>
                              </motion.div>
                            )}

                            {/* Dropset: bajadas dentro de la misma serie, sin descanso entre ellas */}
                            {drops.map((drop, di) => {
                              const dropError = !set.done ? getWorkoutSetDropInputError(drop) : null;
                              return (
                              <div key={di} className={`mt-1.5 ${SET_GRID}`}>
                                <span className="flex items-center justify-center text-muted-foreground">
                                  <TrendingDown className="h-4 w-4" aria-hidden="true" />
                                  <span className="sr-only">Bajada {di + 1}</span>
                                </span>
                                <span aria-hidden="true" />
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  enterKeyHint="next"
                                  autoComplete="off"
                                  value={drop.weight}
                                  onChange={(e) => updateDrop(ex.name, si, di, { weight: e.target.value })}
                                  placeholder="kg"
                                  onFocus={focusSetField}
                                  aria-label={`Peso de la bajada ${di + 1} de la serie ${si + 1} de ${ex.name}`}
                                  aria-invalid={Boolean(dropError && drop.weight.trim() && Number.isInteger(drop.reps) && drop.reps > 0)}
                                  className={cn(NUMBER_FIELD, set.done && DONE_FIELD)}
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  enterKeyHint="done"
                                  autoComplete="off"
                                  value={drop.reps}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val)) updateDrop(ex.name, si, di, { reps: val });
                                  }}
                                  onFocus={focusSetField}
                                  aria-label={`Repeticiones de la bajada ${di + 1} de la serie ${si + 1} de ${ex.name}`}
                                  className={cn(NUMBER_FIELD, set.done && DONE_FIELD)}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeDrop(ex.name, si, di)}
                                  aria-label={`Quitar la bajada ${di + 1} de la serie ${si + 1} de ${ex.name}`}
                                  className="flex h-11 w-11 items-center justify-center justify-self-center rounded-full text-muted-foreground transition-opacity duration-150 active:opacity-60"
                                >
                                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-secondary">
                                    <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                                  </span>
                                </button>
                              </div>
                              );
                            })}
                            {isCurrent && advanced && (
                              <div className="mt-2 flex gap-2 pl-10 pr-1">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  aria-label={`Añadir una bajada a la serie ${si + 1} de ${ex.name}`}
                                  onClick={() => addDrop(ex.name, si)}
                                  className="flex-1 px-2"
                                >
                                  <TrendingDown aria-hidden="true" />
                                  Bajada
                                </Button>
                                {/* Calentamiento: se guarda y se marca con ✓, pero no cuenta en tus métricas */}
                                <Button
                                  type="button"
                                  variant={isWarmup ? "tinted" : "secondary"}
                                  size="sm"
                                  aria-pressed={isWarmup}
                                  aria-label={`${isWarmup ? "Quitar" : "Marcar"} la serie ${si + 1} de ${ex.name} como calentamiento`}
                                  onClick={() => toggleWarmup(ex.name, si)}
                                  className="flex-1 px-2"
                                >
                                  <Flame fill={isWarmup ? "currentColor" : "none"} aria-hidden="true" />
                                  Calentamiento
                                </Button>
                              </div>
                            )}

                            {drops.length > 0 && (
                              <p className="mt-1.5 pl-10 type-footnote tabular-nums text-muted-foreground">
                                {formatWorkoutSetSummary(set)}
                              </p>
                            )}
                            {isWarmup && isCurrent && (
                              <p className="mt-1.5 pl-10 type-footnote text-muted-foreground">
                                Calentamiento: se guarda aparte de tus cifras.
                              </p>
                            )}
                            {inputError && <p className="mt-1.5 pl-10 type-footnote text-destructive">{inputError}</p>}
                          </div>
                          );
                        })}
                        </div>
                        <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => {
                          const last = sets[sets.length - 1];
                          setExerciseLogs((logs) => ({ ...logs, [ex.name]: [...(logs[ex.name] || []), {
                            weight: last?.weight ?? ex.weight ?? "", reps: last?.reps ?? ex.reps, done: false,
                          }] }));
                          void hapticTap();
                        }}><Plus aria-hidden="true" />Añadir serie</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          </div>
          {started && !workoutCompleted && (
            <>
              {/* En la lista, «Añadir ejercicio» también va al final; en foco, en «···». */}
              {!focusMode && (
                <Button type="button" variant="secondary" size="lg" disabled={paused} className="mt-3 w-full" onClick={() => { void hapticTap(); setExtraPickerOpen(true); }}>
                  <Plus aria-hidden="true" />Añadir ejercicio a esta sesión
                </Button>
              )}
              <ExercisePicker
                open={extraPickerOpen}
                onOpenChange={setExtraPickerOpen}
                existing={exerciseNames}
                onPick={(entries) => { addSessionExercises(entries); setExtraPickerOpen(false); }}
              />
            </>
          )}
          </section>
          )}

          {/* Estado del guardado para VoiceOver; visible solo si falla. */}
          {started && !loadError && (
            <p role="status" aria-live="polite" className={`sr-only ${saveError ? "not-sr-only mb-2 text-center type-footnote text-destructive" : ""}`}>
              {saveStatus === "error"
                ? "Error al guardar. Comprueba tu conexión."
                : saveStatus === "pending"
                  ? "Cambios pendientes de guardar"
                  : saveStatus === "saving"
                    ? "Guardando cambios…"
                    : saveStatus === "saved"
                      ? "Guardado automáticamente"
                      : "Se guarda automáticamente"}
            </p>
          )}
          {/* Barra fija, igual en las dos vistas: el descanso cuando toca, encima y sin tapar las series,
              y Pausar · tiempo · Finalizar, la única acción dorada de la pantalla. */}
          <AnimatePresence initial={false}>
            {started && !workoutCompleted && (
              <motion.div
                initial={{ y: 120, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 120, opacity: 0 }}
                transition={prefersReducedMotion ? { duration: 0.2 } : { type: "spring", stiffness: 340, damping: 34 }}
                className="app-chrome sticky bottom-0 z-20 -mx-4 mt-auto border-t-[0.5px] px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3"
              >
                <div className="mx-auto w-full max-w-[680px]">
                {restTimer !== null && (
                  <div role="timer" aria-label="Descanso entre series" aria-disabled={paused || undefined} className={cn("mb-3 flex items-center gap-1.5 transition-opacity", paused && "pointer-events-none opacity-40")}>
                    <div className="mr-1 min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="type-figure text-[30px] leading-none text-foreground">{restClock(restTimer)}</span>
                        <span className="truncate type-footnote text-muted-foreground">Descanso</span>
                      </div>
                      {/* Una barra tranquila que se vacía; nada de anillos que salten. */}
                      <div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                          style={{ width: `${Math.round(Math.min(1, restTimer / Math.max(restTarget, 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <Button type="button" variant="secondary" size="sm" aria-label="Restar 15 segundos" onClick={() => { void hapticSelection(); adjustRest(-15); }} className="h-11 shrink-0 px-3 tabular-nums [touch-action:manipulation]">−15 s</Button>
                    <Button type="button" variant="secondary" size="sm" aria-label="Sumar 15 segundos" onClick={() => { void hapticSelection(); adjustRest(15); }} className="h-11 shrink-0 px-3 tabular-nums [touch-action:manipulation]">+15 s</Button>
                    <Button type="button" variant="secondary" size="sm" aria-label="Saltar descanso" onClick={() => { void hapticTap(); skipRest(); }} className="h-11 shrink-0 px-3.5 [touch-action:manipulation]">Saltar</Button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {/* Pausa real: congela el tiempo y el descanso, y se guarda en el borrador. */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label={paused ? "Reanudar" : "Pausar"}
                    onClick={() => { void hapticTap(); if (paused) resumeWorkout(); else pauseWorkout(); }}
                    className="h-12 w-12 shrink-0 [&_svg]:size-5"
                  >
                    {paused ? <Play className="fill-current" aria-hidden="true" /> : <Pause className="fill-current" aria-hidden="true" />}
                  </Button>
                  <div className="flex min-w-0 flex-1 flex-col items-center">
                    <span aria-label="Tiempo de sesión" className="type-figure text-[28px] leading-none text-foreground">{formatElapsed(sessionElapsedMs)}</span>
                    {/* Avance discreto: «3 de 12 series»; en pausa, «En pausa». */}
                    <span className={cn("mt-1 max-w-full truncate type-footnote tabular-nums", paused ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {paused ? "En pausa" : seriesProgress}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => { void hapticTap(); void finishWorkout(); }}
                    disabled={saving || completedSets === 0}
                    aria-label="Finalizar"
                    className="shrink-0 px-5"
                  >
                    {saving ? <Spinner size="sm" className="text-primary-foreground" label="Guardando" /> : <Check strokeWidth={2.5} aria-hidden="true" />}
                    Finalizar
                  </Button>
                </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* El ejercicio a pantalla completa: nada más alrededor */}
      <ExerciseFocus
        exercise={technique ? {
          name: technique.name,
          image: technique.image,
          video: technique.video,
          series: technique.series,
          reps: technique.reps,
          rest: technique.rest,
          muscleGroup: technique.category,
          exerciseType: technique.type,
          pattern: technique.pattern,
          stimulus: technique.stimulus,
          load: technique.load,
        } : null}
        onClose={() => setTechnique(null)}
      />


      <RPEDialog open={rpeOpen} onConfirm={handleRPEConfirm} />
      <Drawer open={finishIncompleteOpen} onOpenChange={setFinishIncompleteOpen}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="px-5 pt-4 text-center">
            <DrawerTitle>¿Terminar con series pendientes?</DrawerTitle>
            <DrawerDescription className="tabular-nums">
              Llevas {seriesProgress}. Puedes terminar ahora y guardar lo hecho, o seguir entrenando.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="gap-2 px-5 pb-5">
            <Button size="lg" className="min-h-11 w-full" onClick={() => { void hapticImpact("medium"); void finishWorkoutConfirmed(); }} disabled={saving}>
              Terminar y guardar
            </Button>
            <Button size="lg" variant="ghost" className="min-h-11 w-full" onClick={() => { void hapticSelection(); setFinishIncompleteOpen(false); }}>
              Seguir entrenando
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <Drawer open={discardOpen} onOpenChange={setDiscardOpen}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="px-5 pt-4 text-center">
            <DrawerTitle>¿Descartar entrenamiento?</DrawerTitle>
            <DrawerDescription>
              Se borrarán las series de esta sesión y no contará como hecha. Podrás empezarla de nuevo cuando quieras.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="gap-2 px-5 pb-5">
            <Button size="lg" variant="destructive" className="min-h-11 w-full font-semibold" onClick={() => void discardWorkout()} disabled={saving}>
              Descartar entrenamiento
            </Button>
            <Button size="lg" variant="ghost" className="min-h-11 w-full font-semibold" onClick={() => { void hapticSelection(); setDiscardOpen(false); }}>
              Seguir entrenando
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default WorkoutTracker;
