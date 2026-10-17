import { hasCoaching, hasNutrition, getConsumerPlan, type ConsumerPlan } from "@/lib/entitlements";
import { PlanPaywall, CoachPendingAssignment } from "@/components/dashboard/PlanPaywall";
import { parseMacroTargets } from "@/lib/nutrition";
import CoachingOffer from "@/components/dashboard/CoachingOffer";
import { track } from "@/lib/analytics";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock, Dumbbell, Flag, Lock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hapticSelection, hapticTap } from "@/lib/native";
import NotificationsBell from "@/components/NotificationsBell";
import { toast } from "sonner";
import type { DayPlan } from "@/types/training";
import WeeklyProgress from "@/components/WeeklyProgress";
import HomeOverview from "@/components/dashboard/HomeOverview";
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
import { euro, usePlanAvailability } from "@/lib/planCatalog";
import { getFirstWeekJourney } from "@/lib/firstWeek";
import { isIOSNative } from "@/lib/platform";

const Chat = lazy(() => import("@/components/Chat"));
const MealsList = lazy(() => import("@/components/dashboard/MealsList"));
const ProgressPhotos = lazy(() => import("@/components/dashboard/ProgressPhotos"));
const ProgressCharts = lazy(() => import("@/components/ProgressCharts"));
const WorkoutTracker = lazy(() => import("@/components/dashboard/WorkoutTracker"));
const TrainingPlanView = lazy(() => import("@/components/dashboard/TrainingPlanView"));
const WorkoutProgress = lazy(() => import("@/components/dashboard/WorkoutProgress"));
const PRsList = lazy(() => import("@/components/dashboard/PRsList"));
const Recursos = lazy(() => import("@/pages/Recursos"));
const Scan = lazy(() => import("@/pages/Scan"));

