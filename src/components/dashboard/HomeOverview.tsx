import { useMemo, useState } from "react";
import { ArrowRight, Check, Dumbbell, Moon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DayPlan } from "@/types/training";
import type { UserSection } from "@/components/UserSidebar";
import type { FirstWeekJourney } from "@/lib/firstWeek";

interface Props {
  dayPlans: DayPlan[];
  onNavigate: (section: UserSection) => void;
  completedToday?: boolean;
  firstWeek?: FirstWeekJourney | null;
  coaching?: boolean;
  nutrition?: boolean;
  planStatus?: string;
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const HomeOverview = ({
  dayPlans,
  onNavigate,
  completedToday = false,
  firstWeek,
  coaching = true,
  nutrition = true,
  planStatus,
}: Props) => {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayName = DAYS_ORDER[todayIndex];
  const [selectedWeekDay, setSelectedWeekDay] = useState(todayName);
  const todayPlan = dayPlans.find((plan) => plan.day === todayName);
  const selectedWeekPlan = dayPlans.find((plan) => plan.day === selectedWeekDay);
  const exerciseCount = todayPlan?.type === "gimnasio" ? todayPlan.exercises?.length ?? 0 : 0;
  const scheduledDays = useMemo(
    () => dayPlans.filter((plan) => plan.type === "gimnasio" || plan.type === "actividad"),
    [dayPlans],
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      {planStatus === "plan_pending" && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p className="font-semibold">Tu entrenador está preparando tu plan</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Te avisaremos cuando esté listo.</p>
        </div>
      )}

      {firstWeek && firstWeek.target > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            Primera semana · {firstWeek.completed} de {firstWeek.target} sesiones
          </p>
          <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min((firstWeek.completed / firstWeek.target) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="today-workout-title">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          Hoy · {todayName}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            {completedToday ? <Check className="h-5 w-5 text-primary" /> : todayPlan ? <Dumbbell className="h-5 w-5 text-primary" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="today-workout-title" className="truncate font-display text-base font-bold sm:text-lg">
              {completedToday
                ? "Entrenamiento completado"
                : todayPlan?.type === "gimnasio"
                  ? todayPlan.routine_name || "Entrenamiento"
                  : todayPlan?.type === "actividad"
                    ? todayPlan.sport || "Actividad"
                    : todayPlan
                      ? "Día de descanso"
                      : "Recuperación"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {completedToday
                ? "Buen trabajo. Tu progreso ya está guardado."
                : todayPlan?.type === "gimnasio"
                  ? [exerciseCount ? `${exerciseCount} ejercicios` : null, todayPlan.muscle_focus].filter(Boolean).join(" · ")
                  : todayPlan?.type === "actividad"
                    ? `${todayPlan.intensity} · ${todayPlan.duration}`
                    : "Hoy toca descansar y recuperarte."}
            </p>
          </div>
          {completedToday ? (
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onNavigate("progress")}>
              Progreso
            </Button>
          ) : todayPlan ? (
            <Button type="button" size="sm" className="shrink-0" onClick={() => onNavigate("training")}>
              Empezar <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </section>

      <nav aria-label="Accesos rápidos" className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("progress")}>
          Mi progreso
        </Button>
        {coaching && (
          <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("chat")}>
            Chat con entrenador
          </Button>
        )}
        {nutrition && (
          <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("nutrition")}>
            Nutrición
          </Button>
        )}
      </nav>

      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span>Plan semanal</span>
          <span className="text-xs text-muted-foreground">{scheduledDays.length} días · ver semana</span>
        </summary>
        <div className="grid grid-cols-7 gap-1 border-t border-border px-3 py-3">
          {DAYS_ORDER.map((day, index) => {
            const plan = dayPlans.find((item) => item.day === day);
            const isToday = index === todayIndex;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedWeekDay(day)}
                aria-pressed={selectedWeekDay === day}
                aria-label={`${day}${isToday ? ", hoy" : ""}: ${plan?.routine_name || plan?.sport || (plan ? "Actividad" : "Descanso")}`}
                className={`min-w-0 rounded-lg p-1.5 text-center transition-colors ${
                  selectedWeekDay === day ? "bg-primary/10 ring-1 ring-primary/40" : "bg-secondary/40 hover:bg-secondary"
                }`}
              >
                <span className={`block text-[9px] font-semibold uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day.slice(0, 2)}</span>
                <span className="mt-0.5 block text-xs">
                  {plan?.type === "gimnasio" ? "🏋️" : plan?.type === "actividad" ? "🏃" : "—"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{selectedWeekDay === todayName ? "Hoy" : selectedWeekDay}</p>
              <p className="truncate text-xs font-semibold">
                {selectedWeekPlan?.type === "gimnasio"
                  ? selectedWeekPlan.routine_name || "Entrenamiento"
                  : selectedWeekPlan?.type === "actividad"
                    ? selectedWeekPlan.sport || "Actividad"
                    : "Día de descanso"}
              </p>
            </div>
            {selectedWeekPlan?.muscle_focus && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[9px] font-medium text-primary">{selectedWeekPlan.muscle_focus}</span>
            )}
          </div>
          {selectedWeekPlan?.type === "gimnasio" && selectedWeekPlan.exercises?.length ? (
            <div className="mt-2 space-y-1">
              {selectedWeekPlan.exercises.map((exercise, index) => (
                <div key={`${exercise.name}-${index}`} className="flex min-w-0 items-center gap-2 text-[11px]">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0 flex-1 truncate">{exercise.name}</span>
                  <span className="shrink-0 text-muted-foreground">{exercise.series} × {exercise.reps}</span>
                </div>
              ))}
            </div>
          ) : selectedWeekPlan?.type === "actividad" ? (
            <p className="mt-2 text-[11px] text-muted-foreground">{selectedWeekPlan.intensity} · {selectedWeekPlan.duration}</p>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">Recuperación programada.</p>
          )}
        </div>
      </details>
    </div>
  );
};

export default HomeOverview;
