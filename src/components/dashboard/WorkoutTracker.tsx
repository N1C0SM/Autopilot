import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, ChevronDown, ChevronUp, Flame, Clock, ArrowLeft,
  Timer, TrendingUp, TrendingDown, Plus, X, Video, Save, Trophy, Info,
  RefreshCw, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DayPlan } from "@/types/training";
import RPEDialog from "./RPEDialog";
import { ExerciseThumb } from "@/components/ExerciseMedia";
import ExerciseFocus from "@/components/ExerciseFocus";
import { useExerciseMetadata } from "@/hooks/useExerciseMetadata";
import { getWorkoutRestSeconds } from "@/lib/workoutPreferences";
import { applyProgressionToPendingSets, getProgressionSuggestion } from "@/lib/workoutProgression";
import { parsePositiveWeight } from "@/lib/weight";
import { WorkoutStoryShare } from "./WorkoutStoryShare";
import { WorkoutStudyCards } from "./WorkoutStudyCards";
import { ExerciseSwap } from "./ExerciseSwap";
import { formatTrainingTitle } from "@/lib/trainingDisplay";
import { hapticTap } from "@/lib/native";
import {
  addWorkoutSetDrop,
  createWorkoutSetLogs,
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
} from "@/lib/workoutSet";
import { getExerciseTrackingConfig } from "@/lib/exerciseTrackingConfig";
import {
  getNextSupersetWork,
  getSupersetChain,
  toggleSupersetLink,
  type SupersetLinks,
} from "@/lib/workoutSuperset";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { addExerciseLoad } from "@/lib/muscleMapping";

interface Props {
  userId: string;
  dayPlans: DayPlan[];
  autoStart?: boolean;
  onAutoStartConsumed?: () => void;
  onExit?: () => void;
  onCancel?: () => void;
  onSessionModeChange?: (active: boolean) => void;
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const MUSCLE_INTENSITY = {
  low: { label: "Bajo", range: "1–2 series", fill: "color-mix(in srgb, hsl(var(--primary)) 65%, hsl(var(--muted-foreground)))" },
  medium: { label: "Medio", range: "3–5 series", fill: "hsl(var(--primary))" },
  high: { label: "Alto", range: "6+ series", fill: "hsl(var(--accent))" },
};

const getMuscleIntensity = (sets: number) => sets >= 6
  ? MUSCLE_INTENSITY.high
  : sets >= 3
    ? MUSCLE_INTENSITY.medium
    : MUSCLE_INTENSITY.low;

const WorkoutTracker = ({ userId, dayPlans, autoStart = false, onAutoStartConsumed, onExit, onCancel, onSessionModeChange }: Props) => {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const [selectedDay, setSelectedDay] = useState<string>(DAYS_ORDER[todayIndex]);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, WorkoutSetLog[]>>({});
  const [previousLogs, setPreviousLogs] = useState<Record<string, WorkoutSetLog[]>>({});
  const [previousSessionRpe, setPreviousSessionRpe] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
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
  const [livePRs, setLivePRs] = useState<Record<string, string>>({});
  // Superseries: solo en memoria durante la sesión (no se guardan ni se envían).
  const [supersetLinks, setSupersetLinks] = useState<SupersetLinks>({});
  const restChainRef = useRef<number[] | null>(null);
  const restWasRunningRef = useRef(false);
  const exerciseLogsRef = useRef(exerciseLogs);
  const exerciseMetadata = useExerciseMetadata(dayPlans);

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const selectedDate = (() => {
    const monday = new Date();
    const day = monday.getDay();
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(12, 0, 0, 0);
    const date = new Date(monday);
    date.setDate(monday.getDate() + DAYS_ORDER.indexOf(selectedDay));
    return formatLocalDate(date);
  })();
  const currentPlan = dayPlans.find((p) => p.day === selectedDay);
  const trainingTitle = formatTrainingTitle(currentPlan?.routine_name, currentPlan?.muscle_focus);
  const currentPlanSignature = JSON.stringify(currentPlan || null);
  const planExercises = currentPlan?.exercises;
  const exerciseNames = useMemo(() => (planExercises ?? []).map((exercise) => exercise.name), [planExercises]);
  const startWorkout = (exerciseIndex = 0) => {
    if (!logsReady || loadError) return;
    setStarted(true);
    setExpandedExercise(exerciseIndex);
    onSessionModeChange?.(true);
  };

  // Start with a clean overview; the first exercise opens when the user starts.
  useEffect(() => {
    setStarted(false);
    setExpandedExercise(null);
    // Las superseries son de la sesión: al cambiar de día no se arrastran.
    setSupersetLinks({});
    restChainRef.current = null;
  }, [selectedDay]);

  // Load existing logs + previous session
  useEffect(() => {
    let active = true;
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
        const base = currentPlan?.type === "gimnasio" && currentPlan.exercises ? createWorkoutSetLogs(currentPlan.exercises, prev) : {};
        Object.keys(logs).forEach((k) => { if (!Array.isArray(logs[k]) || logs[k].length === 0) delete logs[k]; });
        setExerciseLogs({ ...base, ...logs });
      } else if (currentPlan?.type === "gimnasio" && currentPlan.exercises) {
        setExerciseLogs(createWorkoutSetLogs(currentPlan.exercises, prev));
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
      setLoadError(false);
      setLogsReady(true);
    };
    void loadLogs().catch(() => {
      if (!active) return;
      setLoadError(true);
      setCompletionReady(true);
      toast.error("No se pudo cargar tu sesión e historial. No se sobrescribirá ningún registro; comprueba la conexión e inténtalo de nuevo.");
    });
    return () => {
      active = false;
    };
  }, [selectedDay, selectedDate, userId, currentPlanSignature, reloadLogs]);

