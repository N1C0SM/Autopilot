import RecordCelebration, { type RecordMoment } from "@/app/components/dashboard/RecordCelebration";
import { useSessionCover } from "@/shared/hooks/useSessionCover";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, ChevronLeft, CloudOff, Dumbbell, Flame, Clock, CalendarDays,
  TrendingDown, Plus, X, Trophy, Info, Play, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Progress } from "@/shared/components/ui/progress";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import NavBar from "@/shared/components/native/NavBar";
import { toast } from "sonner";
import type { DayPlan, ExerciseTrackingMode, GymExerciseEntry } from "@/shared/types/training";
import ExercisePicker from "@/app/components/dashboard/ExercisePicker";
import RPEDialog from "@/app/components/dashboard/RPEDialog";
import { ExerciseThumb, isDirectFile } from "@/app/components/ExerciseMedia";
import ExerciseFocus from "@/app/components/ExerciseFocus";
import { useExerciseMetadata } from "@/shared/hooks/useExerciseMetadata";
import { getWorkoutAdvanced, getWorkoutRestPreference, getWorkoutView, setWorkoutAdvanced, setWorkoutView, WORKOUT_VIEW_EVENT } from "@/shared/lib/workoutPreferences";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { readActiveWorkout, saveActiveWorkout, clearActiveWorkout, clearPendingOfflineSeries, remainingRestSeconds, formatElapsed, playRestBeep } from "@/shared/lib/activeWorkout";
import { getProgressionSuggestion } from "@/shared/lib/workoutProgression";
import { parsePositiveWeight } from "@/shared/lib/weight";
import { WorkoutSummary } from "@/app/components/dashboard/WorkoutSummary";
import { ExerciseSwap } from "@/app/components/dashboard/ExerciseSwap";
import { formatTrainingTitle } from "@/shared/lib/trainingDisplay";
import { hapticImpact, hapticNotify, hapticSelection, hapticSignature, hapticTap } from "@/shared/lib/native";
import SwipeSetEntry from "@/app/components/dashboard/SwipeSetEntry";
import LogAllSetsButton from "@/app/components/dashboard/LogAllSetsButton";
import NumericWeightPicker from "@/app/components/dashboard/NumericWeightPicker";
import { WeightAdjuster } from "@/app/components/dashboard/WeightAdjuster";
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
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Solo los días con sesión existen: un día sin plan nunca es navegable. */
const hasSessionIn = (plans: DayPlan[], day?: string | null) =>
  Boolean(day) && plans.some((p) => p.day === day && (p.type === "gimnasio" || p.type === "actividad"));

/** Siguiente día con sesión después de `from`, dando la vuelta a la semana. */
const nextSessionIn = (plans: DayPlan[], from: string): string | null => {
  const start = DAYS_ORDER.indexOf(from);
  if (start < 0) return null;
  for (let i = 1; i <= DAYS_ORDER.length; i += 1) {
    const day = DAYS_ORDER[(start + i) % DAYS_ORDER.length];
    if (hasSessionIn(plans, day)) return day;
  }
  return null;
};

/** Hoy si entrena; si no, la siguiente sesión de la semana. */
const firstSessionIn = (plans: DayPlan[], today: string): string | null =>
  hasSessionIn(plans, today) ? today : nextSessionIn(plans, today);

// `--accent` es ahora el gris de fila pulsada: el nivel alto se deriva del tinte.
const MUSCLE_INTENSITY = {
  low: { label: "Bajo", range: "1–2 series", fill: "hsl(45 95% 62%)" },
  medium: { label: "Medio", range: "3–5 series", fill: "hsl(28 96% 54%)" },
  high: { label: "Alto", range: "6+ series", fill: "hsl(4 88% 56%)" },
};

// Misma rejilla para la cabecera, las series y sus bajadas: n.º, previa, carga, valor, check.
const SET_GRID = "grid grid-cols-[24px_52px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2";
const NUMBER_FIELD = "scroll-mb-40 h-11 w-full min-w-0 rounded-[10px] border-0 bg-secondary px-1 text-center font-rounded type-headline tabular-nums outline-none transition-colors duration-150 placeholder:font-normal placeholder:text-muted-foreground/60 focus:bg-accent aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-inset aria-[invalid=true]:ring-destructive";
// La serie en curso: cifras más grandes que el resto.
const CURRENT_FIGURE = "!text-[22px] !font-bold !leading-7";
// iOS solo arranca un vídeo en silencio si `muted` está puesto antes de `play()`.
const startLoop = (el: HTMLVideoElement | null) => {
  if (!el) return;
  el.muted = true;
  void el.play().catch(() => undefined);
};
// Cápsula de 34 pt con el objetivo táctil ampliado a 44 pt.
const CAPSULE_HIT = "relative before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-['']";

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

