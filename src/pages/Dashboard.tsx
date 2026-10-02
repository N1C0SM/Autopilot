import { loadSessions, trackingDb } from "@/lib/tracking/store";
import { stats as sessionStats } from "@/lib/tracking/model";
import FoodDiary from "@/components/tracking/FoodDiary";
import { hasCoaching, hasNutrition } from "@/lib/entitlements";
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
const WorkoutProgress = lazy(() => import("@/components/dashboard/WorkoutProgress"));

const SectionFallback = () => (
  <div className="min-h-40 animate-pulse rounded-xl bg-card/50" aria-hidden />
);

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
  const [nutrition, setNutrition] = useState(false);
  const [preparingRoutine, setPreparingRoutine] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("full");
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [macros, setMacros] = useState<Macros | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);
  const [workoutMode, setWorkoutMode] = useState(false);
  const [autoStartWorkout, setAutoStartWorkout] = useState(false);
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
          ? trackingDb
              .from("workout_sessions")
              .select("completed_at:local_date")
              .eq("status", "completed")
              .eq("user_id", user.id)
              .gte("local_date", firstWeekWindow.startDate)
              .lte("local_date", firstWeekWindow.endDate < todayDate ? firstWeekWindow.endDate : todayDate)
          : Promise.resolve({ data: [], error: null });
        const [{ data: tp }, { data: np }, firstWeekCompletions] = await Promise.all([
          supabase.from("training_plan").select("workouts_json").eq("user_id", user.id).maybeSingle(),
          supabase.from("nutrition_plan").select("macros_json, meals_json").eq("user_id", user.id).maybeSingle(),
          firstWeekCompletionsRequest,
        ]);

        const plans = tp?.workouts_json as unknown as DayPlan[] | undefined;
        if (plans) setDayPlans(plans);
        if (np) {
          setMacros(parseMacroTargets(np.macros_json));
          setMeals(np.meals_json as unknown as Meal[]);
        }
        try {
          const performed = (await loadSessions(user.id)).filter(s => sessionStats(s).performed);
          setCompletedToday(performed.some(s => s.local_date === todayDate));
          setCompletedThisWeek(performed.filter(s => s.local_date >= weekStartDate && s.local_date <= todayDate).length);
        } catch { toast.error("No se pudo cargar el resumen de sesiones."); }

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

  const handleCompletePayment = async (plan: "training" | "full" | "transform" = "full") => {
    try {
      track("checkout_start", { plan, source: "dashboard" });
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: { referral_code: "", plan },
      });
      if (checkoutError || !checkoutData?.url) {
        toast.error("Error al iniciar el pago. Inténtalo de nuevo.");
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

  const pageContent = (
    <>
      {!coaching && section === "home" && (
        <div className="space-y-4 mb-6">
          <div>
            <p className="text-xs font-semibold text-primary">Plan Gratis · Sin tarjeta</p>
            <h2 className="mt-1 text-xl font-bold font-display">Tu rutina y tu progreso, a tu ritmo.</h2>
            <p className="mt-2 text-sm text-muted-foreground">La rutina inicial se prepara automáticamente con tus datos. El seguimiento de un entrenador es opcional.</p>
          </div>
        </div>
      )}
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
      {!coaching && (section === "chat" || section === "nutrition") && (
        <CoachingOffer onChoose={handleCompletePayment} nutrition={section === "nutrition"} />
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
          {!coaching && !firstWeek && <CoachingOffer onChoose={handleCompletePayment} compact />}
        </div>
      )}

      {hasPlan && section === "training" && user && (
        <div className="w-full min-w-0">
          <Suspense fallback={<SectionFallback />}>
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
          </Suspense>
        </div>
      )}

      {hasPlan && section === "nutrition" && isTrainingOnly && (
        <div className="bg-card rounded-2xl p-6 md:p-10 border border-border card-shadow text-center max-w-2xl mx-auto md:w-full md:max-w-none">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"><Lock className="w-8 h-8 text-primary" /></div>
          <h2 className="text-xl font-bold font-display mb-2">Nutrición no incluida en tu plan</h2>
          <p className="text-muted-foreground mb-6 text-sm md:text-base">Tu plan actual es <span className="text-foreground font-semibold">Entrenamiento</span>. Cambia a <span className="text-foreground font-semibold">Completo</span> para desbloquear tu plan de nutrición personalizado.</p>
          <Button variant="hero" size="lg" onClick={handleUpgradeToFull} className="w-full md:w-auto">Mejorar a Completo — {TIERS.full.price}€/mes</Button>
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
            <MealsList userId={user?.id} meals={meals} macros={macros} onOpenProfile={() => setSection("settings")} />
          </Suspense>
          {user && <FoodDiary userId={user.id} meals={meals} />}
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" onClick={handleManageSubscription} className="text-muted-foreground">Gestionar suscripción</Button>
          </div>
        </div>
      )}

      {coaching && section === "chat" && (
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

      {section === "progress" && user && (
        <div className="w-full space-y-4">
          {!isMobile && <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Tu progreso</h2>
              <InfoHint text="Sube una foto cada 2 semanas, misma luz y misma hora. Úsalas junto con tus medidas y rendimiento." />
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate(`/scan/user/${user.id}`)}>
              AI Scan
            </Button>
          </div>}

          <Suspense fallback={<SectionFallback />}>
            <WorkoutProgress userId={user.id} />
            <ProgressCharts userId={user.id} />
          </Suspense>
          <Suspense fallback={<SectionFallback />}>
            <ProgressPhotos userId={user.id} />
          </Suspense>
          {isMobile && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => navigate(`/scan/user/${user.id}`)}>
                AI Scan
              </Button>
            </div>
          )}
        </div>
      )}

      {section === "settings" && (
        <div className="w-full"><SettingsPanel /></div>
      )}
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
        lockedTabs={!coaching ? ["nutrition", "chat"] : isTrainingOnly ? ["nutrition"] : []}
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
            lockedSections={!coaching ? ["nutrition", "chat"] : isTrainingOnly ? ["nutrition"] : []}
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