const SectionFallback = () => (
  <Skeleton className="min-h-40 w-full rounded-2xl bg-card" aria-hidden />
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
  const plans = usePlanAvailability();
  // Coach customers keep their chat; everyone else stops seeing it while Coach is hidden in Admin.
  const hideChat = !plans.coach && consumerPlan !== "coach";
  const [coachAssigned, setCoachAssigned] = useState(true);
  const [nutrition, setNutrition] = useState(false);
  const [preparingRoutine, setPreparingRoutine] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("full");
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [macros, setMacros] = useState<Macros | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [landingPlan] = useState<"training" | "full" | undefined>(readLandingPlan);
  /**
   * Lo que contestó en el onboarding: quien quiere entrenador ve el plan con
   * entrenador preseleccionado, y quien entrena por su cuenta ve el de la app.
   * Si eligió un plan en la web, ese manda.
   */
  const wantsCoach = (user?.user_metadata as { training_style?: string } | undefined)?.training_style === "coach";
  const [searchParams] = useSearchParams();
  const [section, setSectionState] = useState<MobileTab>(() => {
    const fromParam = searchParams.get("section");
    if (fromParam && ["home", "training", "nutrition", "chat", "progress", "settings", "resources"].includes(fromParam)) {
      return fromParam as MobileTab;
    }
    try {
      const saved = sessionStorage.getItem("autopilot_section");
      if (saved && ["home", "training", "nutrition", "chat", "progress", "settings", "resources"].includes(saved)) return saved as MobileTab;
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
  const [progressTab, setProgressTab] = useState<"evolution" | "photos" | "records" | "scan">("evolution");
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);
  const [workoutMode, setWorkoutMode] = useState(false);
  const [autoStartWorkout, setAutoStartWorkout] = useState(false);
  const [trainingDay, setTrainingDay] = useState<string | undefined>();
  const [trainingView, setTrainingView] = useState<"tracker" | "plan">(() => {
    const fromParam = searchParams.get("view");
    if (fromParam === "plan" || fromParam === "tracker") return fromParam;
    try {
      const saved = sessionStorage.getItem("autopilot_training_view");
      if (saved === "plan" || saved === "tracker") {
        sessionStorage.removeItem("autopilot_training_view");
        return saved;
      }
    } catch { /* storage no disponible */ }
    return "tracker";
  });

  useEffect(() => {
    const sec = searchParams.get("section");
    if (sec && ["home", "training", "nutrition", "chat", "progress", "settings", "resources"].includes(sec)) {
      setSectionState(sec as MobileTab);
    }
    const vw = searchParams.get("view");
    if (vw === "plan" || vw === "tracker") {
      setTrainingView(vw);
    }
    if (searchParams.get("autostart") === "true") {
      setAutoStartWorkout(true);
      setTrainingView("tracker");
      setWorkoutMode(true);
    }
  }, [searchParams]);
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
        navigate("/onboarding-choice");
        return;
      }

      // Si faltan sus respuestas no se pueden calcular calorías ni macros: las pedimos antes de seguir.
      const { data: onb } = await supabase
        .from("onboarding")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!onb) {
        navigate("/onboarding-choice");
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

  // Wait for the profile: before it loads every user looks like "free".
  useEffect(() => { if (!loading && hideChat && section === "chat") setSectionState("home"); }, [loading, hideChat, section]);

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
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner size="lg" />
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
    resources: "Recursos",
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

  // Títulos de la barra en el móvil: cortos, los mismos que en la barra de pestañas.
  const MOBILE_TITLES: Record<MobileTab, string> = {
    home: "Hoy",
    training: "Plan",
    nutrition: "Nutrición",
    chat: "Chat",
    progress: "Progreso",
    settings: "Ajustes",
    resources: "Recursos",
  };
  // En Hoy el título grande es el saludo de HomeOverview: la barra solo muestra "Hoy" al pasarlo.
  const LARGE_TITLE_TABS: MobileTab[] = ["training", "nutrition", "chat", "progress", "settings", "resources"];
  // En el móvil la conversación ocupa justo el alto que queda bajo el título, con el campo de texto a la vista.
  const chatFills = isMobile && consumerPlan === "coach" && coachAssigned;
  // Ayuda de la sección: en escritorio va junto al título de la barra.
  const sectionHelp = hasPlan && section === "nutrition" && nutrition
    ? macros
      ? "Estos son tus objetivos diarios. No hace falta clavarlos al gramo: acércate y sé constante."
      : "Las comidas son orientativas hasta que tu entrenador calcule objetivos con tu peso actual."
    : hasPlan && section === "progress" && user
      ? "Sube una foto cada 2 semanas, misma luz y misma hora. Es la forma más fiable de ver el cambio."
      : null;

  const renderContent = (section: MobileTab) => (
    <>
      {!coaching && !hasPlan && (section === "home" || section === "training") && (
        <div className="flex w-full flex-1 flex-col">
          <EmptyState
            className="flex-1"
            icon={Dumbbell}
            title="Prepara tu rutina inicial gratis"
            description="No necesitas contratar un entrenador para empezar."
          />
          <Button size="lg" className="w-full md:w-auto md:self-center" disabled={preparingRoutine} onClick={async () => {
            void hapticTap();
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
          otherLabel={`Ver ${plans.plusName} · ${euro(plans.plusPrice)}/mes`}
        />
      )}

      {coaching && planStatus === "plan_pending" && (section === "home" || section === "training") && (
        <EmptyState
          className="flex-1"
          icon={Clock}
          title="Tu plan se está creando"
          description={`No tienes que hacer nada: tu entrenador está preparando tu entrenamiento${nutrition ? " y tu nutrición" : ""} con los datos que nos has dado.`}
          action={<p className="type-footnote text-muted-foreground">Recibirás una notificación en menos de 48h.</p>}
        />
      )}

      {hasPlan && section === "home" && (
        // Hoy llena la pantalla: HomeOverview reparte el alto y lo demás va debajo.
        <div className="flex w-full flex-1 flex-col gap-8">
          <HomeOverview
            userId={user?.id}
            meals={meals}
            coaching={coaching}
            nutrition={nutrition}
            planStatus={planStatus}
            dayPlans={dayPlans}
            onNavigate={(s) => {
              setAutoStartWorkout(false);
              if (s === "training") setTrainingView("plan");
              setSection(s as MobileTab);
            }}
            onStartWorkout={() => {
              setTrainingView("tracker");
              setAutoStartWorkout(true);
              setSection("training");
            }}
            profileName={profileName}
            macros={nutrition ? macros : null}
            completedThisWeek={completedThisWeek}
            completedToday={completedToday}
          />
          {coaching && user && <RenewalFlow userId={user.id} subscriptionTier={subscriptionTier} />}
          {/* Modo viaje se gestiona ahora desde Ajustes; en Dashboard solo
              aparecería como estado activo (próxima iteración). */}
          {/* La oferta de Plus no espera a que acabe la primera semana: es cuando
              más intención hay. Se mantiene compacta para no competir con entrenar. */}
          {!coaching && (
            <div className="mx-auto w-full max-w-3xl space-y-6 empty:hidden">
              {firstWeek && (
                <div className="flex items-start gap-4">
                  <span aria-hidden="true" className="flex w-10 shrink-0 justify-center pt-0.5">
                    <Flag className="h-7 w-7 text-primary" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="type-headline">Tu primera semana</p>
                    <p className="mt-0.5 type-subhead tabular-nums text-muted-foreground">
                      Día {firstWeek.dayNumber} de 7 · {firstWeek.completed} de {firstWeek.target} entrenos
                    </p>
                  </div>
                </div>
              )}
              <CoachingOffer
                onChoose={handleCompletePayment}
                compact
                defaultPlan={landingPlan ?? (wantsCoach ? "full" : "training")}
              />
            </div>
          )}
        </div>
      )}

      {hasPlan && section === "training" && user && (
        <Tabs
          value={trainingView}
          onValueChange={(view) => {
            void hapticSelection();
            setTrainingView(view as "tracker" | "plan");
          }}
          className="w-full min-w-0"
        >
          {/* El plan de la semana estaba a 4 toques (Progreso). Ahora es un toque,
              y solo se ofrece cuando no hay una sesión en marcha. */}
          {!workoutMode && !autoStartWorkout && (
            <TabsList aria-label="Entrenar o ver el plan" className="mx-auto mb-4 flex w-full max-w-md lg:max-w-lg">
              <TabsTrigger value="tracker">Entrenar</TabsTrigger>
              <TabsTrigger value="plan">Rutina semanal</TabsTrigger>
            </TabsList>
          )}
          {/* Un solo panel: lo que se ve depende también de si hay una sesión en marcha. */}
          <TabsContent value={trainingView} tabIndex={-1} className="mt-0">
            <Suspense fallback={<SectionFallback />}>
              {trainingView === "plan" && !workoutMode && !autoStartWorkout ? (
                <TrainingPlanView dayPlans={dayPlans} onOpenWorkout={(day) => {
                  setTrainingDay(day);
                  setTrainingView("tracker");
                }} />
              ) : (
                <WorkoutTracker
                  userId={user.id}
                  dayPlans={dayPlans}
                  initialDay={trainingDay}
                  autoStart={autoStartWorkout}
                  onAutoStartConsumed={() => setAutoStartWorkout(false)}
                  onSessionModeChange={setWorkoutMode}
                  onCancel={() => setWorkoutMode(false)}
                  onExit={() => {
                    setWorkoutMode(false);
                    setSection("home");
                    void fetchData();
                  }}
                />
              )}
            </Suspense>
          </TabsContent>
        </Tabs>
      )}

      {hasPlan && section === "nutrition" && isTrainingOnly && (
        <div className="flex w-full flex-1 flex-col">
          <EmptyState
            className="flex-1"
            icon={Lock}
            title="Nutrición no incluida en tu plan"
            description="Tu plan actual es Entrenamiento. Cambia a Completo para desbloquear tu plan de nutrición personalizado."
          />
          {!isIOSNative() && (
            <Button size="lg" onClick={() => { void hapticTap(); void handleUpgradeToFull(); }} className="w-full md:w-auto md:self-center">Elegir {plans.coachName} — {euro(plans.coachPrice)}/mes</Button>
          )}
        </div>
      )}

      {hasPlan && section === "nutrition" && nutrition && (
        <div className="w-full">
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
        <div className={chatFills ? "flex min-h-0 w-full flex-1 flex-col" : "w-full"}>
          {user && (
            <Suspense fallback={<SectionFallback />}>
              <Chat
                conversationUserId={user.id}
                onRequestVideoCall={requestVideoCall}
                callLabel={paymentStatus === "unpaid" ? "Pedir llamada gratis" : "Videollamada"}
                layout={chatFills ? "fill" : "panel"}
              />
            </Suspense>
          )}
        </div>
      )}

      {hasPlan && section === "progress" && user && (
        <Tabs
          value={progressTab}
          onValueChange={(tab) => {
            void hapticSelection();
            setProgressTab(tab as typeof progressTab);
          }}
          className="w-full min-w-0 space-y-4"
        >
          <TabsList aria-label="Tu progreso" className="mx-auto mb-4 flex w-full max-w-md lg:max-w-lg">
            <TabsTrigger value="evolution">Fuerza</TabsTrigger>
            <TabsTrigger value="photos">Físico</TabsTrigger>
            <TabsTrigger value="records">Récords</TabsTrigger>
            <TabsTrigger value="scan">Scan</TabsTrigger>
          </TabsList>
          <Suspense fallback={<SectionFallback />}>
            <TabsContent
              value="evolution"
              forceMount
              tabIndex={-1}
              className="mt-0 flex min-h-[420px] flex-col data-[state=inactive]:hidden lg:min-h-0 lg:h-[calc(100dvh-10rem)] md:h-[calc(100dvh-12rem)] md:overflow-hidden"
            >
              <WorkoutProgress userId={user.id} compact />
            </TabsContent>
            <TabsContent value="photos" forceMount tabIndex={-1} className="mt-0 data-[state=inactive]:hidden">
              <ProgressPhotos userId={user.id} onGoScan={() => setProgressTab("scan")} />
            </TabsContent>
            <TabsContent value="records" forceMount tabIndex={-1} className="mt-0 data-[state=inactive]:hidden">
              <PRsList userId={user.id} />
            </TabsContent>
            <TabsContent value="scan" tabIndex={-1} className="mt-0">
              <Scan
                inline
                onOpenPlan={() => {
                  setAutoStartWorkout(false);
                  setTrainingView("plan");
                  setSection("training");
                }}
                onStartWorkout={() => {
                  setAutoStartWorkout(true);
                  setTrainingView("tracker");
                  setWorkoutMode(true);
                  setSection("training");
                }}
                onPlanChanged={() => { void fetchData(); }}
              />
            </TabsContent>
          </Suspense>
        </Tabs>
      )}

      {section === "settings" && (
        <div className="w-full"><SettingsPanel onUpgrade={(plan) => handleCompletePayment(plan)} /></div>
      )}

      {section === "resources" && (
        <Suspense fallback={<SectionFallback />}><Recursos embedded /></Suspense>
      )}
    </>
  );

  const pageContent = (
    <>
      {visited.map((s) => (
        <div
          key={s}
          className={s === section
            ? `flex min-w-0 flex-1 flex-col justify-start pt-2${s === "chat" && chatFills ? " min-h-0" : ""}`
            : "hidden"}
        >
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
        title={MOBILE_TITLES[section]}
        largeTitle={LARGE_TITLE_TABS.includes(section)}
        titleInContent={section === "home"}
        active={section}
        onChange={setSection}
        profileName={profileName}
        profileAvatar={profileAvatar}
        userId={user?.id}
        lockedTabs={!coaching ? ["nutrition", "chat"] : consumerPlan !== "coach" ? ["chat"] : []}
        hiddenTabs={hideChat ? ["chat"] : []}
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
            hiddenSections={hideChat ? ["chat"] : []}
          />
        </div>

        <div className={`flex min-w-0 flex-1 flex-col ${workoutMode ? "h-dvh overflow-hidden" : ""}`}>
          {/* Top bar */}
          <header className={`app-chrome sticky top-0 z-50 flex h-14 lg:h-16 items-center gap-3 border-b-[0.5px] px-4 lg:px-6 ${workoutMode ? "hidden" : ""}`}>
            <SidebarTrigger />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate type-headline lg:text-[18px]">
                  {SECTION_LABELS[section]}
                </h1>
                {sectionHelp && <InfoHint text={sectionHelp} />}
              </div>
              <p className="hidden truncate type-caption1 text-muted-foreground sm:block lg:text-[13px]">
                {SECTION_HINTS[section]}
              </p>
            </div>
            {user && <NotificationsBell userId={user.id} />}
          </header>

          <main className={`min-w-0 flex-1 overflow-y-auto ${workoutMode ? "h-dvh p-0" : "p-4 md:p-8 lg:p-10 lg:pt-8"}`}>
            <div className={`${workoutMode ? "h-full w-full" : "max-w-6xl mx-auto w-full"}`}>
              {pageContent}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
