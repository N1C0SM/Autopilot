import { useEffect, useState } from "react";
import { ArrowRight, Check, Dumbbell, LockKeyhole, MessageCircle, Moon, Sparkles, Activity, LineChart, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { DayPlan } from "@/types/training";
import type { UserSection } from "@/components/UserSidebar";
import { formatTrainingTitle } from "@/lib/trainingDisplay";

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
  profileName?: string;
  macros?: Macros | null;
  completedThisWeek?: number;
  completedToday?: boolean;
  coaching?: boolean;
  nutrition?: boolean;
  planStatus?: string;
}

const DAYS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

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
  const calorieTarget = macros
    ? Number(macros.calories) || Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fats * 9)
    : null;
  const sessionTitle = completedToday
    ? "Entrenamiento completado"
    : todayPlan?.type === "gimnasio"
      ? formatTrainingTitle(todayPlan.routine_name, todayPlan.muscle_focus) || "Entrenamiento de fuerza"
      : todayPlan?.type === "actividad"
        ? todayPlan.sport || "Actividad"
        : "Día de recuperación";

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
    <div className="mx-auto w-full max-w-none space-y-3 sm:space-y-4 lg:max-w-3xl">
      {planStatus === "plan_pending" ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <p className="font-semibold">Tu entrenador está preparando tu plan</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Te avisaremos cuando esté listo.</p>
        </div>
      ) : (
        <>
          <div className="px-1 pb-1">
            <p className="text-xs font-semibold capitalize text-primary">
              {greetingDate}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight">
              {firstName ? `Hola, ${firstName}.` : "Hola."}
              <span className="block">
                {completedToday
                  ? "Sesión hecha. Buen trabajo."
                  : todayPlan?.type === "gimnasio"
                    ? `Hoy toca ${formatTrainingTitle(todayPlan.routine_name, todayPlan.muscle_focus)}.`
                    : todayPlan?.type === "actividad"
                      ? `Hoy toca ${todayPlan.sport || "moverte"}.`
                      : "Hoy toca recuperar."}
              </span>
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(completedToday ? "progress" : todayPlan ? "training" : "progress")}
            className="group flex w-full items-center gap-3 rounded-2xl border border-primary/50 bg-primary p-5 text-left text-primary-foreground shadow-[0_10px_32px_-18px_hsl(var(--primary)/.65)] transition-all hover:brightness-105 active:scale-[0.99]"
            aria-label={completedToday ? "Ver progreso de la sesión" : `Empezar ${sessionTitle}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                {completedToday ? <Check className="h-5 w-5" /> : todayPlan?.type === "actividad" ? <Activity className="h-5 w-5" /> : todayPlan ? <Dumbbell className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block line-clamp-2 text-base font-bold leading-tight">{sessionTitle}</span>
              <span className="block truncate text-sm text-primary-foreground/85">
                  {completedToday
                    ? "Tu registro ya está guardado"
                    : todayPlan?.type === "gimnasio"
                      ? `${exerciseCount} ${exerciseCount === 1 ? "ejercicio" : "ejercicios"}`
                      : todayPlan?.type === "actividad"
                        ? [todayPlan.intensity, todayPlan.duration].filter(Boolean).join(" · ")
                        : "Día de descanso"}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onNavigate("nutrition")}
              className="flex w-full min-w-0 items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:bg-secondary/40 active:scale-[0.99]"
            >
              <span className="relative h-12 w-12 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-border" strokeWidth="3" />
                    {nutrition && meals.length > 0 && (
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
                    )}
                  </svg>
                  {nutrition && <Utensils className="absolute inset-0 m-auto h-4 w-4 text-primary" />}
              </span>
              <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-base font-semibold">
                    Nutrición
                    {!nutrition && <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" />}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                    {nutrition
                      ? meals.length
                        ? `${doneMealCount}/${meals.length} comidas`
                        : calorieTarget
                          ? `${calorieTarget.toLocaleString("es-ES")} kcal objetivo`
                          : "Ver plan de hoy"
                      : "Plan Completo"}
                  </span>
              </span>
              {nutrition && macros ? (
                <span className="hidden gap-2 text-xs text-muted-foreground min-[390px]:flex">
                  {[
                    { label: "P", value: macros.protein },
                    { label: "C", value: macros.carbs },
                    { label: "G", value: macros.fats },
                  ].map((macro) => (
                    <span key={macro.label} className="whitespace-nowrap"><span className="font-semibold text-foreground">{macro.label}</span> {macro.value}g</span>
                  ))}
                </span>
              ) : (
                <span className="hidden text-xs text-muted-foreground min-[390px]:inline">Ver plan</span>
              )}
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("progress")}
              className="flex w-full min-w-0 items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:bg-secondary/40 active:scale-[0.99]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <LineChart className="h-5 w-5 text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">Tu semana</span>
                <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                  {sessionCount} de {scheduledDays.length} {scheduledDays.length === 1 ? "sesión" : "sesiones"}
                </span>
                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-primary transition-all"
                    style={{ width: `${scheduledDays.length ? Math.min(sessionCount / scheduledDays.length * 100, 100) : 0}%` }}
                  />
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(coaching ? "chat" : "progress")}
            className="flex w-full items-start gap-2.5 rounded-2xl bg-secondary p-4 text-left transition-colors hover:bg-secondary/80"
          >
            {coaching ? <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
            <span className="min-w-0 flex-1 text-sm leading-relaxed">
              {coaching ? (
                chatMessages.length > 0 ? (
                  <>
                    <span className="block font-semibold">Tu entrenador</span>
                    {chatMessages.slice(-2).map((message) => (
                      <span key={message.id} className="mt-1 block truncate text-muted-foreground">
                        {message.sender_id === userId && <span className="font-medium">Tú: </span>}
                        {message.content || (message.media_type === "video" ? "Vídeo" : "Foto")}
                      </span>
                    ))}
                  </>
                ) : (
                  <>
                    <span className="font-semibold">{chatError && chatLoaded ? "Chat: " : "En planes con entrenador: "}</span>
                    <span className="text-muted-foreground">
                      {chatError && chatLoaded
                        ? "no se pudieron cargar los mensajes."
                        : "recibes seguimiento humano y ajustes de tu plan."}
                    </span>
                  </>
                )
              ) : (
                <>
                  <span className="font-semibold">Tu progreso: </span>
                  <span className="text-muted-foreground">tus series, peso y fotos quedan guardados en un mismo lugar.</span>
                </>
              )}
            </span>
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
