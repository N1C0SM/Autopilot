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
import MyTrainerCard from "@/components/dashboard/MyTrainerCard";
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
import { TRIAL_DAYS, GUARANTEE_DAYS } from "@/config/pricing";
import { TIERS } from "@/config/tiers";

const Chat = lazy(() => import("@/components/Chat"));
const MealsList = lazy(() => import("@/components/dashboard/MealsList"));
const ProgressPhotos = lazy(() => import("@/components/dashboard/ProgressPhotos"));
const WorkoutTracker = lazy(() => import("@/components/dashboard/WorkoutTracker"));

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
  const [profileCreatedAt, setProfileCreatedAt] = useState<string>("");
  const [completedDays, setCompletedDays] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);

  const fetchData = useCallback(async ({
    syncSubscription = false,
    checkAdmin = false,
  }: { syncSubscription?: boolean; checkAdmin?: boolean } = {}) => {
    if (!user) return;

    if (syncSubscription) {
      void supabase.functions.invoke("check-subscription").catch(() => {});
    }

    const profileRequest = supabase
      .from("profiles")
      .select("plan_status, payment_status, name, avatar_url, created_at, subscription_tier")
      .eq("user_id", user.id)
      .single();
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
      setSubscriptionTier(profile.subscription_tier || "full");
      setProfileName(profile.name || "");
      setProfileAvatar(profile.avatar_url || "");
      setProfileCreatedAt(profile.created_at || "");

      if (profile.payment_status === "unpaid") {
        setLoading(false);
        return;
      }
      if (profile.plan_status === "onboarding") {
        navigate("/onboarding");
        return;
      }

      if (profile.plan_status === "plan_ready") {
        const today = new Date();
        const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const [{ data: tp }, { data: np }, { count: completionCount }, { data: todayCompletion }] = await Promise.all([
          supabase.from("training_plan").select("workouts_json").eq("user_id", user.id).single(),
          supabase.from("nutrition_plan").select("macros_json, meals_json").eq("user_id", user.id).single(),
          supabase
            .from("day_completions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("day_completions")
            .select("id")
            .eq("user_id", user.id)
            .eq("completed_at", todayDate)
            .limit(1)
            .maybeSingle(),
        ]);

        if (tp) setDayPlans(tp.workouts_json as unknown as DayPlan[]);
        if (np) {
          setMacros(np.macros_json as unknown as Macros);
          setMeals(np.meals_json as unknown as Meal[]);
        }
        setCompletedDays(completionCount ?? 0);
        setCompletedToday(Boolean(todayCompletion));
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
        .single();
      if (data) setDayPlans(data.workouts_json as unknown as DayPlan[]);
    };
    const refreshNutritionPlan = async () => {
      const { data } = await supabase
        .from("nutrition_plan")
        .select("macros_json, meals_json")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setMacros(data.macros_json as unknown as Macros);
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

  const handleSignOut = () => {
    signOut();
    navigate("/");
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

  const hasPlan = paymentStatus === "paid" && planStatus === "plan_ready";
  const isTrainingOnly = subscriptionTier === "training";
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
      {/* Unpaid state — shown on all sections EXCEPT settings */}
      {paymentStatus === "unpaid" && section !== "settings" && section !== "chat" && (() => {
        const paywallContent: Record<MobileTab, { icon: React.ReactNode; title: string; description: string; cta: string }> = {
          home: { icon: <Crown className="w-8 h-8 text-primary" />, title: "Un entrenador prepara tu plan", description: "Un entrenador real revisa tus datos y te prepara el entrenamiento y la nutrición. Tú no tienes que montar nada.", cta: `Empezar ${TRIAL_DAYS} días gratis — ${TIERS.full.price}€/mes` },
          training: { icon: <Dumbbell className="w-8 h-8 text-primary" />, title: "Tu rutina te está esperando", description: "Ejercicios, series y descansos diseñados para tus objetivos. Actualizado cada semana por tu entrenador.", cta: "Desbloquear mi entrenamiento" },
          nutrition: { icon: <UtensilsCrossed className="w-8 h-8 text-primary" />, title: "Come según tu objetivo", description: "Plan de comidas con macros calculados para ti. Sin recetas genéricas, todo personalizado.", cta: "Desbloquear mi nutrición" },
          chat: { icon: <MessageCircle className="w-8 h-8 text-primary" />, title: "Habla con tu entrenador", description: "Resuelve dudas, ajusta tu plan y recibe feedback directo. Siempre disponible.", cta: "Activar chat con entrenador" },
          progress: { icon: <Crown className="w-8 h-8 text-primary" />, title: "Sigue tu progreso", description: "Sube fotos, ve tu evolución y desbloquea AI Scan.", cta: `Empezar ${TRIAL_DAYS} días gratis — ${TIERS.full.price}€/mes` },
          settings: { icon: <Crown className="w-8 h-8 text-primary" />, title: "Obtén tu plan personalizado", description: "Entrenamiento y nutrición 100% adaptados a ti.", cta: `Empezar ${TRIAL_DAYS} días gratis — ${TIERS.full.price}€/mes` },
          resources: { icon: <BookOpen className="w-8 h-8 text-primary" />, title: "Recursos", description: "Guías, artículos y recomendaciones para acompañar tu plan.", cta: "Ver recursos" },
        };
        const content = paywallContent[section] || paywallContent.home;
        return (
          <div className="bg-card rounded-2xl p-6 md:p-10 border border-border card-shadow text-center max-w-2xl mx-auto md:w-full md:max-w-none">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">{content.icon}</div>
            <h2 className="text-xl font-bold font-display mb-2">{content.title}</h2>
            <p className="text-muted-foreground mb-6 text-sm md:text-base">{content.description}</p>
            <Button variant="hero" size="lg" onClick={() => handleCompletePayment("full")} className="w-full md:w-auto">{content.cta}</Button>
            <button onClick={() => handleCompletePayment("training")} className="mx-auto mt-4 text-xs text-primary hover:underline font-semibold inline-flex items-center gap-1.5">
              <Dumbbell className="w-3 h-3" /> Solo entrenamiento — {TIERS.training.price}€/mes
            </button>
            <p className="text-xs text-muted-foreground mt-3">Cancela cuando quieras · Garantía {GUARANTEE_DAYS} días</p>
            <button onClick={() => setSection("chat")} className="mx-auto mt-4 text-xs text-muted-foreground hover:text-primary underline inline-flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3" /> Prefiero hablar antes con un entrenador (gratis)
            </button>
          </div>
        );
      })()}

      {paymentStatus === "paid" && planStatus === "plan_pending" && section === "home" && (
        <div className="bg-card rounded-2xl p-6 md:p-10 border border-border card-shadow text-center max-w-2xl mx-auto md:w-full md:max-w-none">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"><Clock className="w-8 h-8 text-primary" /></div>
          <h2 className="text-xl font-bold font-display mb-2">Tu plan se está creando 🔥</h2>
          <p className="text-muted-foreground mb-2">No tienes que hacer nada: tu entrenador está preparando tu entrenamiento y tu nutrición con los datos que nos has dado.</p>
          <p className="text-sm text-primary font-medium">Recibirás una notificación en menos de 48h.</p>
        </div>
      )}

      {hasPlan && section === "home" && (
        <div className="w-full space-y-6">
          {user && <RenewalFlow userId={user.id} subscriptionTier={subscriptionTier} />}
          <MyTrainerCard onOpenChat={() => setSection("chat")} />
          <HomeOverview dayPlans={dayPlans} macros={macros} meals={meals} onNavigate={(s) => setSection(s as MobileTab)} weeksActive={profileCreatedAt ? Math.floor((Date.now() - new Date(profileCreatedAt).getTime()) / (1000 * 60 * 60 * 24 * 7)) : 0} completedDays={completedDays} completedToday={completedToday} />
          {user && <TravelModeCard userId={user.id} />}
        </div>
      )}

      {hasPlan && section === "training" && user && (
        <div className="w-full min-w-0">
          <Suspense fallback={<SectionFallback />}>
            <WorkoutTracker
              userId={user.id}
              dayPlans={dayPlans}
              onExit={() => {
                setCompletedToday(true);
                setSection("home");
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

      {hasPlan && section === "nutrition" && !isTrainingOnly && (
        <div className="w-full space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Apple className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold font-display">Plan de Nutrición</h2>
            <InfoHint text="Estos son tus objetivos diarios. No hace falta clavarlos al gramo: acércate y sé constante." />
          </div>
          <Suspense fallback={<SectionFallback />}>
            <MealsList meals={meals} macros={macros as any} />
          </Suspense>
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" onClick={handleManageSubscription} className="text-muted-foreground">Gestionar suscripción</Button>
          </div>
        </div>
      )}

      {section === "chat" && (
        <div className="w-full space-y-4">
          <MyTrainerCard onOpenChat={undefined} />
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-2xl p-4 md:p-5 flex items-start gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><Video className="w-5 h-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-sm md:text-base mb-1">
                {paymentStatus === "unpaid" ? "Primera llamada gratis con tu entrenador" : "Videollamada con tu entrenador"}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                {paymentStatus === "unpaid"
                  ? "Cuéntale tu objetivo por aquí y hablad sin compromiso antes de suscribirte. Él prepara tu plan después."
                  : isTransform
                    ? "Tu plan Transformación 12 semanas incluye llamada inicial y check-ins semanales."
                    : "Pídela y tu entrenador te llamará aquí dentro de Autopilot, sin apps ni enlaces externos."}
              </p>
              <Button size="sm" variant="hero" onClick={requestVideoCall}>
                <Video className="w-3.5 h-3.5 mr-1.5" /> {paymentStatus === "unpaid" ? "Pedir llamada gratis" : "Pedir videollamada"}
              </Button>
            </div>
          </div>
          {user && (
            <Suspense fallback={<SectionFallback />}>
              <Chat conversationUserId={user.id} />
            </Suspense>
          )}
        </div>
      )}

      {hasPlan && section === "progress" && user && (
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Tu progreso</h2>
              <InfoHint text="Sube una foto cada 2 semanas, misma luz y misma hora. Es la forma más fiable de ver el cambio." />
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate(`/scan/user/${user.id}`)}>
              AI Scan
            </Button>
          </div>
          <WeeklyProgress userId={user.id} dayPlans={dayPlans} />
          <Suspense fallback={<SectionFallback />}>
            <ProgressPhotos userId={user.id} />
          </Suspense>
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
        lockedTabs={isTrainingOnly ? ["nutrition"] : []}
        onSettings={() => setSection("settings")}
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
        <UserSidebar
          section={section as UserSection}
          onNavigate={(s) => setSection(s as MobileTab)}
          onSignOut={handleSignOut}
          profileName={profileName}
          profileAvatar={profileAvatar}
          lockedSections={isTrainingOnly ? ["nutrition"] : []}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="app-chrome h-14 border-b sticky top-0 z-50 flex items-center px-4 gap-3">
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

          <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full">
              {pageContent}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