const WorkoutTracker = ({ userId, dayPlans, initialDay, autoStart = false, resume = false, onAutoStartConsumed, onExit, onCancel, onSessionModeChange }: Props) => {
  const [resumeDraft] = useState(() => resume ? readActiveWorkout(userId) : null);
  const [workoutView, setWorkoutViewState] = useState(() => getWorkoutView(userId));
  const [advanced, setAdvancedState] = useState(() => getWorkoutAdvanced(userId));
  const [openExercises, setOpenExercises] = useState<number[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const refresh = () => { setWorkoutViewState(getWorkoutView(userId)); setAdvancedState(getWorkoutAdvanced(userId)); };
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
  // El día abierto siempre tiene sesión: el borrador activo, el día pedido si entrena,
  // si no hoy, si no el siguiente que entrene. Nunca un día sin sesión.
  const [selectedDay, setSelectedDay] = useState<string>(() =>
    resumeDraft?.plan.day
    ?? (hasSessionIn(dayPlans, initialDay) ? initialDay! : firstSessionIn(dayPlans, today) ?? today));
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, WorkoutSetLog[]>>({});
  const [previousLogs, setPreviousLogs] = useState<Record<string, WorkoutSetLog[]>>({});
  const [previousSessionRpe, setPreviousSessionRpe] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [restTimer, setRestTimerState] = useState<number | null>(null);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const setRestTimer = (seconds: number | null) => {
    setRestEndsAt(seconds === null ? null : Date.now() + seconds * 1000);
    setRestTimerState(seconds);
  };
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
  const [completionReady, setCompletionReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
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
  const currentPlan = basePlan && sessionExtras.length > 0
    ? { ...basePlan, exercises: [...(basePlan.exercises ?? []), ...sessionExtras] }
    : basePlan;
  // Portada de la sesión: generada con IA según sus músculos; mientras tanto, la foto del primer ejercicio.
  const coverExercises = currentPlan?.exercises || [];
  const firstExercise = coverExercises[0];
  const sessionCover = useSessionCover(
    coverExercises.map((e) => e.exercise_id),
    firstExercise ? (exerciseMetadata.byId[firstExercise.exercise_id] || exerciseMetadata.byName[firstExercise.name])?.image_url || firstExercise.image_url || null : null,
  );
  // En modo libre usamos un plan virtual con los ejercicios añadidos manualmente
  const freePlan = selectedDay === FREE_DAY && freeExercises.length > 0
    ? { day: FREE_DAY, type: "gimnasio" as const, exercises: freeExercises, routine_name: "Sesión libre", muscle_focus: null, sport: null, intensity: null, duration: null }
    : undefined;
  const activePlan = freePlan ?? currentPlan;
  const trainingTitle = formatTrainingTitle(activePlan?.routine_name, activePlan?.muscle_focus);
  // La firma ignora los extras: añadir un ejercicio no debe recargar ni borrar las series ya hechas.
  const currentPlanSignature = JSON.stringify((freePlan ?? basePlan) || null);
  useEffect(() => { setSessionExtras([]); }, [selectedDay]);
  // El plan puede llegar o cambiar después de montar: el día abierto siempre tiene sesión.
  useEffect(() => {
    if (started || resumeDraft) return;
    if (hasSessionIn(dayPlans, selectedDay)) return;
    const next = firstSessionIn(dayPlans, today) ?? today;
    if (next === selectedDay) return;
    setLogsReady(false);
    setCompletionReady(false);
    setSelectedDay(next);
  }, [dayPlans, resumeDraft, selectedDay, started, today]);
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
    setOpenExercises([exerciseIndex]);
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
    setOpenExercises([]);
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
      setOpenExercises([resumeDraft.expandedExercise ?? 0]);
      setRestEndsAt(resumeDraft.restEndsAt);
      setRestTimerState(remainingRestSeconds(resumeDraft.restEndsAt));
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
        setOpenExercises([draft.expandedExercise ?? 0]);
        setRestEndsAt(draft.restEndsAt);
        setRestTimerState(remainingRestSeconds(draft.restEndsAt));
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
    // Inicio siempre abre la rutina de hoy, aunque antes se consultara otro día.
    // Si hoy no tiene sesión no se auto-arranca otra rutina ni se abre un día de descanso.
    if (started) {
      onAutoStartConsumed?.();
      return;
    }
    if (selectedDay !== today) {
      if (!hasSessionIn(dayPlans, today)) {
        onAutoStartConsumed?.();
        return;
      }
      setLogsReady(false);
      setSelectedDay(today);
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
      setOpenExercises([0]);
      onSessionModeChange?.(true);
    }
    onAutoStartConsumed?.();
  }, [autoStart, currentDate, currentPlan?.type, dayPlans, loadError, logsReady, onAutoStartConsumed, onSessionModeChange, selectedDate, selectedDay, started, today, workoutCompleted]);

  // Absolute deadline: suspended timers cannot extend the athlete's rest.
  useEffect(() => {
    if (restEndsAt === null) return;
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
  }, [restEndsAt]);

  // Session clock: absolute start mark, restored from the draft so reloads don't reset it.
  useEffect(() => {
    if (!started || workoutCompleted) return;
    if (sessionStartedAt === null) {
      const draft = readActiveWorkout(userId);
      setSessionStartedAt(draft?.date === selectedDate && typeof draft.startedAt === "number" ? draft.startedAt : Date.now());
    }
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    setNowTick(Date.now());
    return () => window.clearInterval(id);
  }, [started, workoutCompleted, sessionStartedAt, userId, selectedDate]);
  useEffect(() => { if (!started) setSessionStartedAt(null); }, [started]);

  useEffect(() => {
    if (!started || !logsReady || workoutCompleted || activePlan?.type !== "gimnasio") return;
    const saved = saveActiveWorkout({ version: 1, userId, date: selectedDate, plan: activePlan,
      logs: exerciseLogs, swaps, supersetLinks, expandedExercise, restEndsAt, restTarget, startedAt: sessionStartedAt ?? undefined });
    if (!saved) setSaveError(true);
  }, [started, logsReady, workoutCompleted, userId, selectedDate, currentPlanSignature, sessionExtras, exerciseLogs, swaps, supersetLinks, expandedExercise, restEndsAt, restTarget, sessionStartedAt]);

  useEffect(() => {
    if (started && expandedExercise !== null) {
      setOpenExercises((open) => open.includes(expandedExercise) ? open : [...open, expandedExercise]);
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
      const url = meta?.image_url || ex.image_url;
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
      if (chain.length === 1 && setIndex === sets.length - 1 && activePlan?.exercises?.[exerciseIndex + 1]) {
        setExpandedExercise(exerciseIndex + 1);
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
        setOpenExercises([0]);
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
  const allSetsDone = totalSets > 0 && completedSets >= totalSets;
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
      completedExercises={completedExercises}
      plannedExercises={currentPlan?.exercises?.length || 0}
      rpe={sessionRpe}
      records={personalRecords}
      muscles={musclesWorked}
      muscleSetCounts={muscleSetCounts}
      intensityFor={(muscle) => getMuscleIntensity(muscleSetCounts[muscle]).fill}
      current={Object.entries(exerciseLogs).map(([name, sets]) => ({ name, sets }))}
      previous={Object.entries(previousLogs).map(([name, sets]) => ({ name, sets }))}
    />
  );

  const focusMode = started && workoutView === "focus" && expandedExercise !== null;
  // Si el usuario eligió «Ejercicio a ejercicio», nunca caemos a la lista vertical en plena sesión.
  useEffect(() => {
    if (started && workoutView === "focus" && expandedExercise === null && planExercises?.length) setExpandedExercise(0);
  }, [started, workoutView, expandedExercise, planExercises?.length]);

  return (
    // En sesión ocupa la pantalla entera (el shell no pone barra ni pestañas): la barra
    // propia cubre la zona segura superior y el pie fijo, la del indicador de inicio.
    <div className={`w-full min-w-0 ${started ? "flex min-h-[calc(100dvh-0.5rem)] flex-col" : ""}`}>
      <RecordCelebration moment={recordMoment} onDone={closeRecordMoment} />
      {!started && onCancel && (
        // Vista previa de una sesión abierta desde la rutina semanal: siempre hay vuelta.
        <button
          type="button"
          onClick={() => { void hapticTap(); onCancel(); }}
          className="mb-2 inline-flex min-h-11 items-center gap-0.5 pl-0.5 pr-2 text-foreground transition-opacity active:opacity-60 [touch-action:manipulation]"
        >
          <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden="true" />
          <span className="type-body">Rutina semanal</span>
        </button>
      )}
      {started && !workoutCompleted && (
        // -mt-2 compensa el pt-2 del contenedor de sección: la barra nace pegada al borde superior.
        <div className="sticky top-0 z-30 -mt-2">
          <NavBar
            title={activePlan?.routine_name?.trim() || trainingTitle || "Entrenamiento"}
            subtitle={<span className="tabular-nums">{sessionStartedAt !== null && <><span aria-label="Tiempo de sesión">{formatElapsed(nowTick - sessionStartedAt)}</span> · </>}{completedSets} de {totalSets} series</span>}
            leading={
              <button
                type="button"
                onClick={() => { void hapticTap(); void saveAndExit(); }}
                disabled={saving}
                className="inline-flex h-11 items-center gap-0.5 pl-0.5 pr-2 text-foreground transition-opacity active:opacity-60 disabled:opacity-40 [touch-action:manipulation]"
              >
                <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden="true" />
                <span className="type-body">Salir</span>
              </button>
            }
            trailing={
              <>
                {/* Opciones claras: cambiar de vista y de detalle; descartar, al final y en rojo. */}
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
                        <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden="true" />
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setWorkoutView(userId, workoutView === "list" ? "focus" : "list")}>
                      {workoutView === "list" ? "Ver ejercicio a ejercicio" : "Ver toda la sesión"}
                    </DropdownMenuItem>
                    <DropdownMenuCheckboxItem checked={advanced} onCheckedChange={(on) => setWorkoutAdvanced(userId, on === true)}>
                      Más opciones por serie
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDiscardOpen(true)}>
                      Descartar entrenamiento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {saveStatus === "error" && (
                  <span role="status" className="flex h-11 w-11 items-center justify-center text-destructive">
                    <CloudOff className="h-5 w-5" aria-hidden="true" />
                    <span className="sr-only">Error al guardar</span>
                  </span>
                )}
                {(saveStatus === "pending" || saveStatus === "saving") && (
                  <span className="flex h-11 w-11 items-center justify-center">
                    <Spinner size="sm" aria-live="polite" label={saveStatus === "pending" ? "Pendiente de guardar" : "Guardando…"} />
                  </span>
                )}
                {saveStatus === "saved" && savedAt && <span role="status" className="sr-only">Guardado</span>}
              </>
            }
          />
          <Progress
            value={progressPercent}
            aria-valuenow={Math.round(progressPercent)}
            aria-label="Progreso de la sesión"
            className="absolute inset-x-0 bottom-0 h-0.5 rounded-none bg-transparent"
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

      {/* Selector de día: la semana entera siempre a un toque. Se oculta durante la
          sesión para no cambiar de día con series a medias. */}
      {!started && dayPlans.length > 0 && (
        <div
          role="tablist"
          aria-label="Elige el día de la semana"
          className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-card p-1.5"
        >
          {DAYS_ORDER.map((day) => {
            const active = day === selectedDay;
            const isToday = day === DAYS_ORDER[todayIndex];
            const hasWork = hasSessionIn(dayPlans, day);
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${day}${hasWork ? "" : " · sin sesión"}${isToday ? " · hoy" : ""}`}
                disabled={saving || !hasWork}
                onClick={() => {
                  if (day === selectedDay) return;
                  void hapticSelection();
                  setLogsReady(false);
                  setCompletionReady(false);
                  setSelectedDay(day);
                }}
                className={`flex h-[50px] min-w-10 flex-1 shrink-0 flex-col items-center justify-center gap-1 rounded-xl type-footnote transition-colors duration-150 disabled:opacity-40 ${
                  active
                    ? "bg-primary font-semibold text-primary-foreground"
                    : !hasWork
                      ? "cursor-default text-muted-foreground/40"
                      : isToday
                        ? "font-semibold text-primary active:bg-accent"
                        : "text-muted-foreground active:bg-accent"
                }`}
              >
                <span>{day.slice(0, 3)}</span>
                <span
                  aria-hidden="true"
                  className={`h-[5px] w-[5px] rounded-full ${hasWork ? (active ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"}`}
                />
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
                  {sessionCover && <div aria-hidden="true" className="relative mb-4 h-48 overflow-hidden rounded-[28px] bg-card">
                    <img key={sessionCover} src={sessionCover} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_30%] animate-in fade-in duration-500" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  </div>}
                  <h2 className="truncate font-rounded text-[32px] font-bold leading-tight tracking-tight">{name}</h2>
                  {rest.length > 0 && <p className="mt-0.5 truncate type-subhead text-muted-foreground">{rest.join(" · ")}</p>}
                </>
              );
            })()}
            {!!currentPlan?.exercises?.length && (
              <p className="mt-1 type-footnote tabular-nums text-muted-foreground">
                {currentPlan.exercises.length} ejercicios · {totalSets} series
              </p>
            )}
            {selectedDay !== today && <p className="mt-1 type-footnote text-muted-foreground">Se registra hoy · {completedDateLabel}</p>}

            {/* Antes de empezar, la única protagonista es la acción principal. */}
            <div className={completedSets > 0 ? "mt-4 flex items-center gap-3" : "sr-only"}>
              <Progress value={progressPercent} aria-valuenow={Math.round(progressPercent)} aria-label="Progreso de la sesión" className="flex-1" />
              <p role="status" className="shrink-0 type-footnote tabular-nums text-muted-foreground">
                {completedSets} de {totalSets} series
              </p>
            </div>

            {!started && (
              currentPlan?.exercises?.length ? (
                <Button
                  onClick={() => { void hapticTap(); startWorkout(0); }}
                  disabled={!logsReady || loadError}
                  size="lg"
                  className="mt-6 h-14 w-full gap-2 rounded-full text-[17px] font-semibold active:scale-[0.98]"
                >
                  <Play className="h-5 w-5 fill-current" aria-hidden />
                  Empezar entrenamiento
                </Button>
              ) : (
                <p className="mt-4 type-subhead text-muted-foreground">
                  Este día no tiene ejercicios asignados todavía.
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
                description="No hemos cambiado ni reemplazado tus registros. Comprueba la conexión y vuelve a intentarlo."
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

          {/* Modo foco: visor del ejercicio activo + carrusel de toda la sesión */}
          {focusMode && !workoutCompleted && completionReady && !loadError && expandedExercise !== null && (() => {
            const active = currentPlan.exercises?.[expandedExercise];
            if (!active) return null;
            const meta = exerciseMetadata.byId[active.exercise_id] || exerciseMetadata.byName[active.name];
            const img = meta?.image_url || active.image_url;
            const vid = active.video_url || meta?.video_url;
            // El movimiento en bucle corto (como un GIF) con la foto de portada; con «reducir
            // movimiento», solo la foto. Igual que `LoopingVideo` en la app.
            const loop = vid && isDirectFile(vid) && !prefersReducedMotion ? vid : null;
            return (
              <div className="space-y-2">
                {/* Carrusel arriba y el movimiento en grande debajo: se ve en qué ejercicio estás. */}
                <div role="tablist" aria-label="Ejercicios de la sesión" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
                  {(currentPlan.exercises || []).map((item, idx) => {
                    const m = exerciseMetadata.byId[item.exercise_id] || exerciseMetadata.byName[item.name];
                    const itemSets = exerciseLogs[item.name] || [];
                    const done = itemSets.length > 0 && itemSets.every((set) => set.done);
                    const isActive = idx === expandedExercise;
                    return (
                      <button
                        key={`${item.name}-${idx}`}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-label={`${idx + 1}. ${swaps[item.name] || item.name}${done ? " · hecho" : ""}`}
                        onClick={() => { setExpandedExercise(idx); void hapticTap(); }}
                        className={`shrink-0 rounded-[14px] p-0.5 transition-opacity duration-150 active:opacity-40 ${isActive ? "ring-2 ring-inset ring-primary" : "opacity-60"}`}
                      >
                        <ExerciseThumb image={m?.image_url || item.image_url} video={item.video_url || m?.video_url} name={item.name} pattern={m?.movement_pattern} stimulus={m?.stimulus_type} load={m?.load_level} completed={done} />
                      </button>
                    );
                  })}
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
                    const total = currentPlan.exercises?.length || 0;
                    const swipe = info.offset.x + info.velocity.x * 0.2;
                    if (swipe < -60 && expandedExercise < total - 1) { setExpandedExercise(expandedExercise + 1); void hapticTap(); }
                    else if (swipe > 60 && expandedExercise > 0) { setExpandedExercise(expandedExercise - 1); void hapticTap(); }
                  }}
                  style={{ touchAction: "pan-y" }}
                  aria-label="Desliza para cambiar de ejercicio"
                  className={`relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-card md:cursor-grab md:active:cursor-grabbing ${img || loop ? "aspect-[4/3] max-h-[26dvh] [@media(max-height:700px)]:max-h-[22dvh] md:max-h-[40dvh]" : "h-12"}`}>
                  {loop ? (
                    <video key={loop} ref={startLoop} src={loop} poster={img || undefined} autoPlay muted loop playsInline preload="auto" disablePictureInPicture aria-label={active.name} draggable={false} className="pointer-events-none h-full w-full object-cover" />
                  ) : img ? (
                    <img src={img} alt={active.name} draggable={false} decoding="async" fetchPriority="high" loading="eager" className="h-full w-full object-cover" />
                  ) : (
                    <Dumbbell className="h-6 w-6 text-muted-foreground/60" strokeWidth={1.75} aria-hidden="true" />
                  )}
                  {vid && (
                    <button
                      type="button"
                      aria-label={`Ver vídeo de técnica de ${active.name}`}
                      onClick={() => { void hapticTap(); setTechnique({ name: active.name, image: img, video: vid, series: active.series != null ? String(active.series) : undefined, reps: active.reps != null ? String(active.reps) : undefined, rest: active.rest, category: active.muscle_group || meta?.muscle_group, type: active.exercise_type || meta?.exercise_type, pattern: meta?.movement_pattern, stimulus: meta?.stimulus_type, load: meta?.load_level }); }}
                      className={`material absolute flex items-center justify-center rounded-full text-foreground transition-opacity active:opacity-60 ${loop ? "bottom-2 right-2 h-11 w-11" : "inset-0 m-auto h-14 w-14"}`}
                    >
                      <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                    </button>
                  )}
                </motion.div>
              </div>
            );
          })()}

          {/* Exercise list: lista agrupada en el resumen; en sesión, solo el ejercicio en foco */}
          {!workoutCompleted && completionReady && !loadError && (
          <section className={started ? "" : "pb-28 md:pb-0"}>
          {!focusMode && (currentPlan.exercises?.length ?? 0) > 0 && (
            <h3 className="px-4 pb-1.5 type-group-header">Ejercicios</h3>
          )}
          <div className={started && !focusMode ? "space-y-3" : focusMode ? "" : "overflow-hidden rounded-2xl bg-card"}>
          {(currentPlan.exercises || []).map((ex, i) => {
            const isExpanded = workoutView === "list" ? openExercises.includes(i) : expandedExercise === i;
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
            const exerciseVideo = ex.video_url || metadata?.video_url;
            const exerciseCategory = ex.muscle_group || metadata?.muscle_group;
            const exerciseType = ex.exercise_type || metadata?.exercise_type;
            // Patrón, estímulo y carga: con los tres se dibuja la huella del ejercicio.
            const exercisePattern = ("movement_pattern" in ex && typeof ex.movement_pattern === "string"
              ? ex.movement_pattern
              : metadata?.movement_pattern) ?? null;
            const exerciseStimulus = metadata?.stimulus_type ?? null;
            const exerciseLoad = metadata?.load_level ?? null;
            const trackingConfig = getExerciseTrackingConfig({
              name: ex.name,
              skill_tag: metadata?.skill_tag ?? undefined,
              movement_pattern: "movement_pattern" in ex && typeof ex.movement_pattern === "string"
                ? ex.movement_pattern
                : metadata?.movement_pattern ?? undefined,
              exercise_type: exerciseType ?? undefined,
              tracking_mode: ex.tracking_mode ?? metadata?.tracking_mode ?? undefined,
            });
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
            const supersetChainLabel = supersetChain
              .map((chainIndex) => swaps[exerciseNames[chainIndex]] || exerciseNames[chainIndex])
              .join(" → ");

            return (
              <div key={`${selectedDay}-${i}`} className={started && !focusMode ? "overflow-hidden rounded-lg bg-card" : ""}>
                {/* Exercise header: fila de lista en el resumen, título del ejercicio en foco */}
                <Button
                  variant="ghost"
                  aria-expanded={started ? isExpanded : undefined}
                  onClick={() => {
                    if (!started) {
                      void hapticTap();
                      startWorkout(i);
                    } else if (workoutView === "list") {
                      setOpenExercises((open) => open.includes(i) ? open.filter((index) => index !== i) : [...open, i]);
                    } else {
                      setExpandedExercise(i);
                    }
                  }}
                  className={focused
                    ? "flex h-auto w-full cursor-default items-start whitespace-normal p-0 text-left"
                    : "flex h-auto w-full items-center gap-3 whitespace-normal p-0 pl-3 text-left transition-colors duration-150 active:bg-accent has-[[role=button]:active]:bg-transparent"}
                >
                  {/* Miniatura única de ejercicio (misma que en el resto de la app); en foco ya está el visor */}
                  {!focused && <ExerciseThumb image={metadata?.image_url || ex.image_url} video={exerciseVideo} name={ex.name} pattern={exercisePattern} stimulus={exerciseStimulus} load={exerciseLoad} completed={allDone} />}
                  <div className={focused ? "flex min-w-0 flex-1 items-start" : `flex min-h-[68px] min-w-0 flex-1 items-center py-2 pr-1 ${i > 0 ? "sep-t" : ""}`}>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={focused ? "type-title2" : `line-clamp-2 type-headline ${allDone ? "text-muted-foreground" : ""}`}>
                        {swaps[ex.name] || ex.name}
                      </span>
                      {isInSuperset && (
                        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 type-caption1 font-medium text-primary">
                          Superserie {supersetPosition}/{supersetChain.length}
                        </span>
                      )}
                    </div>
                    {swaps[ex.name] && <div className="truncate type-footnote text-muted-foreground">En lugar de {ex.name}</div>}
                    <div className={`mt-0.5 tabular-nums text-muted-foreground ${focused ? "type-subhead" : "type-footnote"}`}>
                      {ex.series} series · {ex.reps} reps · {ex.rest}
                    </div>
                  </div>
                  {/* Antes de empezar, la lista solo informa: cambiar y ficha viven dentro de la sesión. */}
                  <div className={`${started ? "flex" : "hidden"} shrink-0 items-center ${focused ? "-mr-2.5 -mt-2" : ""}`}>
                    {allDone && !focused && (
                      <span className="flex h-11 w-9 items-center justify-center text-success">
                        <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                      </span>
                    )}
                    {!allDone && (
                      // El disparador de ExerciseSwap mide 32 px: aquí se amplía a 44 y se le da estado pulsado.
                      <span className="flex h-11 w-11 items-center justify-center [&>[role=button]:active]:opacity-60 [&>[role=button]]:h-11 [&>[role=button]]:w-11">
                      <ExerciseSwap
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
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver ficha de técnica de ${ex.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void hapticTap();
                        setTechnique({
                          name: ex.name,
                          image: metadata?.image_url || ex.image_url,
                          video: exerciseVideo,
                          series: ex.series != null ? String(ex.series) : undefined,
                          reps: ex.reps != null ? String(ex.reps) : undefined,
                          rest: ex.rest,
                          category: exerciseCategory,
                          type: exerciseType,
                          pattern: exercisePattern,
                          stimulus: exerciseStimulus,
                          load: exerciseLoad,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                          setTechnique({
                            name: ex.name,
                            image: metadata?.image_url || ex.image_url,
                            video: exerciseVideo,
                            series: ex.series != null ? String(ex.series) : undefined,
                            reps: ex.reps != null ? String(ex.reps) : undefined,
                            rest: ex.rest,
                            category: exerciseCategory,
                            type: exerciseType,
                            pattern: exercisePattern,
                            stimulus: exerciseStimulus,
                            load: exerciseLoad,
                          });
                        }
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-opacity active:opacity-60"
                    >
                      <Info className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>
                  </div>
                </Button>

                {/* Expanded set tracking */}
                <AnimatePresence initial={false}>
                  {started && isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-2 pb-3 pt-2">
                        {/* Column headers */}
                        <div className={`${SET_GRID} pb-1.5 pl-3 pr-2 type-caption1 text-muted-foreground`}>
                          <span className="whitespace-nowrap">Serie</span>
                          <span className="text-center">Previa</span>
                          <span className="truncate text-center">
                            {trackingConfig.fixedBodyweight ? "PC" : trackingConfig.weightLabel === "Peso corporal" ? "Lastre" : trackingConfig.weightLabel}
                          </span>
                          <span className="truncate text-center">
                            {trackingConfig.valueLabel}
                          </span>
                          <span className="flex items-center justify-center">
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                          </span>
                        </div>

                        <div className="overflow-hidden rounded-2xl bg-card">
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
                          const livePR = livePRs[`${ex.name}#${si}`];
                          // Serie hecha: la fila se atenúa y el círculo se rellena con el tinte.
                          // La de calentamiento va atenuada y nunca con el color de serie hecha.
                          const dim = set.done ? "opacity-60" : "";
                          const checkClass = set.done
                            ? isWarmup
                              ? "border-muted-foreground bg-muted-foreground text-background"
                              : "border-success bg-success text-success-foreground"
                            : inputError
                              ? "border-destructive text-destructive"
                              : "border-muted-foreground/40 text-muted-foreground/40";
                          return (
                          <div key={si} aria-current={si === firstPendingIndex ? "step" : undefined} className={`pl-3 transition-colors duration-300 ${si === firstPendingIndex ? "rounded-lg ring-1 ring-inset ring-primary/50 bg-primary/5" : set.done && !isWarmup ? "rounded-lg bg-success/10" : ""}`}>
                            <div className={`py-2 pr-2 ${si > 0 ? "sep-t" : ""}`}>
                            {/* Segmento principal de la serie */}
                            <div className={SET_GRID}>
                              {/* Set number */}
                              <span className={`text-center font-rounded type-headline tabular-nums ${si === firstPendingIndex ? "text-primary" : "text-muted-foreground"} ${dim}`}>
                                {isWarmup ? <Flame className="mx-auto h-4 w-4" aria-hidden="true" /> : si + 1}
                              </span>
                              <span className={`truncate text-center type-caption1 tabular-nums text-muted-foreground ${dim}`}>
                                {prevSets?.[si]?.done ? (trackingConfig.fixedBodyweight ? `${prevSets[si].reps}${trackingConfig.valueSuffix ?? ""}` : `${prevSets[si].weight || (trackingConfig.kind === "weighted_bodyweight" ? "PC" : "—")}×${prevSets[si].reps}${trackingConfig.valueSuffix ?? ""}`) : "—"}
                              </span>

                              {/* Weight input */}
                              <div className={`min-w-0 ${dim}`}>
                                {trackingConfig.fixedBodyweight ? (
                                  <div aria-label="Peso corporal" className="flex h-11 w-full items-center justify-center rounded-[10px] bg-secondary type-body text-muted-foreground">PC</div>
                                ) : (
                                <>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  enterKeyHint="next"
                                  autoComplete="off"
                                  value={set.weight}
                                  onChange={(e) => updateSet(ex.name, si, "weight", e.target.value)}
                                  placeholder={String(progression?.weight || prevSets?.[si]?.weight || ex.weight || trackingConfig.weightPlaceholder || "kg")}
                                  onFocus={focusSetField}
                                  aria-label={`Peso de la serie ${si + 1} de ${ex.name}`}
                                  aria-invalid={Boolean(inputError && mainError && set.weight.trim())}
                                  className={`${NUMBER_FIELD} ${si === firstPendingIndex ? CURRENT_FIGURE : ""} ${isWarmup || (!set.done && prevSets?.[si]?.done && set.weight === prevSets[si].weight) ? "text-muted-foreground" : ""}`}
                                />
                                {si === firstPendingIndex && !set.done && (
                                  <div className="mt-2">
                                    <WeightAdjuster
                                      value={set.weight}
                                      onChange={(newWeight) => updateSet(ex.name, si, "weight", newWeight)}
                                      disabled={false}
                                    />
                                  </div>
                                )}
                                </>
                                )}
                              </div>

                              {/* Reps input */}
                              <div className={`min-w-0 ${dim}`}>
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
                                  className={`${NUMBER_FIELD} ${si === firstPendingIndex ? CURRENT_FIGURE : ""} ${isWarmup || repsMissing || (!set.done && prevSets?.[si]?.done && set.reps === prevSets[si].reps) ? "text-muted-foreground" : ""}`}
                                />
                              </div>

                              {/* Done toggle: marca la serie entera (bajadas incluidas) y arranca el descanso */}
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => toggleSetDone(ex.name, si, restSec, trackingConfig.fixedBodyweight ? undefined : String(progression?.weight || prevSets?.[si]?.weight || ex.weight || ""))}
                                aria-label={`${set.done ? "Desmarcar" : "Marcar"} serie ${si + 1} de ${ex.name}`}
                                className="flex h-11 w-11 items-center justify-center justify-self-center rounded-full p-0 transition-opacity duration-150 active:opacity-60 [touch-action:manipulation]"
                              >
                                {/* Al marcar, el círculo «salta» con un muelle (como Hevy/Fitness). */}
                                <motion.span
                                  key={set.done ? "done" : "pending"}
                                  initial={set.done && !prefersReducedMotion ? { scale: 0.6 } : { opacity: 0.7 }}
                                  animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                                  transition={prefersReducedMotion ? { duration: 0.15 } : { type: "spring", stiffness: 520, damping: 17 }}
                                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors duration-150 ${checkClass}`}
                                >
                                  <Check className="h-[18px] w-[18px]" strokeWidth={3} aria-hidden="true" />
                                </motion.span>
                              </Button>
                            </div>

                            {livePR && (
                              <motion.div
                                initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.7, opacity: 0 }}
                                animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                                transition={prefersReducedMotion ? { duration: 0.2 } : { type: "spring", stiffness: 420, damping: 14 }}
                                className="mt-2 flex w-fit origin-left items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 type-footnote font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30 shadow-[0_0_10px_rgba(234,179,8,0.15)]">
                                <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                                <span>Récord personal · {livePR}</span>
                              </motion.div>
                            )}

                            {/* Dropset: bajadas dentro de la misma serie, sin descanso entre ellas */}
                              {drops.map((drop, di) => {
                                const dropError = !set.done ? getWorkoutSetDropInputError(drop) : null;
                                return (
                                <div key={di} className={`mt-3 ${SET_GRID}`}>
                                  <span className={`flex items-center justify-center text-muted-foreground ${dim}`}>
                                    <TrendingDown className="h-4 w-4" aria-hidden="true" />
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
                                    className={`${NUMBER_FIELD} ${dim}`}
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
                                    className={`${NUMBER_FIELD} ${dim}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeDrop(ex.name, si, di)}
                                    aria-label={`Quitar la bajada ${di + 1} de la serie ${si + 1} de ${ex.name}`}
                                    className="flex h-11 w-11 items-center justify-center justify-self-center rounded-full text-muted-foreground transition-opacity duration-150 active:opacity-60"
                                  >
                                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-secondary">
                                      <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                                    </span>
                                  </button>
                                </div>
                                );
                              })}
                              {si === firstPendingIndex && advanced && (
                              <div className="mt-2 flex gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => addDrop(ex.name, si)}
                                className={`flex-1 px-2 ${CAPSULE_HIT}`}
                              >
                                <Plus aria-hidden="true" />
                                Añadir bajada
                              </Button>
                              {/* Calentamiento: se guarda y se marca con ✓, pero no cuenta en tus métricas */}
                              <Button
                                type="button"
                                variant={isWarmup ? "tinted" : "secondary"}
                                size="sm"
                                aria-pressed={isWarmup}
                                aria-label={`${isWarmup ? "Quitar" : "Marcar"} la serie ${si + 1} de ${ex.name} como calentamiento`}
                                onClick={() => toggleWarmup(ex.name, si)}
                                className={`flex-1 px-2 ${CAPSULE_HIT}`}
                              >
                                <Flame fill={isWarmup ? "currentColor" : "none"} aria-hidden="true" />
                                Calentamiento
                              </Button>
                              </div>
                              )}

                            {drops.length > 0 && (
                              <p className="mt-2 type-footnote tabular-nums text-muted-foreground">
                                {formatWorkoutSetSummary(set)}
                              </p>
                            )}
                            {isWarmup && !set.done && (
                              <p className="mt-2 type-footnote text-muted-foreground">
                                Calentamiento: no cuenta en volumen, récords ni series completadas.
                              </p>
                            )}
                            {inputError && <p className="mt-2 type-footnote text-destructive">{inputError}</p>}
                            </div>
                          </div>
                          );
                        })}
                        </div>
                        <Button type="button" variant="plain" className="mt-2 min-h-11 w-full" onClick={() => {
                          const last = sets[sets.length - 1];
                          setExerciseLogs((logs) => ({ ...logs, [ex.name]: [...(logs[ex.name] || []), {
                            weight: last?.weight ?? ex.weight ?? "", reps: last?.reps ?? ex.reps, done: false,
                          }] }));
                          void hapticTap();
                        }}><Plus className="h-4 w-4" aria-hidden="true" />Añadir serie</Button>
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
              <Button type="button" variant="plain" className="mt-3 min-h-11 w-full" onClick={() => { void hapticTap(); setExtraPickerOpen(true); }}>
                <Plus className="h-4 w-4" aria-hidden="true" />Añadir ejercicio a esta sesión
              </Button>
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

          {/* Finish workout. Pie fijo: descanso, estado de guardado y la única acción principal, sobre el indicador de inicio */}
          {!workoutCompleted && completionReady && ((started && !loadError) || restTimer !== null) && <div className="app-chrome sticky bottom-0 z-20 -mx-4 mt-auto border-t-[0.5px] px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3">
            <AnimatePresence initial={false}>
              {restTimer !== null && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={prefersReducedMotion ? { duration: 0.2 } : { type: "spring", stiffness: 380, damping: 36 }}
                  className="overflow-hidden"
                >
                  <div role="timer" aria-label="Descanso entre series" className="pb-3">
                    <div className="flex items-center">
                      <div className="min-w-0 flex-1">
                        <p className="sr-only">Descanso</p>
                        <p className="font-rounded text-[34px] font-bold leading-[44px] tabular-nums">
                          {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, "0")}
                        </p>
                      </div>
                      <button type="button" aria-label="Restar 30 segundos" onClick={() => { void hapticSelection(); adjustRest(-30); }} className="h-11 min-w-11 px-2 type-body tabular-nums text-foreground transition-opacity active:opacity-60 [touch-action:manipulation]">−30</button>
                      <button type="button" aria-label="Sumar 30 segundos" onClick={() => { void hapticSelection(); adjustRest(30); }} className="h-11 min-w-11 px-2 type-body tabular-nums text-foreground transition-opacity active:opacity-60 [touch-action:manipulation]">+30</button>
                      <button type="button" aria-label="Omitir descanso" onClick={() => { void hapticTap(); setRestTimer(null); }} className="-mr-2 h-11 rounded-lg bg-primary/10 px-3 type-body font-semibold text-primary transition-opacity active:opacity-60 [touch-action:manipulation]">
                        Omitir
                      </button>
                    </div>
                    <div aria-hidden="true" className="mt-2 h-[3px] overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (restTimer / Math.max(restTarget, 1)) * 100)}%`, transition: "width 1s linear" }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {started && !loadError && <>
            <p role="status" aria-live="polite" className={`mb-2 text-center type-footnote [.keyboard-open_&]:hidden ${saveError ? "text-destructive" : "sr-only"}`}>
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
            {/* Psicología del color: mientras quedan series, la acción dorada es marcar la serie;
                «Terminar» se vuelve dorado solo con la sesión completa (la recompensa). */}
            <Button
              onClick={() => { void hapticTap(); void finishWorkout(); }}
              disabled={saving || completedSets === 0}
              variant={allSetsDone ? "default" : "secondary"}
              className="w-full [.keyboard-open_&]:hidden"
              size="lg"
            >
              {saving ? <><Spinner size="sm" className={`${allSetsDone ? "text-primary-foreground" : "text-foreground"} [&>svg]:!size-full`} label="Guardando" /> Guardando…</> : "Terminar entrenamiento"}
            </Button>
            </>}
          </div>}
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
              Te quedan {(totalSets - completedSets)} de {totalSets} series. Puedes terminarlo igualmente o seguir entrenando.
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
