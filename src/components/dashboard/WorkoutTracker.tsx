import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Dumbbell, ChevronDown, ChevronUp, Flame, Clock, ArrowLeft,
  Timer, TrendingUp, X, Video, Save, Trophy,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DayPlan } from "@/types/training";
import RPEDialog from "./RPEDialog";
import VideoEmbed from "@/components/VideoEmbed";
import InfoHint from "@/components/InfoHint";
import { useExerciseMetadata } from "@/hooks/useExerciseMetadata";
import { getWorkoutRestSeconds } from "@/lib/workoutPreferences";
import { applyProgressionToPendingSets, getProgressionSuggestion } from "@/lib/workoutProgression";
import { parsePositiveWeight } from "@/lib/weight";
import { WorkoutStoryShare } from "./WorkoutStoryShare";
import { WorkoutStudyCards } from "./WorkoutStudyCards";
import { formatTrainingTitle } from "@/lib/trainingDisplay";
import { hapticTap } from "@/lib/native";
import { createWorkoutSetLogs, getWorkoutSetInputError, type WorkoutSetLog } from "@/lib/workoutSet";
import { getExerciseTrackingConfig } from "@/lib/exerciseTrackingConfig";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

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
  const selectedDay = DAYS_ORDER[todayIndex];
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, WorkoutSetLog[]>>({});
  const [previousLogs, setPreviousLogs] = useState<Record<string, WorkoutSetLog[]>>({});
  const [previousSessionRpe, setPreviousSessionRpe] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restTarget, setRestTarget] = useState(0);
  const [rpeOpen, setRpeOpen] = useState(false);
  const [showVideo, setShowVideo] = useState<Record<string, boolean>>({});
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
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [personalRecords, setPersonalRecords] = useState<string[]>([]);
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
      setShowCompletionSummary(Boolean(completionResult.data));
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
        setExerciseLogs(logs);
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

  // Rest timer countdown
  useEffect(() => {
    if (restTimer === null || restTimer <= 0) return;
    const interval = setInterval(() => {
      setRestTimer((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          toast("⏰ ¡Descanso terminado!", { duration: 3000 });
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restTimer !== null]);

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
      const inputError = getWorkoutSetInputError(set);
      if (inputError) {
        toast.error(inputError);
        return;
      }
    }
    updateSet(exerciseName, setIndex, "done", !wasDone);

    // Start rest timer when marking set as done
    if (!wasDone) {
      void hapticTap();
      const configuredRest = getWorkoutRestSeconds(userId);
      const effectiveRest = configuredRest || restSeconds || 60;
      setRestTarget(effectiveRest);
      setRestTimer(effectiveRest);
    }

    const exerciseIndex = currentPlan?.exercises?.findIndex((exercise) => exercise.name === exerciseName) ?? -1;
    const sets = exerciseLogs[exerciseName] || [];
    if (!wasDone && exerciseIndex >= 0 && setIndex === sets.length - 1 && currentPlan?.exercises?.[exerciseIndex + 1]) {
      setExpandedExercise(exerciseIndex + 1);
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
    // For each exercise with weight > 0, find best (weight, reps) and upsert
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
        return set.done && weight !== null && Number.isFinite(set.reps) && set.reps > 0
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
      toast.success("¡Entrenamiento completado! 💪");
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

  const completedSets = Object.values(exerciseLogs).flat().filter((s) => s.done).length;
  const totalSets = Object.values(exerciseLogs).flat().length;
  const completedLogEntries = Object.entries(exerciseLogs).flatMap(([name, sets]) =>
    sets.filter((set) => set.done).map((set) => ({ name, set })),
  );
  const totalVolume = completedLogEntries.reduce((total, { set }) => {
    const weight = parsePositiveWeight(set.weight);
    return total + (weight !== null ? weight * Math.max(0, set.reps) : 0);
  }, 0);
  const muscleSetCounts = (currentPlan?.exercises || []).reduce<Record<string, number>>((counts, exercise) => {
    const completedSetsForExercise = (exerciseLogs[exercise.name] || []).filter((set) => set.done).length;
    if (completedSetsForExercise === 0) return counts;

    const metadata = exerciseMetadata.byId[exercise.exercise_id] || exerciseMetadata.byName[exercise.name];
    const muscle = exercise.muscle_group || metadata?.muscle_group;
    if (muscle) counts[muscle] = (counts[muscle] || 0) + completedSetsForExercise;
    return counts;
  }, {});
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

  return (
    <div className={`w-full min-w-0 ${started ? "min-h-dvh px-3 pb-8 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:px-5" : ""}`}>
      <div className={`mb-3 flex items-center gap-3 text-[11px] text-muted-foreground ${started && !workoutCompleted ? "sticky top-0 z-30 -mx-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5" : "justify-end"}`}>
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

      {/* Rest day */}
      {!currentPlan && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-2xl p-10 border border-border text-center"
        >
          <div className="text-4xl mb-3">😴</div>
          <h3 className="font-display font-bold text-lg mb-1">Día de descanso</h3>
          <p className="text-sm text-muted-foreground">Recupera y vuelve más fuerte mañana</p>
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
        <div className={`space-y-3 ${workoutCompleted ? "min-h-[calc(100vh-8rem)]" : ""}`}>
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
                  className="h-full rounded-full bg-gradient-to-r from-primary to-amber-200"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
            </div>

            {!started && (
              <Button
                onClick={() => startWorkout(0)}
                variant="hero"
                size="lg"
                className="mt-4 h-12 w-full text-base"
              >
                Empezar entrenamiento
              </Button>
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
              <DialogContent className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem)] w-[calc(100vw-1rem)] max-w-xl min-w-0 overflow-x-hidden overflow-y-hidden rounded-[1.5rem] border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl sm:p-6 [&_*]:min-w-0">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 pb-1">
              <header className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-3 text-left shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">
                    Sesión guardada · {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
                  </p>
                  <DialogTitle className="truncate font-display text-lg font-bold tracking-tight">Entrenamiento completado</DialogTitle>
                  <DialogDescription className="truncate text-xs text-muted-foreground">{trainingTitle || sessionMessage}</DialogDescription>
                </div>
              </header>

              {personalRecords.length > 0 && (
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-left text-xs font-semibold text-primary">
                  <Trophy className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Nuevo récord · {personalRecords.join(" · ")}</span>
                </div>
              )}

              <section aria-label="Resumen de la sesión" className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "Ejercicios", value: `${completedExercises}/${currentPlan.exercises?.length || 0}` },
                  { label: "Series", value: String(completedSets) },
                  { label: "Volumen", value: totalVolume > 0 ? `${Math.round(totalVolume)} kg` : "—" },
                  { label: "Esfuerzo", value: sessionRpe !== null ? `${sessionRpe}/10` : "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/80 bg-card px-2 py-2 text-center">
                    <p className="truncate text-sm font-bold tabular-nums">{item.value}</p>
                    <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </section>

              <WorkoutStoryShare
                title={trainingTitle || "Sesión de hoy"}
                date={new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
                volumeKg={totalVolume}
                sets={completedSets}
                exercises={completedExercises}
                records={personalRecords}
                muscles={musclesWorked}
              />

              <Button
                type="button"
                variant="outline"
                className="h-9 w-full rounded-xl text-xs"
                onClick={() => setShowSummaryDetails((v) => !v)}
                aria-expanded={showSummaryDetails}
              >
                {showSummaryDetails ? "Ocultar fichas de la sesión" : "Ver fichas de la sesión"}
              </Button>

              {showSummaryDetails && (
                <WorkoutStudyCards
                  muscles={musclesWorked}
                  muscleSetCounts={muscleSetCounts}
                  intensityFor={(muscle) => getMuscleIntensity(muscleSetCounts[muscle]).fill}
                  current={Object.entries(exerciseLogs).map(([name, sets]) => ({ name, sets }))}
                  previous={Object.entries(previousLogs).map(([name, sets]) => ({ name, sets }))}
                  rpe={sessionRpe}
                />
              )}
              <p className="text-center text-[11px] text-muted-foreground">Tu sesión y los datos del resumen están guardados.</p>
              <Button
                type="button"
                variant="hero"
                className="sticky bottom-2 h-12 w-full rounded-2xl text-base shadow-lg"
                onClick={onExit}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al inicio
              </Button>
              </motion.div>
              </DialogContent>
            )}
          </Dialog>

          {workoutCompleted && !showCompletionSummary && (
            <div className="flex min-h-[calc(100dvh-12rem)] flex-col justify-center rounded-[2rem] border border-primary/25 bg-gradient-to-b from-primary/10 via-card to-card p-5 sm:p-8">
              <div className="mx-auto w-full max-w-lg text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Entrenamiento de hoy</p>
                <h2 className="mt-1 font-display text-3xl font-bold">Hecho por hoy</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Ya completaste {trainingTitle || selectedDay}. Ahora toca recuperar: mañana podrás volver a entrenar.
                </p>

                <div className="mt-7 grid grid-cols-3 gap-2 text-left">
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-3">
                    <p className="text-xl font-bold tabular-nums">{completedExercises}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">ejercicios</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-3">
                    <p className="text-xl font-bold tabular-nums">{completedSets}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">series hechas</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-3">
                    <p className="text-xl font-bold tabular-nums">{totalVolume > 0 ? `${Math.round(totalVolume)}` : "—"}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{totalVolume > 0 ? "kg de volumen" : "volumen"}</p>
                  </div>
                </div>

                {musclesWorked.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-border/70 bg-background/60 p-4 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Grupos trabajados</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {musclesWorked.map((muscle) => (
                        <span key={muscle} className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                          {muscle}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-start gap-3 rounded-2xl bg-secondary/50 p-4 text-left">
                  <Flame className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Prioriza la recuperación</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Hidrátate, come bien y deja que el cuerpo asimile el trabajo. Tu plan semanal sigue aquí cuando lo necesites.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  onClick={() => setShowCompletionSummary(true)}
                >
                  Ver mapa muscular
                </button>
                <Button type="button" variant="hero" className="mt-3 h-12 w-full rounded-2xl" onClick={onExit}>
                  Volver al inicio
                </Button>
              </div>
            </div>
          )}

          {/* Rest timer floating */}
          {!workoutCompleted && completionReady && <AnimatePresence>
            {restTimer !== null && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium">Descanso · siguiente serie</span>
                  <InfoHint text={`Cuenta atrás automática al marcar una serie (${restTarget}s según tu plan). Puedes reiniciarla o saltarla con el icono de la derecha.`} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold font-mono text-primary">
                    {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, "0")}
                  </span>
                  <button
                    onClick={() => setRestTimer(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>}

          {/* Exercise list */}
          {!workoutCompleted && completionReady && !loadError && (currentPlan.exercises || []).map((ex, i) => {
            const isExpanded = expandedExercise === i;
            const sets = exerciseLogs[ex.name] || [];
            const doneSets = sets.filter((s) => s.done).length;
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
            const progression = getProgressionSuggestion(ex, prevSets, previousSessionRpe);

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
                      setExpandedExercise(isExpanded ? null : i);
                    }
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-secondary/20 sm:px-4"
                >
                  {/* Exercise image or icon */}
                  {(ex.image_url || metadata?.image_url) ? (
                    <img
                      src={ex.image_url || metadata?.image_url || ""}
                      alt={ex.name}
                      className="h-11 w-11 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      allDone ? "bg-primary/20" : "bg-secondary"
                    }`}>
                      <Dumbbell className={`w-4 h-4 ${allDone ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className={`truncate text-sm font-semibold ${allDone ? "text-primary" : ""}`}>
                      {ex.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {ex.series} series <span className="px-0.5 text-border">·</span> {ex.reps} reps <span className="px-0.5 text-border">·</span> {ex.rest}
                    </div>
                    {started && (exerciseCategory || exerciseType || trackingConfig) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {exerciseCategory && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
                            {exerciseCategory}
                          </span>
                        )}
                        {exerciseType && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] text-muted-foreground">
                            {exerciseType}
                          </span>
                        )}
                        {trackingConfig && (
                          <span className="rounded-full bg-secondary/80 px-2 py-0.5 text-[9px] text-muted-foreground">
                            {trackingConfig.valueLabel}
                          </span>
                        )}
                      </div>
                    )}
                    {started && progression && (
                      <span
                        title={progression.reason}
                        className={`mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          progression.label === "Subir" || progression.label === "Añadir rep"
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        <TrendingUp className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {progression.label === "Subir"
                            ? `Sube a ${progression.weight} kg hoy`
                            : progression.label === "Añadir rep"
                              ? "Prueba 1 rep más por serie"
                              : progression.label === "Mantener"
                                ? progression.weight ? `Mantén ${progression.weight} kg hoy` : "Mantén las repeticiones hoy"
                                : progression.weight ? `Repite ${progression.weight} kg hoy` : "Repite las repeticiones hoy"}
                        </span>
                      </span>
                    )}

                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
                        {/* Vídeo del ejercicio */}
                        {exerciseVideo ? (
                          <div className="mb-2">
                            {showVideo[ex.name] ? (
                              <div className="space-y-1.5">
                                <VideoEmbed url={exerciseVideo} />
                                <button
                                  onClick={() => setShowVideo((s) => ({ ...s, [ex.name]: false }))}
                                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                                >
                                  Ocultar vídeo
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowVideo((s) => ({ ...s, [ex.name]: true }))}
                                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium px-2 py-1.5 rounded-md bg-primary/10 hover:bg-primary/15 transition-colors"
                              >
                                <Video className="w-3.5 h-3.5" />
                                  Ver vídeo de técnica
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="mb-2 rounded-md bg-secondary/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                            Vídeo de técnica no disponible todavía.
                          </p>
                        )}


                        {/* Previous session hint */}
                        {prevSets?.some((set) => set.done) && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2 px-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Toca ✓ para repetir lo de la última vez: {prevSets.filter((set) => set.done).map((s) => `${s.weight || "—"}×${s.reps}`).join(", ")}</span>
                            <InfoHint text="Los pesos y repeticiones de las series completadas la última vez ya están puestos. Ajusta solo lo que cambie hoy." />
                          </div>
                        )}

                        {progression && !allDone && (
                          <div className="mb-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                            <p className="text-xs font-semibold">{progression.reason}</p>
                            <button
                              type="button"
                              onClick={() => applyProgression(ex.name, progression)}
                              className="mt-2 min-h-10 w-full rounded-lg bg-primary/10 px-3 text-left text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                            >
                              Aplicar a las series pendientes
                            </button>
                          </div>
                        )}

                        {/* Column headers */}
                        <div className="grid grid-cols-[36px_1fr_1fr_44px] gap-2 text-[10px] text-muted-foreground font-semibold uppercase px-1 pb-1">
                          <span>Serie</span>
                          <span className="flex items-center gap-1">
                            {trackingConfig.weightLabel}
                            <InfoHint text={trackingConfig.description} />
                          </span>
                          <span className="flex items-center gap-1">
                            {trackingConfig.valueLabel}
                            <InfoHint text="Registra el valor que realmente completaste, aunque sea menor o mayor que lo planificado." />
                          </span>
                          <span className="text-center flex items-center justify-center gap-1">
                            ✓
                            <InfoHint text="Marca la serie al terminarla: se inicia el temporizador de descanso y cuenta para tu progreso del día." />
                          </span>
                        </div>

                        {sets.map((set, si) => {
                          const inputError = !set.done ? getWorkoutSetInputError(set) : null;
                          return (
                          <div
                            key={si}
                            className={`grid grid-cols-[36px_1fr_1fr_44px] gap-2 items-center p-2 rounded-lg transition-all ${
                              set.done
                                ? "bg-primary/10 border border-primary/20"
                                : "bg-secondary/30"
                            }`}
                          >
                            {/* Set number */}
                            <span className={`text-xs font-bold text-center ${
                              set.done ? "text-primary" : "text-muted-foreground"
                            }`}>
                              {si + 1}
                            </span>

                            {/* Weight input */}
                            <div className="min-w-0">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={set.weight}
                                onChange={(e) => updateSet(ex.name, si, "weight", e.target.value)}
                                placeholder={ex.weight || "kg"}
                                onFocus={(e) => e.currentTarget.select()}
                                aria-label={`Peso de la serie ${si + 1} de ${ex.name}`}
                                aria-invalid={Boolean(inputError && set.weight.trim())}
                                className={`min-h-11 w-full bg-background border rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${!set.done && prevSets?.[si]?.done && set.weight === prevSets[si].weight ? "text-muted-foreground" : ""} ${inputError && set.weight.trim() ? "border-destructive" : "border-border"}`}
                              />
                              {prevSets?.[si] && (
                                <p className="mt-1 truncate text-center text-[10px] text-muted-foreground">
                                  Antes: {prevSets[si].weight || "—"} kg
                                </p>
                              )}
                              {!prevSets?.[si] && progression && (
                                <p className="mt-1 truncate text-center text-[10px] font-medium text-primary">
                                  Para revisar: {progression.weight} kg
                                </p>
                              )}
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
                                aria-invalid={Boolean(inputError && (!Number.isInteger(set.reps) || set.reps <= 0))}
                                className={`min-h-11 w-full bg-background border rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${!set.done && prevSets?.[si]?.done && set.reps === prevSets[si].reps ? "text-muted-foreground" : ""} ${inputError && (!Number.isInteger(set.reps) || set.reps <= 0) ? "border-destructive" : "border-border"}`}
                              />
                              {prevSets?.[si] && (
                                <p className="mt-1 truncate text-center text-[10px] text-muted-foreground">
                                  Antes: {prevSets[si].reps} reps
                                </p>
                              )}
                            </div>

                            {/* Done toggle */}
                            <button
                              type="button"
                              onClick={() => toggleSetDone(ex.name, si, restSec)}
                              aria-label={`${set.done ? "Desmarcar" : "Marcar"} serie ${si + 1} de ${ex.name}`}
                              title={set.done ? "Desmarcar serie" : "Marcar serie como hecha"}
                              className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all mx-auto ${
                                set.done
                                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                  : inputError
                                    ? "bg-secondary text-muted-foreground"
                                    : "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                              }`}
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            {inputError && <p className="col-span-full px-1 text-[10px] text-destructive">{inputError}</p>}
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
          {!workoutCompleted && completionReady && !loadError && <div className="sticky bottom-3 z-20 pt-3 pb-4">
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
              <InfoHint text="Tus series se guardan automáticamente. Al terminar se guardará cualquier cambio pendiente; solo se marcará el día como completado si has hecho todas las series." />
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

      <RPEDialog open={rpeOpen} onConfirm={handleRPEConfirm} />
    </div>
  );
};

export default WorkoutTracker;
