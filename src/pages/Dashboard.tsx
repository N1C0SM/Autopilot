import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Apple, Clock, Loader2, Crown, Dumbbell, UtensilsCrossed, MessageCircle, Lock, Video, Sparkles } from "lucide-react";
import { Download, Calendar as CalendarIcon } from "lucide-react";
import NotificationsBell from "@/components/NotificationsBell";
import { toast } from "sonner";
import { motion } from "framer-motion";
import type { DayPlan } from "@/types/training";
import WeeklyProgress from "@/components/WeeklyProgress";
import Chat from "@/components/Chat";
import Greeting from "@/components/Greeting";
import HomeOverview from "@/components/dashboard/HomeOverview";
import TrainingPlanView from "@/components/dashboard/TrainingPlanView";
import CalendarView from "@/components/dashboard/CalendarView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PRsList from "@/components/dashboard/PRsList";
import TravelModeCard from "@/components/dashboard/TravelModeCard";
import MealsList from "@/components/dashboard/MealsList";
import UserSidebar from "@/components/UserSidebar";
import type { UserSection } from "@/components/UserSidebar";
import SettingsPanel from "@/components/SettingsPanel";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ReferralShare from "@/components/ReferralShare";
import { exportPlanPDF } from "@/lib/exportPlanPDF";
import MobileAppShell from "@/components/mobile/MobileAppShell";
import type { MobileTab } from "@/components/mobile/MobileTabBar";
import { useIsMobile } from "@/hooks/use-mobile";
import ProgressPhotos from "@/components/dashboard/ProgressPhotos";

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
  const [section, setSection] = useState<MobileTab>("home");
  const [profileCreatedAt, setProfileCreatedAt] = useState<string>("");
  const [completedDays, setCompletedDays] = useState(0);

  const fetchData = async () => {
    if (!user) return;
      // Sync subscription status with Stripe
      supabase.functions.invoke("check-subscription").catch(() => {});

      const { data: roleData } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (roleData) {
        navigate("/admin");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_status, payment_status, name, avatar_url, created_at, subscription_tier")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setPlanStatus(profile.plan_status);
        setPaymentStatus(profile.payment_status);
        setSubscriptionTier(((profile as any).subscription_tier as string) || "full");
        setProfileName((profile as any).name || "");
        setProfileAvatar((profile as any).avatar_url || "");
        setProfileCreatedAt((profile as any).created_at || "");

        if (profile.payment_status === "unpaid") { setLoading(false); return; }
        if (profile.plan_status === "onboarding") { navigate("/onboarding"); return; }

        if (profile.plan_status === "plan_ready") {
          const [{ data: tp }, { data: np }, { data: dc }] = await Promise.all([
            supabase.from("training_plan").select("workouts_json").eq("user_id", user.id).single(),
            supabase.from("nutrition_plan").select("macros_json, meals_json").eq("user_id", user.id).single(),
            supabase.from("day_completions").select("id").eq("user_id", user.id),
          ]);

          if (tp) setDayPlans(tp.workouts_json as unknown as DayPlan[]);
          if (np) {
            setMacros(np.macros_json as unknown as Macros);
            setMeals(np.meals_json as unknown as Meal[]);
          }
          setCompletedDays(dc?.length ?? 0);
        }
      }
      setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchData();

    // Realtime: refetch when this user's plan changes (e.g. after scan auto-apply)
    const channel = supabase
      .channel(`dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "training_plan", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "nutrition_plan", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .subscribe();

    // Refetch when tab regains focus (e.g. user returns from /scan)
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const handleCompletePayment = async (plan: "monthly" | "yearly" = "monthly") => {
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

  const handleManageSubscription = async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error || !data?.url) {
      toast.error("Error al abrir el portal de suscripción.");
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
    } as any);
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
  };

  const pageContent = (
    <>
      {/* Unpaid state — shown on all sections EXCEPT settings */}
      {paymentStatus === "unpaid" && section !== "settings" && (() => {
        const paywallContent: Record<MobileTab, { icon: React.ReactNode; title: string; description: string; cta: string }> = {
          home: { icon: <Crown className="w-8 h-8 text-primary" />, title: "Obtén tu plan personalizado", description: "Entrenamiento y nutrición 100% adaptados a ti. Chat con tu entrenador incluido.", cta: "Empezar 7 días gratis — €19/mes" },
          training: { icon: <Dumbbell className="w-8 h-8 text-primary" />, title: "Tu rutina te está esperando", description: "Ejercicios, series y descansos diseñados para tus objetivos. Actualizado cada semana por tu entrenador.", cta: "Desbloquear mi entrenamiento" },
          nutrition: { icon: <UtensilsCrossed className="w-8 h-8 text-primary" />, title: "Come según tu objetivo", description: "Plan de comidas con macros calculados para ti. Sin recetas genéricas, todo personalizado.", cta: "Desbloquear mi nutrición" },
          chat: { icon: <MessageCircle className="w-8 h-8 text-primary" />, title: "Habla con tu entrenador", description: "Resuelve dudas, ajusta tu plan y recibe feedback directo. Siempre disponible.", cta: "Activar chat con entrenador" },
          progress: { icon: <Crown className="w-8 h-8 text-primary" />, title: "Sigue tu progreso", description: "Sube fotos, ve tu evolución y desbloquea AI Scan.", cta: "Empezar 7 días gratis — €19/mes" },
          settings: { icon: <Crown className="w-8 h-8 text-primary" />, title: "Obtén tu plan personalizado", description: "Entrenamiento y nutrición 100% adaptados a ti.", cta: "Empezar 7 días gratis — €19/mes" },
        };
        const content = paywallContent[section] || paywallContent.home;
        return (
          <motion.div key={section} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="bg-card rounded-2xl p-6 md:p-10 border border-border card-shadow text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">{content.icon}</div>
            <h2 className="text-xl font-bold font-display mb-2">{content.title}</h2>
            <p className="text-muted-foreground mb-6 text-sm md:text-base">{content.description}</p>
            <Button variant="hero" size="lg" onClick={() => handleCompletePayment("monthly")} className="w-full md:w-auto">{content.cta}</Button>
            <button onClick={() => handleCompletePayment("yearly")} className="block mx-auto mt-4 text-xs text-primary hover:underline font-semibold flex items-center gap-1.5">
              <CalendarIcon className="w-3 h-3" /> O paga anual: 190€/año (ahorras 38€)
            </button>
            <p className="text-xs text-muted-foreground mt-3">Cancela cuando quieras · Garantía 30 días</p>
          </motion.div>
        );
      })()}

      {paymentStatus === "paid" && planStatus === "plan_pending" && section === "home" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-6 md:p-10 border border-border card-shadow text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"><Clock className="w-8 h-8 text-primary" /></div>
          <h2 className="text-xl font-bold font-display mb-2">Tu plan se está creando 🔥</h2>
          <p className="text-muted-foreground mb-2">Nuestro equipo está trabajando en tu plan personalizado.</p>
          <p className="text-sm text-primary font-medium">Recibirás una notificación en menos de 48h.</p>
        </motion.div>
      )}

      {hasPlan && section === "home" && (
        <div className="max-w-4xl mx-auto space-y-6">
          <HomeOverview dayPlans={dayPlans} macros={macros} meals={meals} onNavigate={(s) => setSection(s as MobileTab)} weeksActive={profileCreatedAt ? Math.floor((Date.now() - new Date(profileCreatedAt).getTime()) / (1000 * 60 * 60 * 24 * 7)) : 0} completedDays={completedDays} />
          {user && <TravelModeCard userId={user.id} />}
        </div>
      )}

      {hasPlan && section === "training" && user && (
        <Tabs defaultValue="list" className="max-w-5xl">
          <TabsList className="mb-4">
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="calendar">Calendario</TabsTrigger>
          </TabsList>
          <TabsContent value="list"><TrainingPlanView dayPlans={dayPlans} /></TabsContent>
          <TabsContent value="calendar"><CalendarView dayPlans={dayPlans} /></TabsContent>
        </Tabs>
      )}

      {hasPlan && section === "nutrition" && isTrainingOnly && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl p-6 md:p-10 border border-border card-shadow text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"><Lock className="w-8 h-8 text-primary" /></div>
          <h2 className="text-xl font-bold font-display mb-2">Nutrición no incluida en tu plan</h2>
          <p className="text-muted-foreground mb-6 text-sm md:text-base">Tu plan actual es <span className="text-foreground font-semibold">Entrenamiento</span>. Cambia a <span className="text-foreground font-semibold">Completo</span> para desbloquear tu plan de nutrición personalizado.</p>
          <Button variant="hero" size="lg" onClick={handleManageSubscription} className="w-full md:w-auto">Mejorar a Completo — 49€/mes</Button>
        </motion.div>
      )}

      {hasPlan && section === "nutrition" && !isTrainingOnly && (
        <div className="max-w-4xl space-y-6">
          <div className="flex items-center gap-2 mb-2"><Apple className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold font-display">Plan de Nutrición</h2></div>
          {macros && (
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {[{ label: "Proteína", value: `${macros.protein}g` }, { label: "Carbos", value: `${macros.carbs}g` }, { label: "Grasas", value: `${macros.fats}g` }].map((m) => (
                <motion.div key={m.label} whileHover={{ scale: 1.03 }} className="bg-card rounded-xl p-4 md:p-5 border border-border text-center hover:border-primary/30 transition-colors">
                  <div className="text-xl md:text-2xl font-bold font-display text-gradient">{m.value}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">{m.label}</div>
                </motion.div>
              ))}
            </div>
          )}
          <div className="bg-card rounded-xl p-4 md:p-6 border border-border">
            <h3 className="font-bold font-display mb-1">Comidas</h3>
            <p className="text-xs text-muted-foreground mb-3">Doble click en una comida para marcarla como hecha hoy ✓</p>
            <MealsList meals={meals} />
          </div>
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" onClick={handleManageSubscription} className="text-muted-foreground">Gestionar suscripción</Button>
          </div>
        </div>
      )}

      {hasPlan && section === "chat" && (
        <div className="max-w-3xl">
          {canRequestVideoCall && (
            <div className="mb-4 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-2xl p-4 md:p-5 flex items-start gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><Video className="w-5 h-5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-sm md:text-base mb-1">Videollamada por Google Meet</h3>
                <p className="text-xs text-muted-foreground mb-3">{isTransform ? "Tu plan Transformación 12 semanas incluye llamada inicial y check-ins semanales." : "Tu plan Completo incluye videollamadas con tu entrenador. Solicita una y te enviará el enlace de Google Meet por aquí."}</p>
                <Button size="sm" variant="hero" onClick={requestVideoCall}><Video className="w-3.5 h-3.5 mr-1.5" /> Pedir videollamada</Button>
              </div>
            </div>
          )}
          {user && <Chat conversationUserId={user.id} />}
        </div>
      )}

      {hasPlan && section === "progress" && user && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Tu progreso</h2>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate(`/scan/user/${user.id}`)}>
              AI Scan
            </Button>
          </div>
          <WeeklyProgress userId={user.id} dayPlans={dayPlans} />
          <ProgressPhotos userId={user.id} />
        </div>
      )}

      {section === "settings" && (
        <div className="max-w-2xl"><SettingsPanel /></div>
      )}
    </>
  );

  // Mobile: app shell con barra inferior tipo nativa
  if (isMobile) {
    return (
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
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <UserSidebar
          section={(section === "progress" ? "home" : section) as UserSection}
          onNavigate={(s) => setSection(s as MobileTab)}
          onSignOut={handleSignOut}
          profileName={profileName}
          profileAvatar={profileAvatar}
          lockedSections={isTrainingOnly ? ["nutrition"] : []}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50 flex items-center px-4 gap-3">
            <SidebarTrigger />
            <h1 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground flex-1">
              {SECTION_LABELS[section]}
            </h1>
            {user && <NotificationsBell userId={user.id} />}
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            {pageContent}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
