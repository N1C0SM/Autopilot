import { hasCoaching, hasNutrition, getConsumerPlan, type ConsumerPlan } from "@/lib/entitlements";
import { PlanPaywall, CoachPendingAssignment } from "@/components/dashboard/PlanPaywall";
import { parseMacroTargets } from "@/lib/nutrition";
import CoachingOffer from "@/components/dashboard/CoachingOffer";
import { track } from "@/lib/analytics";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Apple, Clock, Loader2, Crown, Dumbbell, UtensilsCrossed, MessageCircle, Lock, Video, Sparkles, BookOpen } from "lucide-react";
import { Download } from "lucide-react";
import NotificationsBell from "@/components/NotificationsBell";
import { toast } from "sonner";
import { motion } from "framer-motion";
import type { DayPlan } from "@/types/training";
import WeeklyProgress from "@/components/WeeklyProgress";
import HomeOverview from "@/components/dashboard/HomeOverview";
import TravelModeCard from "@/components/dashboard/TravelModeCard";
import RenewalFlow from "@/components/dashboard/RenewalFlow";
import UserSidebar from "@/components/UserSidebar";
import type { UserSection } from "@/components/UserSidebar";
import SettingsPanel from "@/components/SettingsPanel";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ReferralShare from "@/components/ReferralShare";
import { exportPlanPDF } from "@/lib/exportPlanPDF";
import MobileAppShell from "@/components/mobile/MobileAppShell";
import type { MobileTab } from "@/components/mobile/MobileTabBar";
import { useIsMobile } from "@/hooks/use-mobile";
import PageHead from "@/components/PageHead";
import InfoHint from "@/components/InfoHint";
import { TIERS } from "@/config/tiers";
import { getFirstWeekJourney } from "@/lib/firstWeek";

const Chat = lazy(() => import("@/components/Chat"));
const MealsList = lazy(() => import("@/components/dashboard/MealsList"));
const ProgressPhotos = lazy(() => import("@/components/dashboard/ProgressPhotos"));
const ProgressCharts = lazy(() => import("@/components/ProgressCharts"));
const WorkoutTracker = lazy(() => import("@/components/dashboard/WorkoutTracker"));
const TrainingPlanView = lazy(() => import("@/components/dashboard/TrainingPlanView"));
const WorkoutProgress = lazy(() => import("@/components/dashboard/WorkoutProgress"));
const PRsList = lazy(() => import("@/components/dashboard/PRsList"));

const SectionFallback = () => (
  <div className="min-h-40 animate-pulse rounded-xl bg-card/50" aria-hidden />
);

/** Plan que el usuario eligió en la web antes de registrarse (si lo hay). */
const readLandingPlan = (): "training" | "full" | undefined => {
  try {
    const stored = sessionStorage.getItem("autopilot_selected_plan");
    return stored === "training" || stored === "full" ? stored : undefined;
  } catch {
    return undefined;
  }
};

export interface Profile {
  user_id: string;
  email: string;
  plan_status: string;
  payment_status: string;
  created_at: string;
}

interface Macros {
  protein: number;
  carbs: number;
  fats: number;
}

interface Meal {
  name: string;
  description: string;
}


