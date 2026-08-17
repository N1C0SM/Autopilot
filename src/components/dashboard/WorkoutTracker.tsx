import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Dumbbell, ChevronDown, ChevronUp, Flame, Clock,
  Timer, TrendingUp, RotateCcw, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DayPlan } from "@/types/training";
import RPEDialog from "./RPEDialog";
import VideoEmbed from "@/components/VideoEmbed";
import InfoHint from "@/components/InfoHint";

interface SetLog {
  reps: number;
  weight: string;
  done: boolean;
}

interface Props {
  userId: string;
  dayPlans: DayPlan[];
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const WorkoutTracker = ({ userId, dayPlans }: Props) => {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const [selectedDay, setSelectedDay] = useState<string>(DAYS_ORDER[todayIndex]);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, SetLog[]>>({});
  const [previousLogs, setPreviousLogs] = useState<Record<string, SetLog[]>>({});
  const [saving, setSaving] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restTarget, setRestTarget] = useState(0);
  const [rpeOpen, setRpeOpen] = useState(false);
  const [videosByName, setVideosByName] = useState<Record<string, string>>({});
  const [showVideo, setShowVideo] = useState<Record<string, boolean>>({});

  // Cargar URLs de vídeo de la biblioteca de ejercicios (mapeado por nombre)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("exercises")
        .select("name, video_url")
        .not("video_url", "is", null);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((row: any) => {
          if (row.video_url) map[row.name] = row.video_url;
        });
        setVideosByName(map);
      }
    })();
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];
  const currentPlan = dayPlans.find((p) => p.day === selectedDay);

  // Auto-expand first exercise on day change
  useEffect(() => {
    if (currentPlan?.type === "gimnasio" && currentPlan.exercises?.length) {
      setExpandedExercise(0);
    } else {
      setExpandedExercise(null);
    }
  }, [selectedDay]);

  // Load existing logs + previous session
  useEffect(() => {
    const loadLogs = async () => {
      // Today's logs
      const { data } = await supabase
        .from("workout_logs")
        .select("exercise_name, sets_completed")
        .eq("user_id", userId)
        .eq("day_label", selectedDay)
        .eq("logged_at", todayStr);

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
        .lt("logged_at", todayStr)
        .order("logged_at", { ascending: false })
        .limit(20);

      if (prevData && prevData.length > 0) {
        const lastDate = prevData[0].logged_at;
        const prev: Record<string, SetLog[]> = {};
        prevData
          .filter((r: any) => r.logged_at === lastDate)
          .forEach((row: any) => {
            prev[row.exercise_name] = row.sets_completed as SetLog[];
          });
        setPreviousLogs(prev);
      } else {
        setPreviousLogs({});
      }
    };
    loadLogs();
  }, [selectedDay, userId, todayStr]);

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
    if (!wasDone && restSeconds) {
      setRestTarget(restSeconds);
      setRestTimer(restSeconds);
    }
  };

  const parseRestSeconds = (rest: string): number => {
    const match = rest.match(/(\d+)/);
    return match ? parseInt(match[1]) : 60;
  };

  const persistLogs = async (rpe?: number) => {
    await supabase
      .from("workout_logs")
      .delete()
      .eq("user_id", userId)
      .eq("day_label", selectedDay)
      .eq("logged_at", todayStr);

    const rows = Object.entries(exerciseLogs).map(([name, sets]) => ({
      user_id: userId,
      day_label: selectedDay,
      exercise_name: name,
      sets_completed: JSON.parse(JSON.stringify(sets)),
      logged_at: todayStr,
      rpe: rpe ?? null,
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from("workout_logs").insert(rows);
      if (error) throw error;
    }
  };

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
          achieved_at: todayStr,
        });
      }
    }

    if (prsToInsert.length > 0) {
      await supabase.from("personal_records").upsert(prsToInsert, {
        onConflict: "user_id,exercise_name,weight,reps",
      });
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
    try {
      await persistLogs(rpe);
      await supabase.from("day_completions").upsert({
        user_id: userId,
        day_label: selectedDay,
        completed_at: todayStr,
        rpe,
      });
      await detectAndSavePRs();
      toast.success("¡Entrenamiento completado! 💪");
    } catch {
      toast.error("Error al guardar");
    }
    setSaving(false);
  };

  const completedSets = Object.values(exerciseLogs).flat().filter((s) => s.done).length;
  const totalSets = Object.values(exerciseLogs).flat().length;
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Ayuda general */}
      <div className="flex items-center gap-1.5 mb-2 text-[11px] text-muted-foreground">
        <span>Elige el día y registra tus series</span>
        <InfoHint text="🏋️ = día de gimnasio · 🏃 = actividad · sin icono = descanso. El día de hoy aparece resaltado. Puedes registrar cualquier día de la semana." />
      </div>
      {/* Day selector pills */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-2 scrollbar-hide">
        {DAYS_ORDER.map((day) => {
          const plan = dayPlans.find((p) => p.day === day);
          const isSelected = day === selectedDay;
          const isToday = day === DAYS_ORDER[todayIndex];
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`flex flex-col items-center px-3 py-2.5 rounded-xl text-xs font-medium transition-all shrink-0 min-w-[48px] ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : plan
                  ? "bg-card border border-border hover:border-primary/30"
                  : "bg-card/30 border border-border/30 opacity-40"
              } ${isToday && !isSelected ? "ring-2 ring-primary/30" : ""}`}
            >
              <span className="font-bold">{day.slice(0, 3)}</span>
              {plan && (
                <span className="text-[10px] mt-0.5 opacity-80">
                  {plan.type === "gimnasio" ? "🏋️" : "🏃"}
                </span>
              )}
            </button>
          );
        })}
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
        <div className="space-y-3">
          {/* Header with routine name + progress */}
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="font-display font-bold text-base">
                  {currentPlan.routine_name || selectedDay}
                </h3>
                {currentPlan.muscle_focus && (
                  <p className="text-xs text-muted-foreground">{currentPlan.muscle_focus}</p>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-2xl font-bold font-display text-gradient">
                    {completedSets}/{totalSets}
                  </span>
                  <InfoHint text="Series marcadas como completadas hoy sobre el total previsto. Al llegar al 100% podrás cerrar el día indicando tu RPE." />
                </div>
                <p className="text-[10px] text-muted-foreground">series</p>
              </div>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden mt-3">
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Rest timer floating */}
          <AnimatePresence>
            {restTimer !== null && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium">Descanso</span>
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
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Exercise list */}
          {(currentPlan.exercises || []).map((ex, i) => {
            const isExpanded = expandedExercise === i;
            const sets = exerciseLogs[ex.name] || [];
            const doneSets = sets.filter((s) => s.done).length;
            const allDone = doneSets === sets.length && sets.length > 0;
            const prevSets = previousLogs[ex.name];
            const restSec = parseRestSeconds(ex.rest);

            return (
              <motion.div
                key={`${selectedDay}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-card rounded-xl border overflow-hidden transition-colors ${
                  allDone ? "border-primary/40" : "border-border"
                }`}
              >
                {/* Exercise header */}
                <button
                  onClick={() => setExpandedExercise(isExpanded ? null : i)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/20 transition-colors"
                >
                  {/* Exercise image or icon */}
                  {ex.image_url ? (
                    <img
                      src={ex.image_url}
                      alt={ex.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      allDone ? "bg-primary/20" : "bg-secondary"
                    }`}>
                      <Dumbbell className={`w-4 h-4 ${allDone ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className={`font-medium text-sm ${allDone ? "text-primary" : ""}`}>
                      {ex.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {ex.series} series × {ex.reps} reps · {ex.rest} descanso
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      allDone
                        ? "bg-primary/20 text-primary"
                        : doneSets > 0
                        ? "bg-secondary text-foreground"
                        : "bg-secondary text-muted-foreground"
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
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-1.5">
                        {/* Vídeo del ejercicio */}
                        {(ex.video_url || videosByName[ex.name]) && (
                          <div className="mb-2">
                            {showVideo[ex.name] ? (
                              <div className="space-y-1.5">
                                <VideoEmbed url={ex.video_url || videosByName[ex.name]} />
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
                                Ver vídeo del ejercicio
                              </button>
                            )}
                          </div>
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
                            <input
                              type="text"
                              inputMode="decimal"
                              value={set.weight}
                              onChange={(e) => updateSet(ex.name, si, "weight", e.target.value)}
                              placeholder={prevSets?.[si]?.weight || "kg"}
                              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                            />

                            {/* Reps input */}
                            <input
                              type="text"
                              inputMode="numeric"
                              value={set.reps}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) updateSet(ex.name, si, "reps", val);
                              }}
                              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                            />

                            {/* Done toggle */}
                            <button
                              onClick={() => toggleSetDone(ex.name, si, restSec)}
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
          <div className="pt-3 pb-4">
            <div className="flex items-center justify-center gap-1.5 mb-2 text-[11px] text-muted-foreground">
              <span>Guarda cuando quieras, aunque no acabes</span>
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
                ? "✅ Completar entrenamiento"
                : `Guardar progreso (${completedSets}/${totalSets})`}
            </Button>
          </div>
        </div>
      )}

      <RPEDialog open={rpeOpen} onConfirm={handleRPEConfirm} />
    </div>
  );
};

export default WorkoutTracker;
