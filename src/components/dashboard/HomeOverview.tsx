import { useEffect, useState } from "react";
import { Check, Dumbbell, LockKeyhole, Moon, Activity, LineChart, Utensils, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { supabase } from "@/integrations/supabase/client";
import type { DayPlan } from "@/types/training";
import type { UserSection } from "@/components/UserSidebar";
import { formatTrainingTitle } from "@/lib/trainingDisplay";
import { hapticTap } from "@/lib/native";
import { nutritionMacroError } from "@/lib/nutritionValidation";

interface Macros {
  protein: number;
  carbs: number;
  fats: number;
  calories?: number;
}

interface Meal {
  name: string;
  description: string;
}

interface Props {
  dayPlans: DayPlan[];
  meals?: Meal[];
  userId?: string;
  onNavigate: (section: UserSection) => void;
  onStartWorkout?: () => void;
  profileName?: string;
  macros?: Macros | null;
  completedThisWeek?: number;
  completedToday?: boolean;
  coaching?: boolean;
  nutrition?: boolean;
  planStatus?: string;
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// Tarjeta pulsable: se separa del fondo por color y se resalta al pulsar, como una fila.
const CARD_CLASS =
  "rounded-2xl bg-card p-4 text-left transition-[background-color,filter] duration-100 ease-ios-standard hover:brightness-110 active:bg-accent";
const ICON_BOX_CLASS = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary";
const CHEVRON_CLASS = "h-4 w-4 shrink-0 text-muted-foreground/60";

interface ChatPreviewMessage {
  id: string;
  sender_id: string;
  content: string;
  media_type: string | null;
  created_at: string;
}

const HomeOverview = ({
  dayPlans,
  meals = [],
  userId,
  onNavigate,
  onStartWorkout,
  profileName,
  macros,
  completedThisWeek = 0,
  completedToday = false,
  coaching = true,
  nutrition = true,
  planStatus,
}: Props) => {
  const [chatMessages, setChatMessages] = useState<ChatPreviewMessage[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [completedMeals, setCompletedMeals] = useState<Set<string>>(new Set());
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const todayName = DAYS_ORDER[todayIndex];
  const todayPlan = dayPlans.find((plan) => plan.day === todayName);
  const scheduledDays = dayPlans.filter((plan) => plan.type === "gimnasio" || plan.type === "actividad");
  const exerciseCount = todayPlan?.type === "gimnasio" ? todayPlan.exercises?.length ?? 0 : 0;
  const firstName = profileName?.trim().split(/\s+/)[0];
  const greetingDate = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric" }).format(now);
  const sessionCount = Math.min(completedThisWeek, scheduledDays.length);
  const doneMealCount = meals.filter((meal) => completedMeals.has(meal.name)).length;
  const mealProgress = meals.length
    ? doneMealCount / meals.length
    : 0;
  const macroError = macros ? nutritionMacroError(macros) : null;
  const calorieTarget = macros && !macroError
    ? Number(macros.calories) || Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fats * 9)
    : null;
  const sessionTitle = completedToday
    ? "Entrenamiento completado"
    : todayPlan?.type === "gimnasio"
      ? formatTrainingTitle(todayPlan.routine_name, todayPlan.muscle_focus) || "Entrenamiento de fuerza"
      : todayPlan?.type === "actividad"
        ? todayPlan.sport || "Actividad"
        : "Día de recuperación";
  const sessionDetail = completedToday
    ? "Tu registro ya está guardado"
    : todayPlan?.type === "gimnasio"
      ? `${exerciseCount} ${exerciseCount === 1 ? "ejercicio" : "ejercicios"}`
      : todayPlan?.type === "actividad"
        ? [todayPlan.intensity, todayPlan.duration].filter(Boolean).join(" · ")
        : "";
  const nutritionSummary = nutrition
    ? meals.length
      ? `${doneMealCount}/${meals.length} comidas`
      : calorieTarget
        ? `${calorieTarget.toLocaleString("es-ES")} kcal objetivo`
        : "Ver plan de hoy"
    : "Plan de nutrición";
  const nutritionNote = macroError ? "Objetivos por revisar" : nutrition ? "Ver plan de hoy" : "Incluido en Plus";
  const canStart = !completedToday && Boolean(todayPlan);
  const sessionAction = completedToday ? "Ver progreso" : todayPlan ? "Empezar" : "Ver rutina semanal";
  const SessionIcon = completedToday ? Check : todayPlan?.type === "actividad" ? Activity : todayPlan ? Dumbbell : Moon;

  useEffect(() => {
    const date = new Date();
    const key = `meals_done_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) setCompletedMeals(new Set(JSON.parse(saved) as string[]));
    } catch {
      setCompletedMeals(new Set());
    }
  }, []);

  useEffect(() => {
    if (!userId || !coaching) return;
    let active = true;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, sender_id, content, media_type, created_at")
        .eq("conversation_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2);
      if (!active) return;
      if (error) {
        setChatError(true);
      } else {
        setChatMessages((data || []).reverse());
      }
      setChatLoaded(true);
    };

    void loadMessages();
    const channel = supabase
      .channel(`home-chat-preview-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_user_id=eq.${userId}`,
      }, (payload) => {
        if (!active) return;
        const message = payload.new as ChatPreviewMessage;
        setChatMessages((current) => [...current, message].slice(-2));
        setChatError(false);
        setChatLoaded(true);
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, coaching]);

  return (
    <div className="mx-auto w-full max-w-none space-y-6 lg:max-w-3xl">
      {planStatus === "plan_pending" ? (
        <Surface>
          <p className="type-headline">Tu entrenador está preparando tu plan</p>
          <p className="mt-0.5 type-footnote text-muted-foreground">Te avisaremos cuando esté listo.</p>
        </Surface>
      ) : (
        <>
          <div>
            <p className="type-group-header font-semibold">
              {greetingDate}
            </p>
            <h2 className="mt-0.5 type-large-title">
              {firstName ? `Hola, ${firstName}.` : "Hola."}
              <span className="block text-muted-foreground">
                {completedToday
                  ? "Buen trabajo."
                  : todayPlan?.type === "gimnasio"
                    ? "A entrenar."
                    : todayPlan?.type === "actividad"
                      ? `A ${todayPlan.sport || "moverte"}.`
                      : "Hoy, a recuperar."}
              </span>
            </h2>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                void hapticTap();
                if (completedToday) onNavigate("progress");
                else if (todayPlan) {
                  if (onStartWorkout) onStartWorkout();
                  else onNavigate("training");
                } else onNavigate("training");
              }}
              className={`${CARD_CLASS} block w-full sm:flex sm:items-center sm:gap-4`}
              aria-label={completedToday ? "Ver progreso de la sesión" : todayPlan ? `Empezar ${sessionTitle}` : "Ver rutina semanal"}
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className={ICON_BOX_CLASS}>
                  <SessionIcon className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 type-title3">{sessionTitle}</span>
                  {sessionDetail && (
                    <span className="mt-0.5 block truncate type-subhead text-muted-foreground">{sessionDetail}</span>
                  )}
                </span>
              </span>
              <span
                className={`mt-4 flex h-[50px] w-full shrink-0 items-center justify-center rounded-[14px] px-5 type-headline sm:mt-0 sm:h-11 sm:w-auto sm:min-w-[9rem] sm:rounded-xl ${
                  canStart ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                }`}
              >
                {sessionAction}
              </span>
            </button>

            <div className="flex items-stretch gap-3">
              <button
                type="button"
                onClick={() => { void hapticTap(); onNavigate("nutrition"); }}
                className={`${CARD_CLASS} flex min-w-0 flex-1 flex-col`}
              >
                <span className="flex w-full items-start justify-between">
                  {nutrition && meals.length > 0 ? (
                    <span className="relative h-11 w-11 shrink-0">
                      <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90" aria-hidden="true">
                        <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-secondary" strokeWidth="3" />
                        <circle
                          cx="18"
                          cy="18"
                          r="15.5"
                          fill="none"
                          className="stroke-primary"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray="97.4"
                          strokeDashoffset={97.4 * (1 - mealProgress)}
                        />
                      </svg>
                      <Utensils className="absolute inset-0 m-auto h-[18px] w-[18px] text-primary" strokeWidth={2} aria-hidden="true" />
                    </span>
                  ) : (
                    <span className={ICON_BOX_CLASS}>
                      {nutrition
                        ? <Utensils className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />
                        : <LockKeyhole className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />}
                    </span>
                  )}
                  <ChevronRight className={CHEVRON_CLASS} strokeWidth={2.5} aria-hidden="true" />
                </span>
                <span className="mt-3 block type-headline">Nutrición</span>
                <span className="mt-0.5 block type-footnote tabular-nums text-muted-foreground">{nutritionSummary}</span>
                {nutrition && macros && !macroError ? (
                  <span className="mt-auto flex w-full flex-wrap gap-x-2 gap-y-0.5 pt-3 type-caption1 tabular-nums text-muted-foreground">
                    {[
                      { label: "P", value: macros.protein },
                      { label: "C", value: macros.carbs },
                      { label: "G", value: macros.fats },
                    ].map((macro) => (
                      <span key={macro.label} className="whitespace-nowrap"><span className="font-semibold text-foreground">{macro.label}</span> {macro.value}g</span>
                    ))}
                  </span>
                ) : nutritionNote !== nutritionSummary ? (
                  <span className="mt-auto block pt-3 type-caption1 text-muted-foreground">{nutritionNote}</span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => { void hapticTap(); onNavigate("progress"); }}
                className={`${CARD_CLASS} flex min-w-0 flex-1 flex-col`}
              >
                <span className="flex w-full items-start justify-between">
                  <span className={ICON_BOX_CLASS}>
                    <LineChart className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <ChevronRight className={CHEVRON_CLASS} strokeWidth={2.5} aria-hidden="true" />
                </span>
                <span className="mt-3 block type-headline">Progreso</span>
                <span className="mt-0.5 block type-footnote tabular-nums text-muted-foreground">
                  {sessionCount} de {scheduledDays.length} {scheduledDays.length === 1 ? "sesión" : "sesiones"}
                </span>
                <span className="mt-auto block w-full pt-3">
                  <span className="block h-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-ios"
                      style={{ width: `${scheduledDays.length ? Math.min(sessionCount / scheduledDays.length * 100, 100) : 0}%` }}
                    />
                  </span>
                </span>
              </button>
            </div>
          </div>

          {!scheduledDays.length && (
            <Button type="button" variant="tinted" className="w-full" onClick={() => { void hapticTap(); onNavigate("training"); }}>
              Ver mi plan de entrenamiento
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default HomeOverview;
