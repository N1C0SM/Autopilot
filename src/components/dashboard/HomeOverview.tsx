import { Apple, ArrowRight, Check, Dumbbell, LockKeyhole, MessageCircle, Moon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DayPlan } from "@/types/training";
import type { UserSection } from "@/components/UserSidebar";

interface Macros {
  protein: number;
  carbs: number;
  fats: number;
  calories?: number;
}

interface Props {
  dayPlans: DayPlan[];
  onNavigate: (section: UserSection) => void;
  profileName?: string;
  profileCreatedAt?: string;
  macros?: Macros | null;
  completedThisWeek?: number;
  completedToday?: boolean;
  coaching?: boolean;
  nutrition?: boolean;
  planStatus?: string;
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const HomeOverview = ({
  dayPlans,
  onNavigate,
  profileName,
  profileCreatedAt,
  macros,
  completedThisWeek = 0,
  completedToday = false,
  coaching = true,
  nutrition = true,
  planStatus,
}: Props) => {
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const todayName = DAYS_ORDER[todayIndex];
  const todayPlan = dayPlans.find((plan) => plan.day === todayName);
  const scheduledDays = dayPlans.filter((plan) => plan.type === "gimnasio" || plan.type === "actividad");
  const exerciseCount = todayPlan?.type === "gimnasio" ? todayPlan.exercises?.length ?? 0 : 0;
  const firstName = profileName?.trim().split(/\s+/)[0];
  const greetingDate = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric" }).format(now);
  const activeWeek = profileCreatedAt
    ? Math.max(1, Math.floor((now.getTime() - new Date(profileCreatedAt).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1)
    : null;
  const sessionCount = Math.min(completedThisWeek, scheduledDays.length);
  const calorieTarget = macros
    ? Number(macros.calories) || Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fats * 9)
    : null;
  const sessionTitle = completedToday
    ? "Entrenamiento completado"
    : todayPlan?.type === "gimnasio"
      ? todayPlan.routine_name || todayPlan.muscle_focus || "Entrenamiento de fuerza"
      : todayPlan?.type === "actividad"
        ? todayPlan.sport || "Actividad"
        : "Día de recuperación";

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 sm:space-y-4">
      {planStatus === "plan_pending" ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <p className="font-semibold">Tu entrenador está preparando tu plan</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Te avisaremos cuando esté listo.</p>
        </div>
      ) : (
        <>
          <div className="px-1 pb-1">
            <p className="text-[11px] font-medium capitalize text-primary">
              {greetingDate}{activeWeek ? ` · Semana ${activeWeek}` : ""}
            </p>
            <h2 className="mt-2 font-display text-[1.65rem] font-bold leading-tight tracking-tight">
              {firstName ? `Hola, ${firstName}.` : "Hola."}
              <span className="block">
                {completedToday
                  ? "Sesión hecha. Buen trabajo."
                  : todayPlan?.type === "gimnasio"
                    ? `Hoy toca ${todayPlan.muscle_focus || todayPlan.routine_name || "entrenar"}.`
                    : todayPlan?.type === "actividad"
                      ? `Hoy toca ${todayPlan.sport || "moverte"}.`
                      : "Hoy toca recuperar."}
              </span>
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(completedToday ? "progress" : "training")}
            disabled={!completedToday && !todayPlan}
            className={`group flex min-h-[6.5rem] w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all active:scale-[0.99] disabled:cursor-default ${
              completedToday
                ? "border-primary/25 bg-primary/10 text-foreground"
                : "border-primary/50 bg-primary text-primary-foreground shadow-[0_10px_32px_-18px_hsl(var(--primary)/.65)] hover:brightness-105"
            }`}
            aria-label={completedToday ? "Ver progreso de la sesión" : `Empezar ${sessionTitle}`}
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${completedToday ? "bg-primary/15" : "bg-black/10"}`}>
              {completedToday ? <Check className="h-5 w-5" /> : todayPlan ? <Dumbbell className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-base font-bold sm:text-lg">{sessionTitle}</span>
              <span className={`mt-0.5 block truncate text-xs ${completedToday ? "text-muted-foreground" : "text-primary-foreground/75"}`}>
                {completedToday
                  ? "Tu registro ya está guardado"
                  : todayPlan?.type === "gimnasio"
                    ? `${exerciseCount} ${exerciseCount === 1 ? "ejercicio" : "ejercicios"}${todayPlan.muscle_focus ? ` · ${todayPlan.muscle_focus}` : ""}`
                    : todayPlan?.type === "actividad"
                      ? [todayPlan.intensity, todayPlan.duration].filter(Boolean).join(" · ")
                      : "Día de descanso programado"}
              </span>
            </span>
            {todayPlan || completedToday ? <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" /> : null}
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate("nutrition")}
              className="min-w-0 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/30 active:bg-secondary/40"
            >
              <div className="flex items-center gap-1.5">
                <Apple className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate text-xs font-semibold">{nutrition ? "Nutrición" : "Nutrición"}</span>
                {!nutrition && <LockKeyhole className="h-3 w-3 shrink-0 text-muted-foreground" />}
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {nutrition
                  ? calorieTarget ? `${calorieTarget.toLocaleString("es-ES")} kcal objetivo` : "Ver plan de hoy"
                  : "Incluida en Plan Completo"}
              </p>
              {nutrition && macros ? (
                <div className="mt-2.5 flex items-center gap-2 text-[9px] text-muted-foreground">
                  {[
                    { label: "P", value: macros.protein },
                    { label: "C", value: macros.carbs },
                    { label: "G", value: macros.fats },
                  ].map((macro) => (
                    <span key={macro.label} className="whitespace-nowrap">{macro.label} {macro.value}g</span>
                  ))}
                </div>
              ) : (
                <div className="mt-2.5 flex h-1 items-center">
                  <div className={`h-1 w-2/3 rounded-full ${nutrition ? "bg-primary/70" : "bg-secondary"}`} />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate("progress")}
              className="min-w-0 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/30 active:bg-secondary/40"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate text-xs font-semibold">Tu semana</span>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {sessionCount} de {scheduledDays.length} {scheduledDays.length === 1 ? "sesión" : "sesiones"}
              </p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${scheduledDays.length ? Math.min(sessionCount / scheduledDays.length * 100, 100) : 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-[9px] text-muted-foreground">Progreso, peso y fotos</p>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(coaching ? "chat" : "progress")}
            className="flex w-full items-start gap-2.5 rounded-2xl bg-secondary/70 px-3.5 py-3 text-left transition-colors hover:bg-secondary"
          >
            {coaching ? (
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            )}
            <span className="min-w-0 text-xs leading-relaxed">
              <span className="font-semibold">{coaching ? "Tu entrenador: " : "Tu progreso: "}</span>
              <span className="text-muted-foreground">
                {coaching
                  ? "recibes seguimiento humano y ajustes de tu plan."
                  : "tus series, peso y fotos quedan guardados en un mismo lugar."}
              </span>
            </span>
            {coaching && <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </button>

          {!scheduledDays.length && (
            <Button type="button" variant="outline" className="w-full" onClick={() => onNavigate("training")}>
              <Dumbbell className="mr-2 h-4 w-4" /> Ver mi plan de entrenamiento
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default HomeOverview;
