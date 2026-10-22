import { useState, useEffect, useMemo } from "react";
import { IconTile } from "@/components/ui/icon-tile";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { hapticTap } from "@/lib/native";
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

const WeeklyProgress = ({ userId, dayPlans, compact = false }: Props) => {
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
        toast.success(`${dayLabel} completado`);
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
    <Surface padding={compact ? "sm" : "md"} className={compact ? undefined : "mb-6"}>
      {loadError ? (
        <div role="alert" className="py-2">
          <p className="type-headline">No se ha podido cargar tu semana</p>
          <p className="mt-0.5 type-footnote text-muted-foreground">Tus entrenamientos no se han modificado.</p>
          <Button
            type="button"
            variant="tinted"
            size="sm"
            className="mt-3"
            onClick={() => {
              void hapticTap();
              setReload((value) => value + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      ) : <>
      {compact ? (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="type-headline">Esta semana</h2>
          <p className="type-footnote tabular-nums text-muted-foreground">{completedCount}/{totalDays} sesiones{streak > 0 ? ` · ${streak} d racha` : ""}</p>
        </div>
      ) : (
      <div className="mb-3">
        <h2 className="type-headline">Sesiones esta semana</h2>
        <p className="mt-0.5 type-footnote tabular-nums text-muted-foreground">
          {completedCount} de {totalDays} sesiones previstas · la rutina marca tus días
          {streak > 0 ? ` · ${streak} días de racha` : ""}
        </p>
      </div>
      )}

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
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
              type="button"
              onClick={() => {
                if (!canSelfReport) return;
                void hapticTap();
                void toggleDay(day);
              }}
              disabled={!canSelfReport}
              aria-pressed={isCompleted}
              aria-label={label}
              className={`flex h-11 items-center justify-center rounded-full type-footnote font-semibold transition-[background-color,opacity] duration-150 ease-out ${
                compact ? "md:h-8" : "md:h-10"
              } ${
                isCompleted
                  ? "bg-primary text-primary-foreground"
                  : `${hasPlan ? "bg-secondary" : ""} ${isToday ? "text-primary" : hasPlan ? "text-muted-foreground" : "text-muted-foreground/60"}`
              } ${canSelfReport ? "active:opacity-60" : "cursor-default"}`}
            >
              {DAYS_SHORT[index]}
            </button>
          );
        })}
      </div>

      {!compact && completedCount === totalDays && totalDays > 0 && (
        <div className="mt-4 flex items-center gap-3 pt-4 sep-t">
          <IconTile icon={Trophy} />
          <div className="min-w-0">
            <p className="type-headline">Semana completada</p>
            <p className="type-footnote text-muted-foreground">Increíble trabajo, sigue así.</p>
          </div>
        </div>
      )}
      </>}
    </Surface>
  );
};

export default WeeklyProgress;