  useEffect(() => {
    if (!autoStart || !logsReady) return;
    if (currentPlan?.type === "gimnasio" && !workoutCompleted && !loadError) {
      setStarted(true);
      setExpandedExercise(0);
      onSessionModeChange?.(true);
    }
    onAutoStartConsumed?.();
  }, [autoStart, currentPlan?.type, loadError, logsReady, onAutoStartConsumed, onSessionModeChange, workoutCompleted]);

  // Rest timer countdown (sin avisos de texto: vibración al terminar)
  useEffect(() => {
    if (restTimer === null || restTimer <= 0) return;
    const interval = setInterval(() => {
      setRestTimer((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          try { navigator.vibrate?.([200, 100, 200]); } catch { /* noop */ }
          void hapticTap();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restTimer !== null]);

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

  const adjustRest = (delta: number) => {
    setRestTimer((prev) => {
      if (prev === null) return prev;
      const next = Math.max(5, prev + delta);
      if (next > restTarget) setRestTarget(next);
      return next;
    });
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

  const applyProgression = (exerciseName: string, progression: NonNullable<ReturnType<typeof getProgressionSuggestion>>) => {
    setExerciseLogs((current) => ({
      ...current,
      [exerciseName]: applyProgressionToPendingSets(current[exerciseName] || [], progression),
    }));
    void hapticTap();
    toast.success("Propuesta aplicada a las series pendientes. Puedes ajustarla antes de empezar.");
  };

  const toggleSetDone = (exerciseName: string, setIndex: number, restSeconds?: number) => {
    const set = exerciseLogs[exerciseName]?.[setIndex];
    const wasDone = set?.done;
    if (!set) return;
    if (!wasDone) {
      const inputError = getWorkoutSetInputError(set) ?? getWorkoutSetDropsInputError(set);
      if (inputError) {
        toast.error(inputError);
        return;
      }
    }
    updateSet(exerciseName, setIndex, "done", !wasDone);

    const exerciseIndex = currentPlan?.exercises?.findIndex((exercise) => exercise.name === exerciseName) ?? -1;
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
      void hapticTap();
      if (continuesSuperset === null) {
        const configuredRest = getWorkoutRestSeconds(userId);
        const effectiveRest = configuredRest || restSeconds || 60;
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
        try { navigator.vibrate?.([30, 60, 30]); } catch { /* noop */ }
      }
    } else {
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
      if (chain.length === 1 && setIndex === sets.length - 1 && currentPlan?.exercises?.[exerciseIndex + 1]) {
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

    const write = saveQueueRef.current.then(async () => {
      if (rows.length === 0) return;
      const { error } = await supabase.from("workout_logs").upsert(rows, {
        onConflict: "user_id,day_label,logged_at,exercise_name",
      });
      if (error) throw error;
    });
    saveQueueRef.current = write.catch(() => undefined);
    await write;
  };

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
    if (!logsReady || workoutCompleted || Object.keys(exerciseLogs).length === 0) return;
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
  }, [exerciseLogs, logsReady, selectedDay, selectedDate, workoutCompleted]);

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
      toast.success(`🏆 ¡Nuevo PR en ${prsToInsert.length} ejercicio${prsToInsert.length > 1 ? "s" : ""}!`, { duration: 4000 });
    }
  };

  const finishWorkout = async () => {
    const allDone = Object.values(exerciseLogs).flat().every((s) => s.done) && Object.keys(exerciseLogs).length > 0;
    if (allDone) {
      await handleRPEConfirm(null);
      return;
    }

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
      onCancel?.();
      toast.success("Entrenamiento terminado. Tu progreso ya está guardado.");
    } catch {
      setSaveError(true);
      setSaveStatus("error");
      toast.error("No se pudo guardar el entrenamiento. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
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
      toast.error("No se pudo guardar el entrenamiento. Comprueba la conexión e inténtalo de nuevo.");
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
      setWorkoutCompleted(true);
      setShowCompletionSummary(true);
      try {
        await detectAndSavePRs();
      } catch {
        toast.error("El entrenamiento se ha guardado, pero no se pudieron comprobar tus récords personales.");
      }
    } catch {
      setSaveError(true);
      setSaveStatus("error");
      toast.error("No se pudo guardar el entrenamiento. Comprueba tu conexión e inténtalo de nuevo.");
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
  const muscleSetCounts = (currentPlan?.exercises || []).reduce<Record<string, number>>((counts, exercise) => {
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
  const completedExercises = currentPlan?.exercises?.filter((exercise) => {
    const sets = exerciseLogs[exercise.name] || [];
    return sets.length > 0 && sets.every((set) => set.done);
  }).length || 0;
  const sessionMessage = personalRecords.length > 0
    ? "Hoy has superado tu mejor marca. Esto sí es progreso."
    : totalVolume > 0
    ? "Trabajo hecho. La próxima sesión tendrás una referencia clara para progresar."
    : "Trabajo hecho. La próxima sesión quedará registrada para que puedas progresar.";

  const completedDateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
  const renderStudyCards = (inDialog: boolean) => {
    const Title = inDialog ? DialogTitle : "h3";
    const Desc = inDialog ? DialogDescription : "p";
    return (
      <WorkoutStudyCards
        immersive={inDialog}
        onFinish={inDialog ? () => setShowCompletionSummary(false) : undefined}
        muscles={musclesWorked}
        muscleSetCounts={muscleSetCounts}
        intensityFor={(muscle) => getMuscleIntensity(muscleSetCounts[muscle]).fill}
        current={Object.entries(exerciseLogs).map(([name, sets]) => ({ name, sets }))}
        previous={Object.entries(previousLogs).map(([name, sets]) => ({ name, sets }))}
        rpe={sessionRpe}
        intro={
          <div className="flex h-full flex-col gap-[clamp(0.5rem,2dvh,1.25rem)]">
            <header className="flex items-center gap-3 pt-1 text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="w-full">
                <Title className="text-lg font-semibold leading-tight tracking-tight">Entrenamiento completado</Title>
                <Desc className="truncate text-xs text-muted-foreground">
                  {completedDateLabel} · {trainingTitle || sessionMessage}
                </Desc>
              </div>
            </header>
            {personalRecords.length > 0 && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Trophy className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Récord · {personalRecords.join(" · ")}</span>
              </p>
            )}
            {(() => {
              const eq = null as null;
              const diff = totalVolume - previousVolume;
              const pct = previousVolume > 0 ? Math.round((diff / previousVolume) * 100) : null;
              if (!eq && pct === null) return null;
              return (
                <div className="border-l-2 border-primary/60 pl-3">
                  {pct !== null && totalVolume > 0 && (
                    <p className={`mt-0.5 truncate text-xs font-medium ${diff >= 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {diff >= 0 ? "+" : "−"}{Math.abs(Math.round(diff)).toLocaleString("es-ES")} kg ({pct > 0 ? "+" : ""}{pct} %) frente a tu sesión anterior
                    </p>
                  )}
                </div>
              );
            })()}
            <div className="grid grid-cols-4 divide-x divide-border/50 border-y border-border/50 py-[clamp(0.5rem,1.6dvh,1rem)]">
              {[
                { label: "Ejercicios", value: `${completedExercises}/${currentPlan?.exercises?.length || 0}` },
                { label: "Series", value: String(completedSets) },
                { label: "Volumen", value: totalVolume > 0 ? `${Math.round(totalVolume)}` : "—", unit: totalVolume > 0 ? "kg" : "" },
                { label: "Esfuerzo", value: sessionRpe !== null ? `${sessionRpe}` : "—", unit: sessionRpe !== null ? "/10" : "" },
              ].map((item) => (
                <div key={item.label} className="px-1 text-center">
                  <p className="truncate text-lg font-semibold tabular-nums tracking-tight">
                    {item.value}{item.unit && <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{item.unit}</span>}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-normal text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-auto">
              <WorkoutStoryShare
                title={trainingTitle || "Sesión de hoy"}
                date={completedDateLabel}
                volumeKg={totalVolume}
                sets={completedSets}
                exercises={completedExercises}
                records={personalRecords}
                muscles={musclesWorked}
                muscleSetCounts={muscleSetCounts}
                previousVolumeKg={previousVolume}
              />
            </div>
          </div>
        }
      />
    );
  };

  return (
    <div className={`w-full min-w-0 ${started ? "min-h-dvh px-3 pb-8 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:px-5" : ""}`}>
      <div className={`mb-3 flex items-center gap-3 text-[11px] text-muted-foreground ${workoutCompleted ? "hidden" : started ? "sticky top-0 z-30 -mx-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5" : "justify-end"}`}>
        {started && !workoutCompleted && (
          <>
            <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 px-2" onClick={saveAndExit} disabled={saving}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Salir
            </Button>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-semibold leading-tight text-foreground">{trainingTitle || "Entrenamiento"}</p>
              <p className="tabular-nums">{completedSets}/{totalSets} series</p>
            </div>
          </>
        )}
        {!workoutCompleted && saveStatus === "error" && <span role="status" className="shrink-0 text-destructive">Error al guardar</span>}
        {!workoutCompleted && (saveStatus === "pending" || saveStatus === "saving") && (
          <span role="status" aria-live="polite" className="shrink-0">
            {saveStatus === "pending" ? "Pendiente de guardar" : "Guardando…"}
          </span>
        )}
        {!workoutCompleted && saveStatus === "saved" && savedAt && (
          <span role="status" className="flex shrink-0 items-center gap-1"><Save className="h-3 w-3" /> Guardado</span>
        )}
      </div>

      {/* Selector de día: la semana entera siempre a un toque. Se oculta durante la
          sesión para no cambiar de día con series a medias. */}
      {!started && !workoutCompleted && dayPlans.length > 0 && (
        <div
          role="tablist"
          aria-label="Elige el día de la semana"
          className="no-scrollbar -mx-1 mb-3 flex gap-1 px-1"
        >
          {DAYS_ORDER.map((day) => {
            const plan = dayPlans.find((p) => p.day === day);
            const active = day === selectedDay;
            const isToday = day === DAYS_ORDER[todayIndex];
            const hasWork = plan?.type === "gimnasio" || plan?.type === "actividad";
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${day}${hasWork ? "" : " · descanso"}${isToday ? " · hoy" : ""}`}
                onClick={() => setSelectedDay(day)}
                className={`flex h-11 min-w-11 flex-1 shrink-0 flex-col items-center justify-center rounded-xl border text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : isToday
                      ? "border-primary/40 bg-card text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                <span>{day.slice(0, 3)}</span>
                <span className={`mt-0.5 h-1 w-1 rounded-full ${hasWork ? "bg-primary" : "bg-border"}`} />
              </button>
            );
          })}
        </div>
      )}

      {/* Rest day */}
      {!currentPlan && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-2xl p-10 border border-border text-center"
        >
          <div className="text-4xl mb-3">😴</div>
          <h3 className="font-display font-bold text-lg mb-1">Día de descanso</h3>
          <p className="text-sm text-muted-foreground">Recupera, o elige otra sesión de tu semana</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {dayPlans.filter((p) => (p.type === "actividad" || (p.exercises?.length ?? 0) > 0)).map((p) => (
              <button key={p.day} type="button" onClick={() => setSelectedDay(p.day)}
                className="rounded-full border border-border/60 bg-secondary px-3 py-1.5 text-xs font-medium hover:border-primary/50">
                {p.day}{(p as any).name ? ` · ${(p as any).name}` : ""}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Activity day */}
      {currentPlan?.type === "actividad" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-6 border border-border"
        >
          <h3 className="font-bold font-display text-lg mb-3">{currentPlan.sport}</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm bg-secondary px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-primary" />{currentPlan.intensity}
            </span>
            <span className="text-sm bg-secondary px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />{currentPlan.duration}
            </span>
          </div>
        </motion.div>
      )}

      {/* Gym day */}
      {currentPlan?.type === "gimnasio" && (
        <div className={`space-y-3`}>
          {/* Today's workout summary */}
          <div className={`rounded-2xl border border-border bg-card p-4 sm:p-5 ${workoutCompleted || !completionReady || loadError || started ? "hidden" : ""}`}>
            <p className="text-[11px] font-medium text-primary">{selectedDay}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <h3 className="min-w-0 font-display text-lg font-bold leading-tight sm:text-xl">
                {trainingTitle || selectedDay}
              </h3>
              <p role="status" className="shrink-0 text-xs font-semibold tabular-nums">
                {completedSets} de {totalSets} series
              </p>
            </div>

            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
            </div>

            {!started && (
              currentPlan?.exercises?.length ? (
                <Button
                  onClick={() => startWorkout(0)}
                  variant="hero"
                  size="lg"
                  className="mt-4 h-12 w-full text-base"
                >
                  Empezar entrenamiento
                </Button>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">
                  Este día no tiene ejercicios asignados todavía.
                </p>
              )
            )}
          </div>

          {!completionReady && !loadError && (
            <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              Comprobando tu entrenamiento de hoy…
            </div>
          )}
          {loadError && (
            <div role="alert" className="rounded-2xl border border-destructive/30 bg-card px-4 py-6 text-center">
              <p className="font-semibold">No pudimos cargar tu entrenamiento</p>
              <p className="mt-1 text-sm text-muted-foreground">No hemos cambiado ni reemplazado tus registros. Comprueba la conexión y vuelve a intentarlo.</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => setReloadLogs((value) => value + 1)}>
                <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
              </Button>
            </div>
          )}

          <Dialog open={workoutCompleted && showCompletionSummary} onOpenChange={setShowCompletionSummary}>
            {workoutCompleted && showCompletionSummary && (
              <DialogContent className="flex h-[min(80dvh,38rem)] w-[calc(100%-1.5rem)] max-w-md flex-col overflow-hidden rounded-[2rem] border border-primary/20 bg-card/95 p-0 pb-4 pt-5 shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.35)] ring-1 ring-foreground/5 backdrop-blur-2xl sm:rounded-[2rem] [&>button]:top-4 [&_*]:min-w-0">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/15 to-transparent" />
              <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
              {renderStudyCards(true)}
              </div>
              </DialogContent>
            )}
          </Dialog>

          {workoutCompleted && !showCompletionSummary && (
            <div className="flex h-[calc(100dvh-56px-var(--safe-top,0px)-12px-var(--mobile-nav-content-padding,6rem))] flex-col overflow-hidden md:h-auto md:overflow-visible">
              <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
                <div className="mb-3 flex shrink-0 items-center gap-3 px-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                    <Check className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Hecho por hoy</p>
                    <h2 className="truncate font-display text-lg font-bold">{trainingTitle || selectedDay}</h2>
                  </div>
                </div>
                {renderStudyCards(false)}
                <div className="flex shrink-0 items-start gap-3 px-1 pt-3 text-left">
                  <Flame className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Toca recuperar: hidrátate, come bien y mañana vuelves más fuerte.
                  </p>
                </div>
                <Button type="button" variant="hero" className="mt-3 h-12 w-full shrink-0 rounded-2xl" onClick={onExit}>
                  Volver al inicio
                </Button>
              </div>
            </div>
          )}

          {/* Rest island floating */}
          {!workoutCompleted && completionReady && <AnimatePresence>
            {restTimer !== null && (
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.96 }}
                className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-[calc(100%-1.5rem)] max-w-sm items-center gap-3 rounded-full border border-primary/25 bg-card/95 p-2 pr-3 shadow-[0_20px_50px_-15px_hsl(var(--primary)/0.45)] backdrop-blur-xl md:bottom-6"
                role="timer"
                aria-label="Descanso entre series"
              >
                <div className="relative h-14 w-14 shrink-0">
                  <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
                    <circle
                      cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 24}
                      strokeDashoffset={2 * Math.PI * 24 * (1 - restTimer / Math.max(restTarget, 1))}
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
                    {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Descanso</p>
                  <p className="truncate text-xs text-muted-foreground">Siguiente serie</p>
                </div>
                <button type="button" aria-label="Restar 30 segundos" onClick={() => adjustRest(-30)} className="h-10 rounded-full bg-secondary px-3 text-xs font-semibold tabular-nums">−30</button>
                <button type="button" aria-label="Sumar 30 segundos" onClick={() => adjustRest(30)} className="h-10 rounded-full bg-secondary px-3 text-xs font-semibold tabular-nums">+30</button>
                <button type="button" aria-label="Saltar descanso" onClick={() => setRestTimer(null)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>}

          {/* Modo foco: visor del ejercicio activo + carrusel de toda la sesión */}
          {started && !workoutCompleted && completionReady && !loadError && expandedExercise !== null && (() => {
            const active = currentPlan.exercises?.[expandedExercise];
            if (!active) return null;
            const meta = exerciseMetadata.byId[active.exercise_id] || exerciseMetadata.byName[active.name];
            const img = active.image_url || meta?.image_url;
            const vid = active.video_url || meta?.video_url;
            return (
              <div className="mb-3 space-y-3">
                <div className="relative flex aspect-[4/3] max-h-[34dvh] w-full items-center justify-center overflow-hidden rounded-3xl bg-card">
                  {img ? (
                    <img src={img} alt={active.name} className="h-full w-full object-contain" />
                  ) : (
                    <p className="px-6 text-center text-sm text-muted-foreground">{swaps[active.name] || active.name}</p>
                  )}
                  {vid && (
                    <button
                      type="button"
                      aria-label={`Ver vídeo de técnica de ${active.name}`}
                      onClick={() => setTechnique({ name: active.name, image: img, video: vid, series: active.series != null ? String(active.series) : undefined, reps: active.reps != null ? String(active.reps) : undefined, rest: active.rest, category: active.muscle_group || meta?.muscle_group, type: active.exercise_type || meta?.exercise_type })}
                      className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur"
                    >
                      <Play className="h-5 w-5 fill-current" />
                    </button>
                  )}
                </div>
                <div role="tablist" aria-label="Ejercicios de la sesión" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
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
                        className={`shrink-0 rounded-2xl p-0.5 transition-all ${isActive ? "ring-2 ring-primary" : "opacity-60"}`}
                      >
                        <ExerciseThumb image={item.image_url || m?.image_url} video={item.video_url || m?.video_url} name={item.name} completed={done} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Exercise list */}
          {!workoutCompleted && completionReady && !loadError && (currentPlan.exercises || []).map((ex, i) => {
            const isExpanded = expandedExercise === i;
            if (started && expandedExercise !== null && !isExpanded) return null;
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
            const trackingConfig = getExerciseTrackingConfig({
              name: ex.name,
              skill_tag: metadata?.skill_tag ?? undefined,
              movement_pattern: (ex as any).movement_pattern ?? metadata?.movement_pattern ?? undefined,
              exercise_type: exerciseType ?? undefined,
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
              <motion.div
                key={`${selectedDay}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`overflow-hidden rounded-2xl border bg-card transition-colors ${
                  allDone ? "border-primary/40" : "border-border/80"
                }`}
              >
                {/* Exercise header */}
                <button
                  onClick={() => {
                    if (!started) {
                      startWorkout(i);
                    } else {
                      setExpandedExercise(i);
                    }
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-secondary/20 sm:px-4"
                >
                  {/* Miniatura única de ejercicio (misma que en el resto de la app) */}
                  <ExerciseThumb image={ex.image_url || metadata?.image_url} video={exerciseVideo} name={ex.name} completed={allDone} />
                  <div className="flex-1 text-left min-w-0">
                    {/* El nombre ocupa todo el ancho: los iconos van en la columna de acciones */}
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`truncate text-sm font-semibold ${allDone ? "text-primary" : ""}`}>
                        {swaps[ex.name] || ex.name}
                      </span>
                      {isInSuperset && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Superserie {supersetPosition}/{supersetChain.length}
                        </span>
                      )}
                    </div>
                    {swaps[ex.name] && <div className="truncate text-xs text-primary">En lugar de {ex.name}</div>}
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {ex.series} series <span className="px-0.5 text-border">·</span> {ex.reps} reps <span className="px-0.5 text-border">·</span> {ex.rest}
                    </div>

                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!allDone && (
                      <ExerciseSwap
                        original={ex.name}
                        current={swaps[ex.name]}
                        movementPattern={metadata?.movement_pattern}
                        muscleGroup={metadata?.muscle_group}
                        onSelect={(name) => setSwaps((s) => { const next = { ...s }; if (name) next[ex.name] = name; else delete next[ex.name]; return next; })}
                      />
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver ficha de técnica de ${ex.name}`}
                      title="Ver ficha de técnica"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTechnique({
                          name: ex.name,
                          image: ex.image_url || metadata?.image_url,
                          video: exerciseVideo,
                          series: ex.series != null ? String(ex.series) : undefined,
                          reps: ex.reps != null ? String(ex.reps) : undefined,
                          rest: ex.rest,
                          category: exerciseCategory,
                          type: exerciseType,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                          setTechnique({
                            name: ex.name,
                            image: ex.image_url || metadata?.image_url,
                            video: exerciseVideo,
                            series: ex.series != null ? String(ex.series) : undefined,
                            reps: ex.reps != null ? String(ex.reps) : undefined,
                            rest: ex.rest,
                            category: exerciseCategory,
                            type: exerciseType,
                          });
                        }
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Info className="w-4 h-4" />
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded set tracking */}
                <AnimatePresence>
                  {started && isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-1.5">
                        {/* Minimal: la sugerencia (sobrecarga progresiva / entrenador) va en gris dentro de cada casilla */}

                        {/* Column headers */}
                        <div className="grid grid-cols-[32px_52px_1fr_1fr_44px] gap-2 text-[10px] text-muted-foreground font-semibold uppercase px-1 pb-1">
                          <span>Serie</span>
                          <span className="text-center">Previa</span>
                          <span className="flex items-center gap-1">
                            {trackingConfig.weightLabel}
                          </span>
                          <span className="flex items-center gap-1">
                            {trackingConfig.valueLabel}
                          </span>
                          <span className="text-center flex items-center justify-center gap-1">
                            ✓
                          </span>
                        </div>

                        {sets.map((set, si) => {
                          const mainError = !set.done ? getWorkoutSetInputError(set) : null;
                          const dropsError = !set.done ? getWorkoutSetDropsInputError(set) : null;
                          const inputError = mainError ?? dropsError;
                          const drops = getWorkoutSetDrops(set);
                          const isWarmup = isWorkoutSetWarmup(set);
                          // Serie de calentamiento: atenuada y nunca con el color de serie hecha.
                          const doneButtonClass = isWarmup
                            ? "border border-border bg-secondary text-muted-foreground"
                            : "bg-primary text-primary-foreground";
                          const pendingButtonClass = inputError
                            ? "border border-destructive/40 bg-destructive/10 text-destructive"
                            : "border border-border bg-secondary text-muted-foreground hover:border-primary/50 hover:text-primary";
                          return (
                          <div
                            key={si}
                            className={`relative rounded-lg p-2 transition-all ${
                              livePRs[`${ex.name}#${si}`]
                                ? "bg-accent/15 border border-accent/60 shadow-[0_0_24px_hsl(var(--accent)/0.35)]"
                                : isWarmup
                                ? "bg-secondary/30 border border-border/60 text-muted-foreground"
                                : set.done
                                ? "bg-primary/10 border border-primary/20"
                                : "bg-secondary/30"
                            }`}
                          >
                            {livePRs[`${ex.name}#${si}`] && (
                              <span className="absolute -top-2 right-14 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-foreground">
                                Récord · {livePRs[`${ex.name}#${si}`]}
                              </span>
                            )}

                            {/* Segmento principal de la serie */}
                            <div className="grid grid-cols-[32px_52px_1fr_1fr_44px] gap-2 items-center">
                              {/* Set number */}
                              <span className={`text-xs font-bold text-center ${
                                set.done && !isWarmup ? "text-primary" : "text-muted-foreground"
                              }`}>
                                {si + 1}
                              </span>
                              <span className="truncate text-center text-[11px] tabular-nums text-muted-foreground">
                                {prevSets?.[si]?.done ? `${prevSets[si].weight || "—"}×${prevSets[si].reps}` : "—"}
                              </span>

                              {/* Weight input */}
                              <div className="min-w-0">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={set.weight}
                                  onChange={(e) => updateSet(ex.name, si, "weight", e.target.value)}
                                  placeholder={String(progression?.weight || prevSets?.[si]?.weight || ex.weight || "kg")}
                                  onFocus={(e) => e.currentTarget.select()}
                                  aria-label={`Peso de la serie ${si + 1} de ${ex.name}`}
                                  aria-invalid={Boolean(mainError && set.weight.trim())}
                                  className={`min-h-11 w-full bg-background border rounded-lg px-3 py-2 text-sm text-center font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${isWarmup ? "text-muted-foreground" : ""} ${!set.done && prevSets?.[si]?.done && set.weight === prevSets[si].weight ? "text-muted-foreground" : ""} ${mainError && set.weight.trim() ? "border-destructive" : "border-border"}`}
                                />
                              </div>

                              {/* Reps input */}
                              <div className="min-w-0">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={set.reps}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val)) updateSet(ex.name, si, "reps", val);
                                  }}
                                  onFocus={(e) => e.currentTarget.select()}
                                  aria-label={`Repeticiones de la serie ${si + 1} de ${ex.name}`}
                                  aria-invalid={Boolean(mainError && (!Number.isInteger(set.reps) || set.reps <= 0))}
                                  className={`min-h-11 w-full bg-background border rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${isWarmup ? "text-muted-foreground" : ""} ${!set.done && prevSets?.[si]?.done && set.reps === prevSets[si].reps ? "text-muted-foreground" : ""} ${mainError && (!Number.isInteger(set.reps) || set.reps <= 0) ? "border-destructive" : "border-border"}`}
                                />
                              </div>

                              {/* Done toggle: marca la serie entera (bajadas incluidas) y arranca el descanso */}
                              <button
                                type="button"
                                onClick={() => toggleSetDone(ex.name, si, restSec)}
                                aria-label={`${set.done ? "Desmarcar" : "Marcar"} serie ${si + 1} de ${ex.name}`}
                                title={set.done ? "Desmarcar serie" : "Marcar serie como hecha"}
                                className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all mx-auto ${
                                  set.done ? doneButtonClass : pendingButtonClass
                                }`}
                              >
                                <Check className="w-5 h-5" />
                              </button>
                            </div>

                            {/* Dropset: bajadas dentro de la misma serie, sin descanso entre ellas */}
                            <div className={`space-y-1.5 ${drops.length > 0 ? "mt-1.5 border-t border-border/60 pt-1.5" : "mt-1"}`}>
                              {drops.map((drop, di) => {
                                const dropError = !set.done ? getWorkoutSetDropInputError(drop) : null;
                                return (
                                <div key={di} className="grid grid-cols-[32px_52px_1fr_1fr_44px] gap-2 items-center">
                                  <span className="flex items-center justify-center text-muted-foreground" title={`Bajada ${di + 1}`}>
                                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                                  </span>
                                  <span aria-hidden="true" />
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={drop.weight}
                                    onChange={(e) => updateDrop(ex.name, si, di, { weight: e.target.value })}
                                    placeholder="kg"
                                    onFocus={(e) => e.currentTarget.select()}
                                    aria-label={`Peso de la bajada ${di + 1} de la serie ${si + 1} de ${ex.name}`}
                                    aria-invalid={Boolean(dropError && drop.weight.trim())}
                                    className={`min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-center font-mono text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 ${dropError && drop.weight.trim() ? "border-destructive" : "border-border"}`}
                                  />
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={drop.reps}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      if (!isNaN(val)) updateDrop(ex.name, si, di, { reps: val });
                                    }}
                                    onFocus={(e) => e.currentTarget.select()}
                                    aria-label={`Repeticiones de la bajada ${di + 1} de la serie ${si + 1} de ${ex.name}`}
                                    aria-invalid={Boolean(dropError && (!Number.isInteger(drop.reps) || drop.reps <= 0))}
                                    className={`min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-center font-mono text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 ${dropError && (!Number.isInteger(drop.reps) || drop.reps <= 0) ? "border-destructive" : "border-border"}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeDrop(ex.name, si, di)}
                                    aria-label={`Quitar la bajada ${di + 1} de la serie ${si + 1} de ${ex.name}`}
                                    title="Quitar bajada"
                                    className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                );
                              })}
                              <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => addDrop(ex.name, si)}
                                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Añadir bajada
                              </button>
                              {/* Calentamiento: se guarda y se marca con ✓, pero no cuenta en tus métricas */}
                              <button
                                type="button"
                                aria-pressed={isWarmup}
                                aria-label={`${isWarmup ? "Quitar" : "Marcar"} la serie ${si + 1} de ${ex.name} como calentamiento`}
                                title={isWarmup
                                  ? "Calentamiento: no cuenta en volumen, récords ni series completadas. Toca para volver a serie de trabajo."
                                  : "Marcar como calentamiento: no contará en volumen, récords ni series completadas."}
                                onClick={() => toggleWarmup(ex.name, si)}
                                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                                  isWarmup
                                    ? "border-border bg-secondary/30 text-muted-foreground"
                                    : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                                }`}
                              >
                                <Flame className="h-3.5 w-3.5" fill={isWarmup ? "currentColor" : "none"} aria-hidden="true" />
                                Calentamiento
                              </button>
                              </div>
                            </div>

                            {drops.length > 0 && (
                              <p className="mt-1.5 px-1 text-xs tabular-nums text-muted-foreground">
                                {formatWorkoutSetSummary(set)}
                              </p>
                            )}
                            {inputError && <p className="mt-1 px-1 text-[10px] text-destructive">{inputError}</p>}
                          </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* Finish workout */}
          {!workoutCompleted && completionReady && !loadError && started && <div className="sticky bottom-0 z-20 -mx-4 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-background/95 backdrop-blur-md border-t border-border/40">
            <div className="flex items-center justify-center gap-1.5 mb-2 text-[11px] text-muted-foreground">
              <span role="status" aria-live="polite" className={saveError ? "text-destructive" : ""}>
                {saveStatus === "error"
                  ? "Error al guardar. Comprueba tu conexión."
                  : saveStatus === "pending"
                    ? "Cambios pendientes de guardar"
                    : saveStatus === "saving"
                      ? "Guardando cambios…"
                      : saveStatus === "saved"
                        ? "Guardado automáticamente"
                        : "Se guarda automáticamente"}
              </span>
            </div>
            {completedSets === totalSets && totalSets > 0 && (
              <Button type="button" variant="ghost" className="mb-1 w-full" onClick={() => setRpeOpen(true)} disabled={saving}>
                Valorar esfuerzo antes de terminar (opcional)
              </Button>
            )}
            <Button
              onClick={finishWorkout}
              disabled={saving || completedSets === 0}
              className="w-full h-12 text-base font-bold"
              variant="hero"
              size="lg"
            >
              {saving ? "Guardando y terminando..." : "Terminar entrenamiento"}
            </Button>
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
        } : null}
        onClose={() => setTechnique(null)}
      />


      <RPEDialog open={rpeOpen} onConfirm={handleRPEConfirm} />
    </div>
  );
};

export default WorkoutTracker;
