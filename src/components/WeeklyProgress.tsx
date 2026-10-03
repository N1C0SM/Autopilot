import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { DayPlan } from "@/types/training";
import { toLocalDateString } from "@/lib/localDates";

interface Props {
  compact?: boolean;
  userId: string;
  dayPlans: DayPlan[];
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAYS_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

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
    const [year, month, day] = todayStr.split("-").map(Number);
    const monday = getMonday(new Date(year, month - 1, day, 12));
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
      <div className="mb-3">
        <div>
          <h2 className="font-bold font-display text-sm">Sesiones esta semana</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {completedCount} de {totalDays} sesiones previstas · la rutina marca tus días
            {streak > 0 ? ` · ${streak} días de racha` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {DAYS_ORDER.map((day, index) => {
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
              aria-pressed={isCompleted}
              aria-label={label}
              className={`flex h-10 items-center justify-center rounded-xl text-xs font-semibold transition-all duration-200 ${
                isCompleted
                  ? "bg-primary text-primary-foreground"
                  : hasPlan
                    ? "bg-secondary text-muted-foreground"
                    : "bg-secondary/50 text-muted-foreground/50"
              } ${canSelfReport ? "cursor-pointer hover:brightness-110" : "cursor-default"} ${
                isToday && !isCompleted ? "border border-dashed border-primary text-foreground" : "border border-transparent"
              }`}
            >
              {DAYS_SHORT[index]}
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
