import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Dumbbell, ChevronDown, ChevronUp, Flame, Clock, ArrowLeft,
  Timer, TrendingUp, X, Video, Save, Trophy, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DayPlan } from "@/types/training";
import RPEDialog from "./RPEDialog";
import VideoEmbed from "@/components/VideoEmbed";
import { exerciseVideoSearchUrl } from "@/lib/exerciseVideo";
import InfoHint from "@/components/InfoHint";
import { useExerciseMetadata } from "@/hooks/useExerciseMetadata";
import { getWorkoutRestSeconds } from "@/lib/workoutPreferences";
import { getProgressionSuggestion } from "@/lib/workoutProgression";
import { MuscleMapFigure } from "./MuscleMapFigure";

interface SetLog {
  reps: number;
  weight: string;
  done: boolean;
}

interface Props {
  userId: string;
  dayPlans: DayPlan[];
  onExit?: () => void;
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const MUSCLE_INTENSITY = {
  low: { label: "Bajo", range: "1–2 series", fill: "#B77A35" },
  medium: { label: "Medio", range: "3–5 series", fill: "#E2B84B" },
  high: { label: "Alto", range: "6+ series", fill: "#FFE39A" },
};

const getMuscleIntensity = (sets: number) => sets >= 6
  ? MUSCLE_INTENSITY.high
  : sets >= 3
    ? MUSCLE_INTENSITY.medium
    : MUSCLE_INTENSITY.low;

const WorkoutTracker = ({ userId, dayPlans, onExit }: Props) => {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const selectedDay = DAYS_ORDER[todayIndex];
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, SetLog[]>>({});
  const [previousLogs, setPreviousLogs] = useState<Record<string, SetLog[]>>({});
  const [saving, setSaving] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restTarget, setRestTarget] = useState(0);
  const [rpeOpen, setRpeOpen] = useState(false);
  const [showVideo, setShowVideo] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [logsReady, setLogsReady] = useState(false);
  const [completionReady, setCompletionReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);
  const [personalRecords, setPersonalRecords] = useState<string[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
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
  const currentPlanSignature = JSON.stringify(currentPlan || null);

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
      const [{ data }, { data: completion, error: completionError }] = await Promise.all([
        supabase
          .from("workout_logs")
          .select("exercise_name, sets_completed")
          .eq("user_id", userId)
          .eq("day_label", selectedDay)
          .eq("logged_at", selectedDate),
        supabase
          .from("day_completions")
          .select("id")
          .eq("user_id", userId)
          .eq("day_label", selectedDay)
          .eq("completed_at", selectedDate)
          .maybeSingle(),
      ]);

      if (!active) return;
      if (completionError) {
        toast.error("No se pudo comprobar el estado del entrenamiento.");
        setWorkoutCompleted(false);
      } else {
        setWorkoutCompleted(Boolean(completion));
      }
      setCompletionReady(true);
      if (data && data.length > 0) {
        const logs: Record<string, SetLog[]> = {};
        data.forEach((row: any) => {
          logs[row.exercise_name] = row.sets_completed as SetLog[];
        });
        setExerciseLogs(logs);
      } else if (currentPlan?.type === "gimnasio" && currentPlan.exercises) {
        const logs: Record<string, SetLog[]> = {};
        currentPlan.exercises.forEach((ex) => {
          logs[ex.name] = Array.from({ length: ex.series }, () => ({
            reps: ex.reps,
            weight: ex.weight || "",
            done: false,
          }));
        });
        setExerciseLogs(logs);
      } else {
        setExerciseLogs({});
      }

      // Previous session logs (last workout on this day)
      const { data: prevData } = await supabase
        .from("workout_logs")
        .select("exercise_name, sets_completed, logged_at")
        .eq("user_id", userId)
        .eq("day_label", selectedDay)
        .lt("logged_at", selectedDate)
        .order("logged_at", { ascending: false })
        .limit(20);

      if (!active) return;
      if (prevData && prevData.length > 0) {
        const lastDate = prevData[0].logged_at;
        const prev: Record<string, SetLog[]> = {};
        prevData
          .filter((r: any) => r.logged_at === lastDate)
          .forEach((row: any) => {
            prev[row.exercise_name] = row.sets_completed as SetLog[];
          });
        setPreviousLogs(prev);
        if ((!data || data.length === 0) && currentPlan?.type === "gimnasio") {
          const progressedLogs: Record<string, SetLog[]> = {};
          currentPlan.exercises?.forEach((exercise) => {
            const suggestion = getProgressionSuggestion(exercise, prev[exercise.name]);
            progressedLogs[exercise.name] = Array.from({ length: exercise.series }, () => ({
              reps: exercise.reps,
              weight: suggestion?.weight || exercise.weight || "",
              done: false,
            }));
          });
          setExerciseLogs(progressedLogs);
        }
      } else {
        setPreviousLogs({});
      }
      setLogsReady(true);
    };
    loadLogs();
    return () => {
      active = false;
    };
  }, [selectedDay, selectedDate, userId, currentPlanSignature]);

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

  const updateSet = (exerciseName: string, setIndex: number, field: keyof SetLog, value: any) => {
    setExerciseLogs((prev) => {
      const sets = [...(prev[exerciseName] || [])];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      return { ...prev, [exerciseName]: sets };
    });
  };

  const toggleSetDone = (exerciseName: string, setIndex: number, restSeconds?: number) => {
    const wasDone = exerciseLogs[exerciseName]?.[setIndex]?.done;
    updateSet(exerciseName, setIndex, "done", !wasDone);

    // Start rest timer when marking set as done
    if (!wasDone) {
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
      rpe: rpe ?? null,
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from("workout_logs").upsert(rows, {
        onConflict: "user_id,day_label,logged_at,exercise_name",
      });
      if (error) throw error;
    }
  };

  // El gimnasio no siempre tiene buena cobertura: guarda silenciosamente tras cada cambio.
  useEffect(() => {
    if (!logsReady || Object.keys(exerciseLogs).length === 0) return;
    const timeout = window.setTimeout(async () => {
      try {
        await persistLogs();
        setSavedAt(new Date());
      } catch {
        // El botón manual sigue disponible si la conexión falla.
      }
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [exerciseLogs, logsReady, selectedDay, selectedDate]);

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
      const completed = sets.filter((s) => s.done && s.weight && parseFloat(s.weight) > 0 && s.reps > 0);
      if (completed.length === 0) continue;

      // Best by estimated 1RM (Epley)
      let best = completed[0];
      let bestE1RM = parseFloat(best.weight) * (1 + best.reps / 30);
      for (const s of completed) {
        const e1rm = parseFloat(s.weight) * (1 + s.reps / 30);
        if (e1rm > bestE1RM) {
          best = s;
          bestE1RM = e1rm;
        }
      }

      // Check if it beats existing PR
      const { data: existing } = await supabase
        .from("personal_records")
        .select("estimated_1rm")
        .eq("user_id", userId)
        .eq("exercise_name", name)
        .order("estimated_1rm", { ascending: false, nullsFirst: false })
        .limit(1);

      const currentBest = existing?.[0]?.estimated_1rm ?? 0;
      if (bestE1RM > Number(currentBest)) {
        prsToInsert.push({
          user_id: userId,
          exercise_name: name,
          weight: parseFloat(best.weight),
          reps: best.reps,
          estimated_1rm: Math.round(bestE1RM * 10) / 10,
          achieved_at: selectedDate,
        });
      }
    }

    if (prsToInsert.length > 0) {
      await supabase.from("personal_records").upsert(prsToInsert, {
        onConflict: "user_id,exercise_name,weight,reps",
      });
      setPersonalRecords(prsToInsert.map((pr) => pr.exercise_name));
      toast.success(`🏆 ¡Nuevo PR en ${prsToInsert.length} ejercicio${prsToInsert.length > 1 ? "s" : ""}!`, { duration: 4000 });
    }
  };

  const saveWorkout = async () => {
    const allDone = Object.values(exerciseLogs).flat().every((s) => s.done) && Object.keys(exerciseLogs).length > 0;
    if (allDone) {
      // Force RPE before completing day
      setRpeOpen(true);
      return;
    }
    // Partial save (no RPE yet)
    setSaving(true);
    try {
      await persistLogs();
      toast.success("Progreso guardado 💪");
    } catch {
      toast.error("Error al guardar");
    }
    setSaving(false);
  };

  const handleRPEConfirm = async (rpe: number) => {
    setRpeOpen(false);
    setSaving(true);
    setRestTimer(null);
    try {
      await persistLogs(rpe);
      const { error: completionError } = await supabase.from("day_completions").upsert({
        user_id: userId,
        day_label: selectedDay,
        completed_at: selectedDate,
        rpe,
      });
      if (completionError) throw completionError;
      await detectAndSavePRs();
      setWorkoutCompleted(true);
      setShowCompletionSummary(true);
      toast.success("¡Entrenamiento completado! 💪");
    } catch {
      toast.error("Error al guardar");
    }
    setSaving(false);
  };

  const completedSets = Object.values(exerciseLogs).flat().filter((s) => s.done).length;
  const totalSets = Object.values(exerciseLogs).flat().length;
  const completedLogEntries = Object.entries(exerciseLogs).flatMap(([name, sets]) =>
    sets.filter((set) => set.done).map((set) => ({ name, set })),
  );
  const totalVolume = completedLogEntries.reduce((total, { set }) => {
    const weight = Number.parseFloat(set.weight);
    return total + (Number.isFinite(weight) && weight > 0 ? weight * Math.max(0, set.reps) : 0);
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
    <div className={showCompletionSummary
      ? "fixed inset-0 z-50 overflow-y-auto bg-background px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]"
      : "max-w-2xl mx-auto"
    }>
      <div className="flex items-center justify-end gap-2 mb-3 text-[11px] text-muted-foreground">
        {!workoutCompleted && savedAt && <span className="flex items-center gap-1"><Save className="w-3 h-3" /> Guardado automático</span>}
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
          <div className={`rounded-2xl border border-border bg-card p-4 sm:p-5 ${workoutCompleted || !completionReady ? "hidden" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Entrenamiento · {selectedDay}
                </p>
                <h3 className="truncate font-display text-lg font-bold sm:text-xl">
                  {currentPlan.routine_name || selectedDay}
                </h3>
                {currentPlan.muscle_focus && (
                  <p className="mt-1 text-sm text-muted-foreground">{currentPlan.muscle_focus}</p>
                )}
              </div>
              <div className="flex h-12 min-w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-primary/20 bg-primary/10 px-2">
                <span className="font-display text-lg font-bold leading-none text-primary">
                  {completedExercises}/{currentPlan.exercises?.length || 0}
                </span>
                <span className="mt-1 text-[9px] leading-none text-muted-foreground">hechos</span>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{started ? "Progreso del entrenamiento" : "Tu sesión de hoy"}</span>
                <span className="font-medium tabular-nums text-foreground">{completedSets}/{totalSets} series</span>
              </div>
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
                onClick={() => {
                  setStarted(true);
                  setExpandedExercise(0);
                  setSessionStartedAt((startedAt) => startedAt || new Date());
                }}
                variant="hero"
                size="lg"
                className="mt-4 h-12 w-full text-base"
              >
                Empezar entrenamiento
              </Button>
            )}
          </div>

          {!completionReady && (
            <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              Comprobando tu entrenamiento de hoy…
            </div>
          )}

          {workoutCompleted && showCompletionSummary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
                      className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center rounded-[2rem] border border-primary/30 bg-primary/10 px-4 py-8 text-center space-y-5"
            >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 ring-8 ring-primary/5">
                        <Trophy className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold font-display">Sesión completada</p>
                        <p className="mt-1 text-sm text-muted-foreground">{sessionMessage}</p>
              </div>
                      <div className="grid w-full grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-background/70 p-3 text-left">
                          <p className="text-xl font-bold">{completedExercises}/{currentPlan.exercises?.length || 0}</p>
                  <p className="text-[10px] text-muted-foreground">ejercicios</p>
                </div>
                        <div className="rounded-2xl bg-background/70 p-3 text-left">
                          <p className="text-xl font-bold">{completedSets}</p>
                  <p className="text-[10px] text-muted-foreground">series hechas</p>
                </div>
                        <div className="rounded-2xl bg-background/70 p-3 text-left">
                          <p className="text-xl font-bold">{totalVolume > 0 ? `${Math.round(totalVolume)} kg` : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">volumen movido</p>
                </div>
                        <div className="rounded-2xl bg-background/70 p-3 text-left">
                          <p className="text-xl font-bold">
                    {sessionStartedAt ? `${Math.max(1, Math.round((Date.now() - sessionStartedAt.getTime()) / 60000))} min` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">duración aprox.</p>
                </div>
              </div>
                      <div className="w-full space-y-2 text-left text-sm">
                {musclesWorked.length > 0 && (
                          <div className="rounded-2xl bg-background/50 px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Mapa muscular</p>
                                <p className="mt-1 text-xs text-muted-foreground">Zonas según las series que completaste</p>
                              </div>
                              <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                                {musclesWorked.length} {musclesWorked.length === 1 ? "grupo" : "grupos"}
                              </span>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                              {(["front", "back"] as const).map((side) => {
                                return (
                                <div key={side} className="min-w-0">
                                  <div className="relative mx-auto aspect-[399/698] w-full max-w-[11rem] overflow-hidden rounded-2xl border border-border/80 bg-[radial-gradient(ellipse_at_50%_38%,hsl(var(--primary)/.09),transparent_68%),linear-gradient(180deg,hsl(var(--secondary)/.38),hsl(var(--background)/.7))]">
                                    <MuscleMapFigure
                                      side={side}
                                      muscles={musclesWorked}
                                      intensityFor={(muscle) => getMuscleIntensity(muscleSetCounts[muscle]).fill}
                                    />
                                    <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-background/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-foreground/80 backdrop-blur-sm">
                                      {side === "front" ? "Frontal" : "Posterior"}
                                    </span>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-1.5">
                              {Object.entries(MUSCLE_INTENSITY).map(([level, intensity]) => (
                                <div key={level} className="rounded-xl border border-border/70 bg-background/50 px-2 py-2 text-center">
                                  <span className="mx-auto mb-1 block h-1.5 w-8 rounded-full" style={{ backgroundColor: intensity.fill }} />
                                  <span className="block text-[9px] font-semibold text-foreground">{intensity.label}</span>
                                  <span className="block text-[8px] text-muted-foreground">{intensity.range}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-1.5">
                              {musclesWorked.map((muscle) => (
                                <div
                                  key={muscle}
                                  className="flex min-w-0 items-center justify-between gap-2 rounded-xl border px-2.5 py-2"
                                  style={{
                                    borderColor: `${getMuscleIntensity(muscleSetCounts[muscle]).fill}55`,
                                    backgroundColor: `${getMuscleIntensity(muscleSetCounts[muscle]).fill}12`,
                                  }}
                                >
                                  <span className="truncate text-[10px] font-medium text-foreground">{muscle}</span>
                                  <span className="shrink-0 text-[9px] font-semibold tabular-nums" style={{ color: getMuscleIntensity(muscleSetCounts[muscle]).fill }}>
                                    {muscleSetCounts[muscle]} series
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="mt-2 text-center text-[9px] text-muted-foreground">
                              Estimación visual según las series completadas por grupo muscular.
                            </p>
                          </div>
                        )}
                        {personalRecords.length > 0 && (
                          <div className="flex items-center gap-2 rounded-2xl bg-primary/15 px-4 py-3 text-primary">
                            <BarChart3 className="h-4 w-4 shrink-0" />
                            <p><span className="font-semibold">Récord:</span> {personalRecords.join(" · ")}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Tu progreso y tus récords están guardados.</p>
                      <Button
                        type="button"
                        variant="hero"
                        className="h-12 w-full rounded-2xl text-base"
                        onClick={onExit}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver al inicio
                      </Button>
            </motion.div>
          )}

          {workoutCompleted && !showCompletionSummary && (
            <div className="flex min-h-[calc(100dvh-12rem)] flex-col justify-center rounded-[2rem] border border-primary/25 bg-gradient-to-b from-primary/10 via-card to-card p-5 sm:p-8">
              <div className="mx-auto w-full max-w-lg text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Entrenamiento de hoy</p>
                <h2 className="mt-1 font-display text-3xl font-bold">Hecho por hoy</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Ya completaste {currentPlan.routine_name || selectedDay}. Ahora toca recuperar: mañana podrás volver a entrenar.
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
                        <span key={muscle} className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${getMuscleIntensity(muscleSetCounts[muscle]).chip}`}>
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
          {!workoutCompleted && completionReady && (currentPlan.exercises || []).map((ex, i) => {
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
            const progression = getProgressionSuggestion(ex, prevSets);

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
                      setStarted(true);
                      setExpandedExercise(i);
                      setSessionStartedAt((startedAt) => startedAt || new Date());
                    } else {
                      setExpandedExercise(isExpanded ? null : i);
                    }
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-secondary/20 sm:px-4"
                >
                  {/* Exercise image or icon */}
                  {ex.image_url ? (
                    <img
                      src={ex.image_url}
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
                    {(exerciseCategory || exerciseType) && (
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
                      </div>
                    )}
                    {progression && (
                      <p className={`mt-1 truncate text-[10px] font-medium ${
                        progression.label === "Subir" ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {progression.label === "Subir" ? "↗" : "→"} {progression.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${
                      allDone
                        ? "bg-primary/15 text-primary"
                        : doneSets > 0
                        ? "bg-secondary text-foreground"
                        : "bg-secondary/70 text-muted-foreground"
                    }`}>
                      {doneSets}/{sets.length}
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
                                Ver técnica
                              </button>
                            )}
                          </div>
                        ) : (
                          <a
                            href={exerciseVideoSearchUrl(ex.name, exerciseCategory)}
                            target="_blank"
                            rel="noreferrer"
                            className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
                          >
                            <Video className="h-3.5 w-3.5" />
                            Ver técnica
                          </a>
                        )}

                        {/* Previous session hint */}
                        {prevSets && prevSets.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2 px-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Última sesión: {prevSets.map((s) => `${s.weight || "—"}×${s.reps}`).join(", ")}</span>
                            <InfoHint text="Peso × repeticiones de la última vez que hiciste este ejercicio. Intenta igualar o superar al menos una serie para progresar." />
                          </div>
                        )}

                        {/* Column headers */}
                        <div className="grid grid-cols-[36px_1fr_1fr_44px] gap-2 text-[10px] text-muted-foreground font-semibold uppercase px-1 pb-1">
                          <span>Serie</span>
                          <span className="flex items-center gap-1">
                            Peso (kg)
                            <InfoHint text="Peso total levantado en esa serie. En ejercicios con tu propio peso corporal déjalo vacío o pon el lastre añadido." />
                          </span>
                          <span className="flex items-center gap-1">
                            Reps
                            <InfoHint text="Repeticiones que realmente completaste, aunque sean menos o más de las previstas." />
                          </span>
                          <span className="text-center flex items-center justify-center gap-1">
                            ✓
                            <InfoHint text="Marca la serie al terminarla: se inicia el temporizador de descanso y cuenta para tu progreso del día." />
                          </span>
                        </div>

                        {sets.map((set, si) => (
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
                                placeholder={progression?.weight || prevSets?.[si]?.weight || "kg"}
                                aria-label={`Peso de la serie ${si + 1} de ${ex.name}`}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                              />
                              {prevSets?.[si] && (
                                <p className="mt-1 truncate text-center text-[10px] text-muted-foreground">
                                  Antes: {prevSets[si].weight || "—"} kg
                                </p>
                              )}
                              {!prevSets?.[si] && progression && (
                                <p className="mt-1 truncate text-center text-[10px] font-medium text-primary">
                                  Sugerido: {progression.weight} kg
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
                                aria-label={`Repeticiones de la serie ${si + 1} de ${ex.name}`}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all mx-auto ${
                                set.done
                                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                  : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                              }`}
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* Save button */}
          {!workoutCompleted && completionReady && <div className="sticky bottom-3 z-20 pt-3 pb-4">
            <div className="flex items-center justify-center gap-1.5 mb-2 text-[11px] text-muted-foreground">
              <span>{savedAt ? "Guardado" : "Se guarda automáticamente"}</span>
              <InfoHint text="Si guardas a medias no pierdes nada: el día se cierra solo cuando marcas todas las series y confirmas el RPE. Ahí se detectan tus récords personales." />
            </div>
            <Button
              onClick={saveWorkout}
              disabled={saving || completedSets === 0}
              className="w-full h-12 text-base font-bold"
              variant={progressPercent === 100 ? "hero" : "default"}
              size="lg"
            >
              {saving
                ? "Guardando..."
                : progressPercent === 100
                ? "✅ Guardar y terminar"
                : `Guardar progreso (${completedSets}/${totalSets})`}
            </Button>
          </div>}
        </div>
      )}

      <RPEDialog open={rpeOpen} onConfirm={handleRPEConfirm} />
    </div>
  );
};

export default WorkoutTracker;
