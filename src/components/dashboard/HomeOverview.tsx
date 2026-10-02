import { useEffect, useState } from "react";
import { Apple, ArrowRight, Check, Dumbbell, LockKeyhole, MessageCircle, Moon, Sparkles, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const todayName = DAYS_ORDER[todayIndex];
  const todayPlan = dayPlans.find((plan) => plan.day === todayName);
  const scheduledDays = dayPlans.filter((plan) => plan.type === "gimnasio" || plan.type === "actividad");
  const exerciseCount = todayPlan?.type === "gimnasio" ? todayPlan.exercises?.length ?? 0 : 0;
  const firstName = profileName?.trim().split(/\s+/)[0];
  const greetingDate = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric" }).format(now);
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
            <p className="text-[11px] font-medium capitalize text-primary">
              {greetingDate}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold leading-tight tracking-tight">
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
            onClick={() => onNavigate(completedToday ? "progress" : todayPlan ? "training" : "progress")}
            className={`group w-full rounded-2xl border p-4 text-left transition-all active:scale-[0.99] sm:p-5 ${
              completedToday
                ? "border-primary/25 bg-card"
                : "border-[#DDA34B] bg-[#DDA34B] text-black shadow-[0_10px_32px_-18px_rgba(221,163,75,0.65)] hover:brightness-105"
            }`}
            aria-label={completedToday ? "Ver progreso de la sesión" : `Empezar ${sessionTitle}`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${completedToday ? "text-primary" : "text-primary-foreground/75"}`}>
                Tu semana · {sessionCount}/{scheduledDays.length} sesiones
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="mt-3 flex min-w-0 items-center gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${completedToday ? "text-primary" : ""}`}>
                {completedToday ? <Check className="h-5 w-5" /> : todayPlan?.type === "actividad" ? <Activity className="h-5 w-5" /> : todayPlan ? <Dumbbell className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{sessionTitle}</span>
                <span className={`mt-0.5 block truncate text-sm ${completedToday ? "text-muted-foreground" : "text-primary-foreground/75"}`}>
                  {completedToday
                    ? "Tu registro ya está guardado"
                    : todayPlan?.type === "gimnasio"
                      ? [todayPlan.muscle_focus, `${exerciseCount} ${exerciseCount === 1 ? "ejercicio" : "ejercicios"}`].filter(Boolean).join(" · ")
                      : todayPlan?.type === "actividad"
                        ? [todayPlan.intensity, todayPlan.duration].filter(Boolean).join(" · ")
                        : "Día de descanso"}
                </span>
              </span>
            </span>
            <span className={`mt-4 block h-1.5 overflow-hidden rounded-full ${completedToday ? "bg-secondary" : "bg-black/15"}`}>
              <span
                className={`block h-full rounded-full ${completedToday ? "bg-primary" : "bg-primary-foreground/75"}`}
                style={{ width: `${scheduledDays.length ? Math.min(sessionCount / scheduledDays.length * 100, 100) : 0}%` }}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("nutrition")}
            className="flex w-full min-w-0 items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 active:bg-secondary/40 sm:p-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Apple className="h-5 w-5 text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-base font-semibold">Nutrición</span>
                {!nutrition && <LockKeyhole className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                {nutrition
                  ? calorieTarget ? `${calorieTarget.toLocaleString("es-ES")} kcal objetivo` : "Ver plan de hoy"
                  : "Incluida en Plan Completo"}
              </span>
              {nutrition && macros && (
                <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {[
                    { label: "P", value: macros.protein },
                    { label: "C", value: macros.carbs },
                    { label: "G", value: macros.fats },
                  ].map((macro) => (
                    <span key={macro.label} className="whitespace-nowrap">{macro.label} · {macro.value}g</span>
                  ))}
                </span>
              )}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate(coaching ? "chat" : "progress")}
            className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 active:bg-secondary/40 sm:p-5"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <MessageCircle className="h-5 w-5 shrink-0 text-primary" />
                <span className="truncate font-semibold">{coaching ? "Chat con tu entrenador" : "Tu progreso"}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </span>
            {coaching ? (
              <span className="mt-3 block space-y-2">
                {chatMessages.length ? chatMessages.map((message) => (
                  <span key={message.id} className={`block max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                    message.sender_id === userId ? "ml-auto bg-primary/10 text-foreground" : "bg-secondary/70 text-foreground"
                  }`}>
                    <span className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">
                      {message.sender_id === userId ? "Tú" : "Entrenador"}
                    </span>
                    <span className="block line-clamp-2 break-words">
                      {message.content || (message.media_type === "video" ? "Vídeo" : "Foto")}
                    </span>
                  </span>
                )) : (
                  <span className="block text-sm text-muted-foreground">
                    {chatError
                      ? "No se pudieron cargar los mensajes. Abre el chat para volver a intentarlo."
                      : chatLoaded
                        ? "Aún no hay mensajes. Escribe a tu entrenador cuando quieras."
                        : "Tus mensajes con el entrenador aparecerán aquí."}
                  </span>
                )}
              </span>
            ) : (
              <span className="mt-2 block text-sm text-muted-foreground">Tus series, peso y fotos quedan guardados en un mismo lugar.</span>
            )}
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