const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [planStatus, setPlanStatus] = useState<string>("onboarding");
  const [paymentStatus, setPaymentStatus] = useState<string>("unpaid");
  const [coaching, setCoaching] = useState(false);
  const [consumerPlan, setConsumerPlan] = useState<ConsumerPlan>("free");
  const [coachAssigned, setCoachAssigned] = useState(true);
  const [nutrition, setNutrition] = useState(false);
  const [preparingRoutine, setPreparingRoutine] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("full");
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [macros, setMacros] = useState<Macros | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [landingPlan] = useState<"training" | "full" | undefined>(readLandingPlan);
  const [section, setSectionState] = useState<MobileTab>(() => {
    try {
      const saved = sessionStorage.getItem("autopilot_section");
      if (saved && ["home", "training", "nutrition", "chat", "progress", "settings"].includes(saved)) return saved as MobileTab;
    } catch { /* storage no disponible */ }
    return "home";
  });
  const setSection = useCallback((s: MobileTab) => {
    setSectionState(s);
    try { sessionStorage.setItem("autopilot_section", s); } catch { /* storage no disponible */ }
  }, []);
  const [visited, setVisited] = useState<MobileTab[]>(() => [section]);
  useEffect(() => {
    setVisited((v) => (v.includes(section) ? v : [...v, section]));
  }, [section]);
  const [progressTab, setProgressTab] = useState<"evolution" | "photos" | "records">("evolution");
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);
  const [workoutMode, setWorkoutMode] = useState(false);
  const [autoStartWorkout, setAutoStartWorkout] = useState(false);
  const [trainingView, setTrainingView] = useState<"tracker" | "plan">("tracker");
  const [firstWeek, setFirstWeek] = useState<{
    dayNumber: number;
    startDate: string;
    endDate: string;
    target: number;
    completed: number;
  } | null>(null);

  const fetchData = useCallback(async ({
    syncSubscription = false,
    checkAdmin = false,
  }: { syncSubscription?: boolean; checkAdmin?: boolean } = {}) => {
    if (!user) return;

    if (syncSubscription) {
      await supabase.functions.invoke("check-subscription").catch(() => {});
    }

    const profileRequest = supabase
      .from("profiles")
      .select("plan_status, payment_status, name, avatar_url, created_at, subscription_tier, subscription_status, subscription_end, stripe_payment_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const roleRequest = checkAdmin
      ? supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
      : Promise.resolve(null);
    const [profileResult, roleResult] = await Promise.all([profileRequest, roleRequest]);

    if (roleResult?.data) {
      navigate("/admin");
      return;
    }

    const profile = profileResult.data;
    if (profile) {
      setPlanStatus(profile.plan_status);
      setPaymentStatus(profile.payment_status);
      setSubscriptionTier(profile.subscription_tier || "free");
      setCoaching(hasCoaching(profile));
      setNutrition(hasNutrition(profile));
      const plan = getConsumerPlan(profile);
      setConsumerPlan(plan);
      if (plan === "coach") {
        const { data: cp } = await supabase.rpc("get_my_consumer_plan");
        setCoachAssigned(Boolean(cp?.[0]?.coach_assigned));
      }
      setProfileName(profile.name || "");
      setProfileAvatar(profile.avatar_url || "");

      if (profile.plan_status === "onboarding") {
        navigate("/onboarding");
        return;
      }

      // Si faltan sus respuestas no se pueden calcular calorías ni macros: las pedimos antes de seguir.
      const { data: onb } = await supabase
        .from("onboarding")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!onb) {
        navigate("/onboarding");
        return;
      }

      if (profile.plan_status === "plan_ready") {
        const today = new Date();
        const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        const weekStartDate = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
        const firstWeekWindow = getFirstWeekJourney(profile.created_at, []);
        const firstWeekCompletionsRequest = firstWeekWindow
          ? supabase
              .from("day_completions")
              .select("completed_at")
              .eq("user_id", user.id)
              .gte("completed_at", firstWeekWindow.startDate)
              .lte("completed_at", firstWeekWindow.endDate < todayDate ? firstWeekWindow.endDate : todayDate)
          : Promise.resolve({ data: [], error: null });
        const [{ data: tp }, { data: np }, { data: todayCompletion }, weeklyCompletions, firstWeekCompletions] = await Promise.all([
          supabase.from("training_plan").select("workouts_json").eq("user_id", user.id).maybeSingle(),
          supabase.from("nutrition_plan").select("macros_json, meals_json").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("day_completions")
            .select("id")
            .eq("user_id", user.id)
            .eq("completed_at", todayDate)
            .limit(1)
            .maybeSingle(),
          supabase
            .from("day_completions")
            .select("day_label")
            .eq("user_id", user.id)
            .gte("completed_at", weekStartDate)
            .lte("completed_at", todayDate),
          firstWeekCompletionsRequest,
        ]);

        const plans = tp?.workouts_json as unknown as DayPlan[] | undefined;
        if (plans) setDayPlans(plans);
        if (weeklyCompletions.error) {
          toast.error("No se pudo cargar el resumen de esta semana.");
        } else {
          const scheduledDays = new Set((plans || []).map((plan) => plan.day));
          setCompletedThisWeek(new Set(
            (weeklyCompletions.data || [])
              .map((row) => row.day_label)
              .filter((day): day is string => Boolean(day && scheduledDays.has(day))),
          ).size);
        }
        if (np) {
          setMacros(parseMacroTargets(np.macros_json));
          setMeals(np.meals_json as unknown as Meal[]);
        }
        setCompletedToday(Boolean(todayCompletion));
        const journey = getFirstWeekJourney(profile.created_at, plans || []);
        if (journey) {
          if (firstWeekCompletions.error) {
            toast.error("No se pudo cargar el progreso de tu primera semana.");
          }
          setFirstWeek({
            ...journey,
            completed: new Set((firstWeekCompletions.data || []).map((row) => row.completed_at)).size,
          });
        } else {
          setFirstWeek(null);
        }
      }
    }
    setLoading(false);
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    void fetchData({ syncSubscription: true, checkAdmin: true });

    const refreshTrainingPlan = async () => {
      const { data } = await supabase
        .from("training_plan")
        .select("workouts_json")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setDayPlans(data.workouts_json as unknown as DayPlan[]);
    };
    const refreshNutritionPlan = async () => {
      const { data } = await supabase
        .from("nutrition_plan")
        .select("macros_json, meals_json")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setMacros(parseMacroTargets(data.macros_json));
        setMeals(data.meals_json as unknown as Meal[]);
      }
    };

    const channel = supabase
      .channel(`dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, () => { void fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "training_plan", filter: `user_id=eq.${user.id}` }, () => { void refreshTrainingPlan(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "nutrition_plan", filter: `user_id=eq.${user.id}` }, () => { void refreshNutritionPlan(); })
      .subscribe();

    const onFocus = () => {
      if (document.visibilityState === "visible") void fetchData({ syncSubscription: true });
    };
    window.addEventListener("focus", onFocus);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, fetchData]);

  // Por defecto Plus: es el plan que queremos vender primero. Coach es una elección explícita.
  const handleCompletePayment = async (plan: "training" | "full" | "transform" = "training") => {
    try {
      track("checkout_start", { plan, source: "dashboard" });
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: { referral_code: "", plan },
      });
      if (checkoutError || !checkoutData?.url) {
        // Si falta configurar el enlace de pago, el problema no es del usuario.
        if (checkoutData?.code === "no_price") {
          toast.error("El pago de este plan aún no está configurado. Avísanos por el chat y lo activamos.");
        } else {
          toast.error("Error al iniciar el pago. Inténtalo de nuevo.");
        }
        return;
      }
      window.location.href = checkoutData.url;
    } catch {
      toast.error("Error al iniciar el pago. Inténtalo de nuevo.");
    }
  };

  const handleExportPDF = () => {
    try {
      exportPlanPDF({ userName: profileName, dayPlans, macros, meals });
      toast.success("PDF descargado");
    } catch (e) {
      toast.error("No se pudo generar el PDF");
    }
  };

  // Mejorar de Entrenamiento a Completo: portal de Stripe si existe cliente, si no checkout directo.
  const handleUpgradeToFull = async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (!error && data?.url) {
      window.open(data.url, "_blank");
      return;
    }
    await handleCompletePayment("full");
  };

  const handleManageSubscription = async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (data?.no_customer) {
      toast.info("Tu acceso lo gestiona tu entrenador manualmente. Escríbele por el chat para cambiar o cancelar tu plan.");
      return;
    }
    if (error || !data?.url) {
      toast.error("No se pudo abrir la gestión de tu suscripción. Escríbele a tu entrenador por el chat y lo resuelve.");
      return;
    }
    window.open(data.url, "_blank");
  };

  const handleSignOut = async () => {
    sessionStorage.removeItem("autopilot_section");
    await signOut();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </motion.div>
      </div>
    );
  }

  const hasPlan = planStatus === "plan_ready";
  const isTrainingOnly = coaching && !nutrition;
  const isTransform = subscriptionTier === "transform";
  const isFull = subscriptionTier === "full";
  const canRequestVideoCall = isTransform || isFull;

  const requestVideoCall = async () => {
    if (!user) return;
    const { error } = await supabase.from("chat_messages").insert({
      conversation_user_id: user.id,
      sender_id: user.id,
      content: "Hola 👋 Me gustaría agendar una videollamada por Google Meet. ¿Qué horarios tienes disponibles esta semana?",
    });
    if (error) {
      toast.error("No se pudo enviar la solicitud");
      return;
    }
    toast.success("Solicitud enviada. Tu entrenador te enviará un enlace de Google Meet por el chat.");
  };

  const SECTION_LABELS: Record<MobileTab, string> = {
    home: "Inicio",
    training: "Entrenamiento",
    nutrition: "Nutrición",
    chat: "Chat",
    settings: "Ajustes",
    progress: "Progreso",
    resources: " ",
  };

  const SECTION_HINTS: Record<MobileTab, string> = {
    home: "Resumen de hoy: tu entrenamiento, tus comidas y tu racha",
    training: "Tu rutina de la semana. Marca las series al terminarlas",
    nutrition: "Tus macros y comidas del día",
    chat: "Habla con tu entrenador y envía fotos o vídeos",
    progress: "Fotos, peso y evolución semanal",
    settings: "Perfil, suscripción y notificaciones",
    resources: "Biblioteca, guías y recomendaciones",
  };

  const renderContent = (section: MobileTab) => (
    <>
      {!coaching && !hasPlan && (section === "home" || section === "training") && (
        <div className="rounded-xl border border-border p-6">
          <h2 className="font-display text-xl font-bold">Prepara tu rutina inicial gratis</h2>
          <p className="my-3 text-sm text-muted-foreground">No necesitas contratar un entrenador para empezar.</p>
          <Button disabled={preparingRoutine} onClick={async () => {
            setPreparingRoutine(true);
            try {
              const { data, error } = await supabase.functions.invoke("generate-plan", { body: { user_id: user?.id } });
              if (error || !data?.success) throw new Error("generation_failed");
              await fetchData();
            } catch { toast.error("No se ha podido preparar la rutina. Vuelve a intentarlo."); }
            finally { setPreparingRoutine(false); }
          }}>{preparingRoutine ? "Preparando…" : "Preparar mi rutina gratis"}</Button>
        </div>
      )}
      {!coaching && section === "nutrition" && (
        // Plus preseleccionado siempre: es el plan que queremos vender primero.
        <PlanPaywall plan="plus" allowCoach defaultPlan="training" onChoose={(tier) => handleCompletePayment(tier)} />
      )}
      {!coaching && section === "chat" && (
        // El chat exige Coach, pero no dejamos al usuario de gratis sin salida hacia Plus.
        <PlanPaywall
          plan="coach"
          onChoose={() => handleCompletePayment("full")}
          onSeeOther={() => setSection("nutrition")}
          otherLabel={`Ver Plus · ${TIERS.training.price} €/mes`}
        />
      )}

      {coaching && planStatus === "plan_pending" && (section === "home" || section === "training") && (
        <div className="bg-card rounded-2xl p-6 md:p-10 border border-border card-shadow text-center max-w-2xl mx-auto md:w-full md:max-w-none">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"><Clock className="w-8 h-8 text-primary" /></div>
          <h2 className="text-xl font-bold font-display mb-2">Tu plan se está creando 🔥</h2>
          <p className="text-muted-foreground mb-2">No tienes que hacer nada: tu entrenador está preparando tu entrenamiento{nutrition ? " y tu nutrición" : ""} con los datos que nos has dado.</p>
          <p className="text-sm text-primary font-medium">Recibirás una notificación en menos de 48h.</p>
        </div>
      )}

      {hasPlan && section === "home" && (
        <div className="w-full space-y-3">
          {coaching && user && <RenewalFlow userId={user.id} subscriptionTier={subscriptionTier} />}
          <HomeOverview
            userId={user?.id}
            meals={meals}
            coaching={coaching}
            nutrition={nutrition}
            planStatus={planStatus}
            dayPlans={dayPlans}
            onNavigate={(s) => {
              setAutoStartWorkout(s === "training");
              setSection(s as MobileTab);
            }}
            profileName={profileName}
            macros={nutrition ? macros : null}
            completedThisWeek={completedThisWeek}
            completedToday={completedToday}
          />
          {coaching && user && (
            <details className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card px-4 py-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Más opciones de tu plan</summary>
              <div className="pt-3"><TravelModeCard userId={user.id} /></div>
            </details>
          )}
          {/* La oferta de Plus no espera a que acabe la primera semana: es cuando
              más intención hay. Se mantiene compacta para no competir con entrenar. */}
          {!coaching && (
            <div className="mx-auto w-full max-w-3xl space-y-2">
              {firstWeek && (
                <p className="text-center text-xs text-muted-foreground">
                  Primera semana · día {firstWeek.dayNumber} de 7 · {firstWeek.completed} de {firstWeek.target} entrenos
                </p>
              )}
              <CoachingOffer onChoose={handleCompletePayment} compact defaultPlan={landingPlan} />
            </div>
          )}
        </div>
      )}

      {hasPlan && section === "training" && user && (
        <div className="w-full min-w-0">
          {/* El plan de la semana estaba a 4 toques (Progreso). Ahora es un toque,
              y solo se ofrece cuando no hay una sesión en marcha. */}
          {!workoutMode && !autoStartWorkout && (
            <div role="tablist" aria-label="Entrenar o ver el plan" className="mx-auto mb-3 flex w-full max-w-md gap-1 rounded-full bg-secondary p-1">
              {([["tracker", "Entrenar"], ["plan", "Ver plan"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={trainingView === key}
                  onClick={() => setTrainingView(key)}
                  className={`h-10 flex-1 rounded-full text-sm font-medium transition-colors ${
                    trainingView === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <Suspense fallback={<SectionFallback />}>
            {trainingView === "plan" && !workoutMode && !autoStartWorkout ? (
              <TrainingPlanView dayPlans={dayPlans} />
            ) : (
              <WorkoutTracker
                userId={user.id}
                dayPlans={dayPlans}
                autoStart={autoStartWorkout}
                onAutoStartConsumed={() => setAutoStartWorkout(false)}
                onSessionModeChange={setWorkoutMode}
                onCancel={() => setWorkoutMode(false)}
                onExit={() => {
                  setWorkoutMode(false);
                  setCompletedToday(true);
                  setSection("home");
                  void fetchData();
                }}
              />
            )}
          </Suspense>
        </div>
      )}

      {hasPlan && section === "nutrition" && isTrainingOnly && (
        <div className="bg-card rounded-2xl p-6 md:p-10 border border-border card-shadow text-center max-w-2xl mx-auto md:w-full md:max-w-none">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"><Lock className="w-8 h-8 text-primary" /></div>
          <h2 className="text-xl font-bold font-display mb-2">Nutrición no incluida en tu plan</h2>
          <p className="text-muted-foreground mb-6 text-sm md:text-base">Tu plan actual es <span className="text-foreground font-semibold">Entrenamiento</span>. Cambia a <span className="text-foreground font-semibold">Completo</span> para desbloquear tu plan de nutrición personalizado.</p>
          <Button variant="hero" size="lg" onClick={handleUpgradeToFull} className="w-full md:w-auto">Elegir Coach — {TIERS.full.price}€/mes</Button>
        </div>
      )}

      {hasPlan && section === "nutrition" && nutrition && (
        <div className="w-full space-y-6">
          {!isMobile && <div className="flex items-center gap-2 mb-2">
            <Apple className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold font-display">Plan de Nutrición</h2>
            <InfoHint text={macros
              ? "Estos son tus objetivos diarios. No hace falta clavarlos al gramo: acércate y sé constante."
              : "Las comidas son orientativas hasta que tu entrenador calcule objetivos con tu peso actual."} />
          </div>}
          <Suspense fallback={<SectionFallback />}>
            <MealsList meals={meals} macros={macros} onOpenProfile={() => setSection("settings")} />
          </Suspense>
        </div>
      )}

      {coaching && consumerPlan === "plus" && section === "chat" && (
        <PlanPaywall plan="coach" onChoose={() => handleCompletePayment("full")} />
      )}
      {consumerPlan === "coach" && !coachAssigned && section === "chat" && <CoachPendingAssignment />}
      {consumerPlan === "coach" && coachAssigned && section === "chat" && (
        <div className="w-full">
          {user && (
            <Suspense fallback={<SectionFallback />}>
              <Chat
                conversationUserId={user.id}
                onRequestVideoCall={requestVideoCall}
                callLabel={paymentStatus === "unpaid" ? "Pedir llamada gratis" : "Videollamada"}
              />
            </Suspense>
          )}
        </div>
      )}

      {hasPlan && section === "progress" && user && (
        <div className="w-full space-y-4">
          {!isMobile && (
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Tu progreso</h2>
              <InfoHint text="Sube una foto cada 2 semanas, misma luz y misma hora. Es la forma más fiable de ver el cambio." />
            </div>
          )}
          <div role="tablist" className="sticky top-0 z-10 grid grid-cols-4 gap-1 rounded-full border border-border/60 bg-card/90 p-1 backdrop-blur-xl">
            {([
              ["evolution", "Evolución"],
              ["photos", "Fotos"],
              ["records", "Récords"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={progressTab === k}
                onClick={() => setProgressTab(k)}
                className={`relative h-9 rounded-full text-sm font-medium transition-colors duration-150 ${progressTab === k ? "text-primary-foreground" : "text-muted-foreground"}`}
              >
                {progressTab === k && (
                  <motion.span layoutId="progress-pill" className="absolute inset-0 rounded-full bg-primary shadow-sm" transition={{ type: "spring", stiffness: 600, damping: 40 }} />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => navigate(`/scan/user/${user.id}`)}
              className="flex h-9 items-center justify-center gap-1 rounded-full text-sm font-medium text-primary transition-transform active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" /> Scan
            </button>
          </div>
          <Suspense fallback={<SectionFallback />}>
            <div className={progressTab === "evolution" ? "flex h-[calc(100dvh-18.5rem)] min-h-[420px] flex-col overflow-hidden md:h-[calc(100dvh-12rem)]" : "hidden"}>
              <WorkoutProgress userId={user.id} compact />
            </div>
            <div className={progressTab === "photos" ? "" : "hidden"}><ProgressPhotos userId={user.id} /></div>
            <div className={progressTab === "records" ? "" : "hidden"}><PRsList userId={user.id} /></div>
          </Suspense>
        </div>
      )}

      {section === "settings" && (
        <div className="w-full"><SettingsPanel onUpgrade={(plan) => handleCompletePayment(plan)} /></div>
      )}
    </>
  );

  const pageContent = (
    <>
      {visited.map((s) => (
        <div key={s} className={s === section ? "flex min-w-0 flex-1 flex-col justify-start pt-2" : "hidden"}>
          {renderContent(s)}
        </div>
      ))}
    </>
  );

  // Mobile: app shell con barra inferior tipo nativa
  if (isMobile) {
    return (
      <>
      <PageHead
        title="Mi panel · Autopilot"
        description="Tu plan diario de entrenamiento y nutrición."
        path="/dashboard"
        noindex
      />
      <MobileAppShell
        title={SECTION_LABELS[section]}
        active={section}
        onChange={setSection}
        profileName={profileName}
        profileAvatar={profileAvatar}
        userId={user?.id}
        lockedTabs={!coaching ? ["nutrition", "chat"] : consumerPlan !== "coach" ? ["chat"] : []}
        onSettings={() => setSection("settings")}
        workoutMode={workoutMode}
      >
        {pageContent}
      </MobileAppShell>
      </>
    );
  }

  return (
    <SidebarProvider>
      <PageHead
        title="Mi panel · Autopilot"
        description="Tu plan diario de entrenamiento y nutrición."
        path="/dashboard"
        noindex
      />
      <div className="min-h-screen flex w-full">
        <div className={workoutMode ? "hidden" : ""}>
          <UserSidebar
            section={section as UserSection}
            onNavigate={(s) => setSection(s as MobileTab)}
            onSignOut={handleSignOut}
            profileName={profileName}
            profileAvatar={profileAvatar}
            lockedSections={!coaching ? ["nutrition", "chat"] : consumerPlan !== "coach" ? ["chat"] : []}
          />
        </div>

        <div className={`flex min-w-0 flex-1 flex-col ${workoutMode ? "h-dvh overflow-hidden" : ""}`}>
          {/* Top bar */}
          <header className={`app-chrome h-14 border-b sticky top-0 z-50 flex items-center px-4 gap-3 ${workoutMode ? "hidden" : ""}`}>
            <SidebarTrigger />
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-sm uppercase tracking-wider text-foreground truncate">
                {SECTION_LABELS[section]}
              </h1>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                {SECTION_HINTS[section]}
              </p>
            </div>
            {user && <NotificationsBell userId={user.id} />}
          </header>

          <main className={`min-w-0 flex-1 overflow-y-auto ${workoutMode ? "h-dvh p-0" : "p-4 md:p-6 lg:p-8"}`}>
            <div className={`${workoutMode ? "h-full w-full" : "max-w-7xl mx-auto w-full"}`}>
              {pageContent}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
