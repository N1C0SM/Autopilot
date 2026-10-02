import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, Flame, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { DayPlan } from "@/types/training";
import { toLocalDateString } from "@/lib/localDates";

interface Props {
  userId: string;
  dayPlans: DayPlan[];
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const getMonday = (date: Date) => {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(12, 0, 0, 0);
  return monday;
};

const WeeklyProgress = ({ userId, dayPlans }: Props) => {
  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayStr = toLocalDateString(today);

  const weekDates = useMemo(() => {
    const monday = getMonday(new Date());
    const dates: Record<string, string> = {};
    DAYS_ORDER.forEach((day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates[day] = toLocalDateString(d);
    });
    return dates;
  }, [todayStr]);

  useEffect(() => {
    let active = true;
    const fetchCompletions = async () => {
      setLoading(true);
      setLoadError(false);
      const weekStart = weekDates["Lunes"];
      const weekEnd = weekDates["Domingo"];

      try {
        const [completionResult, historyResult] = await Promise.all([
          supabase
            .from("day_completions")
            .select("day_label, completed_at")
            .eq("user_id", userId)
            .gte("completed_at", weekStart)
            .lte("completed_at", weekEnd),
          supabase
            .from("day_completions")
            .select("completed_at")
            .eq("user_id", userId)
            .order("completed_at", { ascending: false })
            .limit(30),
        ]);

        if (completionResult.error) throw completionResult.error;
        if (historyResult.error) throw historyResult.error;
        if (!active) return;

        const set = new Set(completionResult.data.map((completion) => completion.day_label));
        setCompletedDays(set);

        // Calculate streak
        if (historyResult.data.length > 0) {
          const uniqueDates = [...new Set(historyResult.data.map((completion) => completion.completed_at))].sort().reverse();
          let count = 0;
          const checkDate = new Date();
          checkDate.setHours(12, 0, 0, 0);

          for (const dateStr of uniqueDates) {
            const expected = toLocalDateString(checkDate);
            if (dateStr === expected) {
              count++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              // Check if yesterday
              checkDate.setDate(checkDate.getDate() - 1);
              const altExpected = toLocalDateString(checkDate);
              if (dateStr === altExpected && count === 0) {
                count++;
                checkDate.setDate(checkDate.getDate() - 1);
              } else {
                break;
              }
            }
          }
          setStreak(count);
        } else {
          setStreak(0);
        }
      } catch {
        if (!active) return;
        setLoadError(true);
        toast.error("No se pudo cargar tu progreso semanal. Comprueba la conexión e inténtalo de nuevo.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchCompletions();
    return () => {
      active = false;
    };
  }, [userId, reload, weekDates]);

  const toggleDay = async (dayLabel: string) => {
    const dateForDay = weekDates[dayLabel];
    if (!dateForDay) return;

    if (completedDays.has(dayLabel)) {
      const { error } = await supabase
        .from("day_completions")
        .delete()
        .eq("user_id", userId)
        .eq("day_label", dayLabel)
        .eq("completed_at", dateForDay);

      if (error) {
        toast.error(`No se pudo actualizar el progreso del ${dayLabel}.`);
        return;
      }
      setCompletedDays((prev) => {
        const next = new Set(prev);
        next.delete(dayLabel);
        return next;
      });
    } else {
      // Add
      const { error } = await supabase.from("day_completions").insert({
        user_id: userId,
        day_label: dayLabel,
        completed_at: dateForDay,
      });

      if (!error) {
        setCompletedDays((prev) => new Set(prev).add(dayLabel));
        toast.success(`¡${dayLabel} completado! 💪`);
      } else {
        toast.error(`No se pudo actualizar el progreso del ${dayLabel}.`);
      }
    }
  };

  const planDays = dayPlans.map((p) => p.day);
  const completedCount = planDays.filter((d) => completedDays.has(d)).length;
  const totalDays = planDays.length;
  const progressPct = totalDays > 0 ? (completedCount / totalDays) * 100 : 0;

  if (loading) return null;

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border card-shadow mb-5 sm:mb-8">
      {loadError ? (
        <div role="alert" className="py-3 text-center">
          <p className="text-sm font-semibold">No se ha podido cargar tu semana</p>
          <p className="mt-1 text-xs text-muted-foreground">Tus entrenamientos no se han modificado.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setReload((value) => value + 1)}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reintentar
          </Button>
        </div>
      ) : <>
      {/* Header with streak */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="font-bold font-display text-lg">Tu Semana</h2>
          <p className="text-sm text-muted-foreground">
            {completedCount}/{totalDays} días completados
          </p>
        </div>
        {streak > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2"
          >
            <Flame className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">{streak} días de racha</span>
          </motion.div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-secondary rounded-full mb-4 sm:mb-6 overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      {/* Day circles */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {DAYS_ORDER.map((day) => {
          const hasPlan = planDays.includes(day);
          const canSelfReport = dayPlans.some((plan) => plan.day === day && plan.type === "actividad");
          const isCompleted = completedDays.has(day);
          const isToday = weekDates[day] === todayStr;
          const label = isCompleted
            ? `${day}: completado`
            : canSelfReport
              ? `Marcar actividad del ${day} como completada`
              : hasPlan
                ? `${day}: registra todas las series en Entrenamiento para completarlo`
                : `${day}: sin entrenamiento planificado`;

          return (
            <button
              key={day}
              onClick={() => canSelfReport && toggleDay(day)}
              disabled={!canSelfReport}
              aria-label={label}
              className={`flex flex-col items-center gap-1.5 p-1.5 sm:p-2 rounded-xl transition-all duration-200 ${
                canSelfReport ? "cursor-pointer hover:bg-secondary/50" : hasPlan ? "cursor-default" : "opacity-30 cursor-default"
              } ${isToday ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""}`}
            >
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">
                {day.slice(0, 3)}
              </span>
              <AnimatePresence mode="wait">
                {isCompleted ? (
                  <motion.div
                    key="checked"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="unchecked"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Circle className={`w-8 h-8 ${hasPlan ? "text-muted-foreground/40" : "text-muted-foreground/20"}`} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      {/* Celebration */}
      {completedCount === totalDays && totalDays > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 text-center bg-primary/10 rounded-xl p-4 border border-primary/20"
        >
          <Trophy className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="font-bold font-display text-primary">¡Semana completada! 🎉</p>
          <p className="text-xs text-muted-foreground mt-1">Increíble trabajo, ¡sigue así!</p>
        </motion.div>
      )}
      </>}
    </div>
  );
};

export default WeeklyProgress;
