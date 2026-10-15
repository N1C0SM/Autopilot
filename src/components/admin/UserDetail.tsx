import { getSportSchedules, getCustomActivities } from "@/lib/availability";
import { jsonObject, jsonString } from "@/lib/runtimeValues";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Chat from "@/components/Chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Save, ShieldCheck, User2, Dumbbell, Apple, MessageCircle, Zap, Wand2, Trash2, TrendingUp, Calendar, AlertTriangle, Sparkles, Eye, Target, MoreHorizontal, KeyRound, UserRound, Crown } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ListGroup, ListRow } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/empty-state";
import { hapticTap, hapticSelection } from "@/lib/native";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PLAN_LABEL, TIERS } from "@/config/tiers";
import { getConsumerPlan, resolveFeatures } from "@/lib/entitlements";
import { nutritionMacroError } from "@/lib/nutritionValidation";
import UserProgressPanel from "./UserProgressPanel";
import UserGoalPanel from "./UserGoalPanel";
import TransformCyclePanel from "./TransformCyclePanel";
import CalendarView from "@/components/dashboard/CalendarView";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Profile } from "@/pages/Admin";
import type { Json } from "@/integrations/supabase/types";
import type { DayPlan } from "@/types/training";
import TrainingPlanForm from "./TrainingPlanForm";
import { impersonateUser } from "@/lib/impersonate";
import OnboardingEditor from "./OnboardingEditor";

type TierDetails = { price: number; interval: string; tagline: string; features: readonly string[] };

const TIER_OPTIONS: { value: string; label: string; fallback: TierDetails }[] = [
  {
    value: "training",
    label: "Entrenamiento",
    fallback: { price: 29, interval: "month", tagline: "Plan de entrenamiento con seguimiento.", features: [] },
  },
  {
    value: "full",
    label: "Completo",
    fallback: { price: 49, interval: "month", tagline: "Entrenamiento y nutrición con seguimiento.", features: [] },
  },
  {
    value: "transform",
    label: "Transformación 12 semanas",
    fallback: {
      price: 299,
      interval: "one_time",
      tagline: "Acompañamiento intensivo de 12 semanas.",
      features: ["Entrenamiento y nutrición", "Seguimiento cercano del entrenador"],
    },
  },
];

interface OnboardingData {
  age: number | null;
  height: number | null;
  weight: number | null;
  sex: string | null;
  goal: string | null;
  sports: string | null;
  injuries: string | null;
  intensity_level: number | null;
  availability: Json | null;
  nutrition_preferences: string | null;
  allergies: string | null;
  equipment_type: string | null;
  specific_goal: string | null;
}

// ─── Macro Templates ───
const MACRO_TEMPLATES: Record<string, { label: string; calc: (weight: number) => { protein: number; carbs: number; fats: number } }> = {
  gain_muscle: {
    label: "Ganar músculo",
    calc: (w) => ({ protein: Math.round(w * 2.2), carbs: Math.round(w * 4), fats: Math.round(w * 1) }),
  },
  lose_weight: {
    label: "Perder grasa",
    calc: (w) => ({ protein: Math.round(w * 2.4), carbs: Math.round(w * 2), fats: Math.round(w * 0.8) }),
  },
  recomp: {
    label: "Recomposición",
    calc: (w) => ({ protein: Math.round(w * 2.2), carbs: Math.round(w * 3), fats: Math.round(w * 0.9) }),
  },
  maintenance: {
    label: "Mantenimiento",
    calc: (w) => ({ protein: Math.round(w * 1.8), carbs: Math.round(w * 3.5), fats: Math.round(w * 1) }),
  },
};

interface Props {
  profile: Profile;
  onBack: () => void;
  onUpdate: (userId: string, updates: Partial<Profile>) => void;
  onDelete?: (userId: string) => void;
  restricted?: boolean;
  isTargetTrainer?: boolean;
  isTargetAdmin?: boolean;
}

const UserDetail = ({ profile, onBack, onUpdate, onDelete, restricted = false, isTargetTrainer = false, isTargetAdmin = false }: Props) => {
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [macros, setMacros] = useState({ protein: "", carbs: "", fats: "" });
  const [mealsText, setMealsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isUserTrainer, setIsUserTrainer] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [trainers, setTrainers] = useState<{ user_id: string; email: string }[]>([]);
  const [assignedTrainerId, setAssignedTrainerId] = useState<string>("");
  const [chatTarget, setChatTarget] = useState<"client" | "trainer">("client");
  const [trainerSaving, setTrainerSaving] = useState(false);
  const [editingOnboarding, setEditingOnboarding] = useState(false);
  const [showGoalDetails, setShowGoalDetails] = useState(false);
  const [tierSaving, setTierSaving] = useState(false);



  useEffect(() => {
    let active = true;
    let requestId = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const fetchData = async () => {
      const currentRequest = ++requestId;
      const [{ data: onb }, { data: roleData }, { data: trainerRoleData }, { data: tp }, { data: np }] = await Promise.all([
        supabase.from("onboarding").select("*").eq("user_id", profile.user_id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", profile.user_id).eq("role", "admin").maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", profile.user_id).eq("role", "trainer").maybeSingle(),
        supabase.from("training_plan").select("workouts_json").eq("user_id", profile.user_id).maybeSingle(),
      supabase.from("nutrition_plan").select("macros_json, meals_json").eq("user_id", profile.user_id).maybeSingle(),
      ]);
      if (!active || currentRequest !== requestId) return;
      setOnboarding(onb as OnboardingData | null);
      setIsUserAdmin(!!roleData);
      setIsUserTrainer(!!trainerRoleData);
      

      if (tp?.workouts_json) {
        const existing = tp.workouts_json as unknown as DayPlan[];
        if (Array.isArray(existing) && existing.length > 0) setDayPlans(existing);
      }

      if (np?.macros_json) {
        const m = jsonObject(np.macros_json);
        const cargados = { protein: m.protein?.toString() || "", carbs: m.carbs?.toString() || "", fats: m.fats?.toString() || "" };
        // Datos antiguos fuera de rango: se recalculan en vez de bloquear el guardado.
        if (nutritionMacroError(cargados)) {
          const w = Number((onb as OnboardingData | null)?.weight);
          const fixed = Number.isFinite(w) && w > 0 ? MACRO_TEMPLATES.gain_muscle.calc(w) : null;
          setMacros(fixed ? { protein: String(fixed.protein), carbs: String(fixed.carbs), fats: String(fixed.fats) } : { protein: "", carbs: "", fats: "" });
          toast.info(fixed ? "Los macros guardados no eran válidos: se han recalculado. Revisa y pulsa Guardar." : "Los macros guardados no eran válidos: rellénalos y pulsa Guardar.", { id: "macro-heal" });
        } else {
          setMacros(cargados);
        }
      }
      if (np?.meals_json) {
        const meals = np.meals_json;
        if (Array.isArray(meals)) {
          setMealsText(meals.map(jsonObject).map(m => `${jsonString(m.name)}: ${jsonString(m.description)}`).join("\n"));
        }
      }
      setDataLoading(false);
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void fetchData(); }, 150);
    };

    setDataLoading(true);
    void fetchData();
    const channel = supabase.channel(`client-detail-${profile.user_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding", filter: `user_id=eq.${profile.user_id}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "training_plan", filter: `user_id=eq.${profile.user_id}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "nutrition_plan", filter: `user_id=eq.${profile.user_id}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${profile.user_id}` }, scheduleRefresh)
      .subscribe((status) => {
        // Una caída momentánea del canal no debe alarmar: reintentamos en silencio.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[UserDetail] realtime status", status);
          scheduleRefresh();
        }
      });

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [profile.user_id]);

  // Load trainers + current assignment for this user (admin only)
  useEffect(() => {
    if (restricted) return;
    (async () => {
      const [{ data: roles }, { data: assignment }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "trainer"),
        supabase.from("trainer_assignments").select("trainer_id").eq("user_id", profile.user_id).maybeSingle(),
      ]);
      const trainerIds = (roles || []).map((r) => r.user_id);
      if (trainerIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", trainerIds);
        setTrainers((profs || []).map((p) => ({ user_id: p.user_id, email: p.email })));
      }
      setAssignedTrainerId(assignment?.trainer_id || "");
    })();
  }, [profile.user_id, restricted]);

  const assignTrainer = async (trainerId: string) => {
    setTrainerSaving(true);
    // Replace existing assignment for this user
    await supabase.from("trainer_assignments").delete().eq("user_id", profile.user_id);
    if (trainerId && trainerId !== "__none__") {
      const { error } = await supabase
        .from("trainer_assignments")
        .insert({ trainer_id: trainerId, user_id: profile.user_id });
      if (error) {
        toast.error("Error: " + error.message);
        setTrainerSaving(false);
        return;
      }
      setAssignedTrainerId(trainerId);
      toast.success("Entrenador asignado");
    } else {
      setAssignedTrainerId("");
      toast.success("Entrenador desasignado");
    }
    setTrainerSaving(false);
  };

  const toggleAdminRole = async () => {
    setRoleLoading(true);
    if (isUserAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", profile.user_id).eq("role", "admin");
      if (!error) { setIsUserAdmin(false); toast.success("Rol de admin eliminado"); }
      else toast.error("Error al cambiar rol");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: profile.user_id, role: "admin" });
      if (!error) { setIsUserAdmin(true); toast.success("Rol de admin asignado"); }
      else toast.error("Error al cambiar rol");
    }
    setRoleLoading(false);
  };

  const toggleTrainerRole = async () => {
    setRoleLoading(true);
    if (isUserTrainer) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", profile.user_id).eq("role", "trainer");
      if (!error) { setIsUserTrainer(false); toast.success("Rol de entrenador eliminado"); }
      else toast.error("Error al cambiar rol de entrenador");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: profile.user_id, role: "trainer" });
      if (!error) { setIsUserTrainer(true); toast.success("Rol de entrenador asignado"); }
      else toast.error("Error al cambiar rol de entrenador");
    }
    setRoleLoading(false);
  };

  const handleDeleteUser = async () => {
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { target_user_id: profile.user_id },
    });
    if (error || !data?.success) {
      toast.error("Error al eliminar usuario: " + (error?.message || data?.error || "Error desconocido"));
      setDeleting(false);
      return;
    }
    toast.success("Usuario eliminado correctamente");
    onDelete?.(profile.user_id);
    onBack();
  };

  const applyMacroTemplate = (key: string) => {
    const tpl = MACRO_TEMPLATES[key];
    const weight = onboarding?.weight;
    if (!weight || !Number.isFinite(weight) || weight <= 0) {
      toast.error("Añade el peso actual del cliente antes de calcular sus macros.");
      return;
    }
    const result = tpl.calc(weight);
    setMacros({
      protein: result.protein.toString(),
      carbs: result.carbs.toString(),
      fats: result.fats.toString(),
    });
    toast.success(`Macros calculados para ${weight}kg (${tpl.label})`);
  };

  const savePlans = async () => {
    const macroError = canViewNutrition ? nutritionMacroError(macros, onboarding?.weight) : null;
    if (macroError) { toast.error(macroError); return; }
    setSaving(true);
    const meals = mealsText.split("\n").filter(Boolean).map((line) => {
      const [name, ...rest] = line.split(":");
      return { name: name?.trim() || "", description: rest.join(":").trim() || "" };
    });

    const { error: tpError } = await supabase.from("training_plan").upsert({
      user_id: profile.user_id,
      workouts_json: dayPlans as unknown as Json,
    }, { onConflict: "user_id" });

    const { error: npError } = canViewNutrition ? await supabase.from("nutrition_plan").upsert({
      user_id: profile.user_id,
      macros_json: [macros.protein, macros.carbs, macros.fats].every((value) => Number(value) > 0)
        ? { protein: Number(macros.protein), carbs: Number(macros.carbs), fats: Number(macros.fats) } as unknown as Json
        : {} as unknown as Json,
      meals_json: meals as unknown as Json,
    }, { onConflict: "user_id" }) : { error: null };

    if (!tpError && !npError) {
      await supabase.from("profiles").update({ plan_status: "plan_ready" }).eq("user_id", profile.user_id);
      toast.success("Planes guardados y usuario notificado");
      onUpdate(profile.user_id, { plan_status: "plan_ready" });
    } else {
      toast.error("Error al guardar los planes.");
    }
    setSaving(false);
  };

  const autoGeneratePlan = async () => {
    // Sin datos de onboarding el generador no puede calcular nada: avisamos en claro.
    if (!onboarding || !onboarding.age || !onboarding.weight || !onboarding.height) {
      toast.error("Este cliente no tiene el cuestionario completo. Rellena edad, altura, peso y objetivo en «Datos del cliente» y vuelve a intentarlo.");
      return;
    }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-plan", {
      body: { user_id: profile.user_id },
    });
    const failMsg = String(error?.message || data?.error || "");
    if (error || !data?.success) {
      toast.error(
        /onboarding/i.test(failMsg)
          ? "Faltan datos del cuestionario de este cliente. Complétalos en «Datos del cliente» y vuelve a generar."
          : "No se pudo generar el plan. " + (failMsg || "Inténtalo de nuevo en unos segundos."),
      );
      setGenerating(false);
      return;
    }

    // Reload the plan data
    const [{ data: tp }, { data: np }] = await Promise.all([
      supabase.from("training_plan").select("workouts_json").eq("user_id", profile.user_id).maybeSingle(),
      supabase.from("nutrition_plan").select("macros_json, meals_json").eq("user_id", profile.user_id).maybeSingle(),
    ]);

    if (tp?.workouts_json) {
      const plans = tp.workouts_json as unknown as DayPlan[];
      if (Array.isArray(plans)) setDayPlans(plans);
    }
    if (np?.macros_json) {
      const m = jsonObject(np.macros_json);
      setMacros({ protein: m.protein?.toString() || "", carbs: m.carbs?.toString() || "", fats: m.fats?.toString() || "" });
    }
    if (np?.meals_json) {
      const meals = np.meals_json;
      if (Array.isArray(meals)) {
        setMealsText(meals.map(jsonObject).map(m => `${jsonString(m.name)}: ${jsonString(m.description)}`).join("\n"));
      }
    }

    onUpdate(profile.user_id, { plan_status: "plan_ready" });
    toast.success(data.macros
      ? `Plan generado: ${data.training_days} días de entrenamiento, macros: P${data.macros.protein}/C${data.macros.carbs}/F${data.macros.fats}`
      : `Plan de entrenamiento generado para ${data.training_days} días. Faltan datos para calcular macros.`);
    setGenerating(false);
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" className="text-primary" label="Cargando" />
      </div>
    );
  }

  const goalLabel: Record<string, string> = {
    lose_weight: "Perder grasa",
    gain_muscle: "Ganar músculo",
    recomp: "Recomposición",
    improve_endurance: "Mejorar resistencia",
    general_health: "Salud general",
  };

  const clientFeatures = resolveFeatures(getConsumerPlan(profile));
  const canMessageClient = clientFeatures.has("coachMessaging");
  const canViewNutrition = clientFeatures.has("nutritionPlan");

  // ─── Reduced view for trainers / admins ───
  if (isTargetTrainer || isTargetAdmin) {
    return (
      <StaffDetail
        profile={profile}
        onBack={onBack}
        onDelete={onDelete}
        kind={isTargetAdmin ? "admin" : "trainer"}
        restricted={restricted}
        deleting={deleting}
        setDeleting={setDeleting}
      />
    );
  }

  const hasAccess = profile.payment_status === "paid";
  const currentTier = (profile.subscription_tier as string) || undefined;

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-start sm:gap-3">
       <div className="flex items-start gap-3 min-w-0 sm:flex-1">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-11 w-11 shrink-0" aria-label="Volver a clientes">
          <ArrowLeft className="w-5 h-5" />
        </Button>
       <Avatar className="w-11 h-11 shrink-0">
         <AvatarImage src={profile.avatar_url || undefined} alt={profile.name?.trim() || "Foto del cliente"} />
         <AvatarFallback className="bg-secondary font-semibold text-muted-foreground">
           {(profile.name?.trim() || profile.email).charAt(0).toUpperCase()}
         </AvatarFallback>
       </Avatar>
       <div className="flex-1 min-w-0">
         <h1 className="type-title3 md:text-xl break-all">{profile.name?.trim() || profile.email}</h1>
         {profile.name?.trim() && <p className="type-footnote text-muted-foreground break-all selectable">{profile.email}</p>}
        </div>
       </div>
       <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:shrink-0">
        {profile.payment_status === "paid" && (
          <>
            <Button variant="tinted" onClick={autoGeneratePlan} disabled={generating} className="min-h-11 flex-1 sm:flex-none">
              <Wand2 className="w-4 h-4 mr-1.5" /> {generating ? "Generando…" : "Auto-generar"}
            </Button>
            <Button variant="hero" onClick={savePlans} disabled={saving} className="min-h-11 flex-1 sm:flex-none">
              <Save className="w-4 h-4 mr-1.5" /> {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        )}
        {!restricted && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="shrink-0" aria-label="Más acciones">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => impersonateUser(profile.user_id, "/dashboard")}>
                  <Eye className="w-4 h-4 mr-2" /> Ver como
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Eliminar usuario
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán permanentemente todos los datos de <strong>{profile.email}</strong>: perfil, planes, entrenamientos, chat, fotos y cuenta. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction destructive onClick={handleDeleteUser}>
                    {deleting ? "Eliminando…" : "Eliminar"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
       </div>
      </div>


      {/* Tabs */}
      <Tabs key={profile.user_id} defaultValue={restricted ? "summary" : "info"} className="min-w-0 space-y-6">
        <TabsList className="w-full max-w-full flex justify-start overflow-x-auto no-scrollbar h-auto" aria-label="Ficha del cliente">
          {restricted && <TabsTrigger value="summary" className="min-h-11 shrink-0 gap-1.5 whitespace-nowrap"><Target className="w-3.5 h-3.5" /> Plan</TabsTrigger>}
          {!restricted && <TabsTrigger value="info" className="group shrink-0 sm:flex-1 sm:min-w-0 min-h-11 gap-1.5 whitespace-nowrap">
            <Target className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Plan</span>
           </TabsTrigger> }
          <TabsTrigger value="perfil" className="group shrink-0 sm:flex-1 sm:min-w-0 min-h-11 gap-1.5 whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Perfil</span>
           </TabsTrigger>
          {!restricted && (
            <TabsTrigger value="acceso" className="group shrink-0 sm:flex-1 sm:min-w-0 min-h-11 gap-1.5 whitespace-nowrap">
              <KeyRound className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Acceso</span>
            </TabsTrigger>
          )}
          {profile.payment_status === "paid" && (
            <>
              <TabsTrigger value="progress" className="group shrink-0 sm:flex-1 sm:min-w-0 min-h-11 gap-1.5 whitespace-nowrap">
                <TrendingUp className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Progreso</span>
               </TabsTrigger>
              <TabsTrigger value="training" className="group shrink-0 sm:flex-1 sm:min-w-0 min-h-11 gap-1.5 whitespace-nowrap">
                <Dumbbell className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Entreno</span>
              </TabsTrigger>
              {canViewNutrition && (
                <TabsTrigger value="nutrition" className="group shrink-0 sm:flex-1 sm:min-w-0 min-h-11 gap-1.5 whitespace-nowrap">
                  <Apple className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Nutrición</span>
                </TabsTrigger>
              )}
              {canMessageClient && (
                <TabsTrigger value="chat" className="group shrink-0 sm:flex-1 sm:min-w-0 min-h-11 gap-1.5 whitespace-nowrap">
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Chat</span>
                </TabsTrigger>
              )}
            </>
          )}
        </TabsList>

        {restricted && <TabsContent value="summary" className="space-y-4">
          <section className="space-y-4">
            <h2 className="type-title2">Resumen del plan</h2>
            <p className="type-subhead text-muted-foreground">{dayPlans.length ? `${dayPlans.length} sesiones guardadas para este cliente.` : "Este cliente aún no tiene sesiones guardadas."}</p>
            {dayPlans.length > 0 && <ul className="overflow-hidden rounded-2xl bg-card">{dayPlans.map((plan, index) => <li key={`${plan.day}-${index}`} className="px-4 py-3 sep-t first:before:hidden"><span className="type-headline">{plan.day}</span><span className="type-subhead block break-words text-muted-foreground">{plan.type === "gimnasio" ? (plan.routine_name || "Entrenamiento") : (plan.sport || "Actividad")} · {plan.type === "gimnasio" ? `${plan.exercises?.length || 0} ejercicios` : (plan.duration || "Duración pendiente")}</span></li>)}</ul>}
            {!onboarding && <p className="type-subhead text-muted-foreground">Falta completar el perfil del cliente. Pide al administrador que revise sus datos.</p>}
            {!("subscription_tier" in profile) && <p role="status" className="type-subhead text-muted-foreground">La información de acceso del cliente está pendiente de actualizar. El chat con el cliente aparecerá cuando se confirme su acceso Coach.</p>}
            {"subscription_tier" in profile && !canMessageClient && <p className="type-subhead text-muted-foreground">Este cliente no tiene acceso activo al chat de seguimiento Coach.</p>}
          </section>
        </TabsContent>}

        {/* Tab: Info (incluye Plan y acceso) */}
        <TabsContent value="info" className="space-y-6">
        {!restricted && (
            <div className="space-y-4">
              <div>
                <h2 className="type-title2">Plan</h2>
                <p className="type-subhead text-muted-foreground mt-1">Toca un plan para aplicarlo al instante. No genera ningún cobro.</p>
              </div>
              <div className="grid gap-2 grid-cols-3">
                {([
                  { value: "free", name: "Free", price: TIERS.free.price },
                  { value: "training", name: "Plus", price: TIERS.training.price },
                  { value: "full", name: "Coach", price: TIERS.full.price },
                ] as const).map((opt) => {
                  const active = opt.value === "free"
                    ? !hasAccess
                    : hasAccess && (opt.value === "full"
                        ? ["full", "transform", "personal", "coach"].includes(currentTier || "")
                        : ["training", "plus"].includes(currentTier || ""));
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      disabled={tierSaving || active}
                      onClick={async () => {
                        void hapticSelection();
                        const updates: import("@/integrations/supabase/types").TablesUpdate<"profiles"> = opt.value === "free"
                          ? { payment_status: "unpaid", subscription_status: "inactive" }
                          : {
                              subscription_tier: opt.value,
                              payment_status: "paid",
                              subscription_status: "active",
                              plan_status: profile.plan_status === "onboarding" ? "plan_pending" : profile.plan_status,
                            };
                        setTierSaving(true);
                        const { error } = await supabase.from("profiles").update(updates).eq("user_id", profile.user_id);
                        if (error) { setTierSaving(false); return toast.error("No se pudo cambiar el plan"); }
                        // Mark the plan as manually granted so automated checks never downgrade it.
                        await supabase.from("entitlements").update({ status: "canceled" })
                          .eq("user_id", profile.user_id).eq("source", "manual");
                        if (opt.value !== "free") {
                          const plan = opt.value === "training" ? "plus" : "coach";
                          await supabase.from("entitlements").upsert({
                            user_id: profile.user_id, plan, source: "manual", status: "active", expires_at: null,
                          }, { onConflict: "user_id,plan,source" });
                        }
                        setTierSaving(false);
                        onUpdate(profile.user_id, updates);
                        toast.success(`Plan: ${opt.name}`);
                      }}
                      className={`min-touch rounded-2xl p-4 text-center transition-colors ease-ios-standard active:opacity-70 disabled:cursor-default ${
                        active ? "bg-primary text-primary-foreground" : "bg-card"
                      }`}
                    >
                      <div className="type-headline">{opt.name}</div>
                      <div className={`type-footnote mt-1 tabular-nums ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{opt.price} €/mes</div>
                      {active && <div className="type-caption2 mt-1 font-semibold">Actual</div>}
                    </button>
                  );
                })}
              </div>
              {tierSaving && <Spinner size="sm" className="mx-auto text-primary" label="Guardando" />}
            </div>
          )}

          {profile.subscription_tier === "transform" && (
            <TransformCyclePanel
              userId={profile.user_id}
              cycleStartDate={(profile.cycle_start_date as string) || null}
              renewalDecision={(profile.renewal_decision as string) || null}
              disabled={restricted}
            />
          )}
        </TabsContent>

        {/* Tab: Perfil (roles, entrenador responsable y datos del cliente) */}
        <TabsContent value="perfil" className="space-y-6">

          {editingOnboarding && !restricted ? (
            <OnboardingEditor
              userId={profile.user_id}
              data={onboarding}
              onSaved={(next) => { setOnboarding(next as OnboardingData); setEditingOnboarding(false); }}
              onCancel={() => setEditingOnboarding(false)}
            />
          ) : onboarding ? (
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="type-title2">Perfil del cliente</h2>
                {!restricted && (
                  <Button size="sm" variant="tinted" onClick={() => setEditingOnboarding(true)}>Editar</Button>
                )}
              </div>
              {(() => {
                const av = jsonObject(onboarding.availability);
                const sportSchedules = getSportSchedules(onboarding.availability);
                const customActivities = getCustomActivities(onboarding.availability);
                const dowNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                const formatSchedule = (s: { dow: number; start: string; end: string }) =>
                  `${dowNames[s.dow] ?? "?"} ${s.start}–${s.end}`;
                const days = av?.days ? `${av.days} días/sem` : null;
                const hours = av?.hours ? `${av.hours}h por sesión` : null;
                const summary = [days, hours].filter(Boolean).join(" · ") || null;
                return (
              <div className="grid sm:grid-cols-2 sm:gap-x-6 gap-y-5">
                {[
                  { label: "Edad", value: onboarding.age },
                  { label: "Sexo", value: onboarding.sex === "male" ? "Hombre" : onboarding.sex === "female" ? "Mujer" : null },
                  { label: "Altura", value: onboarding.height ? `${onboarding.height} cm` : null },
                  { label: "Peso", value: onboarding.weight ? `${onboarding.weight} kg` : null },
                  { label: "Equipamiento", value: onboarding.equipment_type ? onboarding.equipment_type : null },
                  { label: "Objetivo", value: onboarding.goal ? (goalLabel[onboarding.goal] || onboarding.goal) : null },
                  { label: "Meta específica", value: onboarding.specific_goal ? onboarding.specific_goal : null },
                  { label: "Deportes", value: onboarding.sports },
                  { label: "Intensidad", value: onboarding.intensity_level ? `${onboarding.intensity_level}/10` : null },
                  { label: "Disponibilidad", value: summary },
                  { label: "Días elegidos", value: Array.isArray(av?.training_days) ? av.training_days.map((d: number) => dowNames[d]).join(", ") : null },
                  { label: "Estructura", value: ({ full_body: "Full Body", torso_pierna: "Torso / Pierna", ppl: "Empuje / Tirón / Pierna", coach: "Elige el entrenador" } as Record<string, string>)[jsonString(av.structure)] || null },
                  { label: "Revisión preferida", value: av?.checkin_time ? `${dowNames[typeof av.checkin_dow === "number" ? av.checkin_dow : -1] ?? "?"} ${av.checkin_time}` : null },
                  { label: "Estilo de coach", value: ({ direct: "Directo y exigente", flexible: "Flexible y realista", technical: "Técnico y analítico" } as Record<string, string>)[jsonString(av.coach_style)] || null },
                  { label: "Cocina", value: ({ quick: "Rápido / sin tiempo", normal: "Algo de cocina", loves: "Le gusta cocinar" } as Record<string, string>)[jsonString(av.cooking)] || null },
                  { label: "Modalidad", value: av?.training_mode === "pareja" ? `En pareja · ${av.partner_email || ""}` : av?.training_mode ? "Individual" : null },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 sep-b pb-3">
                    <div className="type-footnote text-muted-foreground">{item.label}</div>
                    <div className="type-body break-words selectable">{item.value || "—"}</div>
                  </div>
                ))}
                {Object.keys(sportSchedules).length > 0 && (
                  <div className="sm:col-span-2">
                    <div className="type-footnote text-muted-foreground mb-2">Horarios de deportes</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(sportSchedules).map(([sport, sched]) => (
                        <div key={sport} className="bg-card rounded-full px-3 py-1.5 type-footnote">
                          <span className="font-semibold capitalize">{sport}</span>
                          <span className="text-muted-foreground ml-2">{formatSchedule(sched)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {customActivities.length > 0 && (
                  <div className="sm:col-span-2">
                    <div className="type-footnote text-muted-foreground mb-2">Actividades personalizadas</div>
                    <div className="flex flex-wrap gap-2">
                      {customActivities.map((act, i) => (
                        <div key={i} className="bg-card rounded-full px-3 py-1.5 type-footnote">
                          <span className="font-semibold">{act.title}</span>
                          <span className="text-muted-foreground ml-2">{formatSchedule(act)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {onboarding.injuries && (
                  <div className="sm:col-span-2 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-destructive mt-0.5" />
                    <div className="min-w-0">
                    <div className="type-headline text-destructive">Lesiones y condiciones</div>
                    <div className="type-subhead break-words selectable">{onboarding.injuries}</div>
                    </div>
                  </div>
                )}
                <div className="sm:col-span-2 sep-b pb-3">
                  <div className="type-footnote text-muted-foreground">Preferencias nutricionales</div>
                  <div className="type-body break-words selectable">{onboarding.nutrition_preferences || "—"}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="type-footnote text-muted-foreground">Alergias</div>
                  <div className="type-body break-words selectable">{onboarding.allergies || "—"}</div>
                </div>
              </div>
                );
              })()}
            </div>
          ) : (
            <EmptyState
              icon={UserRound}
              title="Aún no hay datos de perfil"
              action={!restricted ? <Button size="sm" variant="plain" onClick={() => setEditingOnboarding(true)}>Añadir datos</Button> : undefined}
            />
          )}
          {profile.payment_status === "paid" && (
            <details
              className="rounded-2xl bg-card px-4"
              onToggle={(event) => setShowGoalDetails(event.currentTarget.open)}
            >
              <summary className="min-h-11 cursor-pointer list-none flex items-center justify-between gap-3 active:opacity-70">
                <span className="flex items-center gap-2 type-body">
                  <Target className="w-5 h-5 text-muted-foreground" />
                  Físico objetivo
                </span>
                <span className="type-subhead text-muted-foreground">{showGoalDetails ? "Ocultar" : "Ver"}</span>
              </summary>
              {showGoalDetails && (
                <div className="sep-t mt-1 py-4">
                  <UserGoalPanel userId={profile.user_id} email={profile.email} />
                </div>
              )}
            </details>
          )}
        </TabsContent>

        {/* Tab: Acceso (roles y entrenador responsable, aparte del perfil para no acumular scroll) */}
        {!restricted && (
          <TabsContent value="acceso" className="space-y-6">
          <div className="space-y-6">
              <div>
                <h2 className="type-title2">{["full", "transform", "personal", "coach"].includes(currentTier || "") ? "Roles y entrenador responsable" : "Roles"}</h2>
                <p className="type-subhead text-muted-foreground mt-1">Controla los permisos de esta cuenta{["full", "transform", "personal", "coach"].includes(currentTier || "") ? " y quién acompaña al cliente" : ""}.</p>
              </div>

              <ListGroup>
                <ListRow
                  icon={<ShieldCheck className="text-muted-foreground" />}
                  title="Administrador"
                  subtitle="Puede gestionar la administración de Autopilot."
                  trailing={<Switch checked={isUserAdmin} onCheckedChange={toggleAdminRole} disabled={roleLoading} aria-label="Asignar rol de administrador" />}
                />
                <ListRow
                  icon={<Dumbbell className="text-muted-foreground" />}
                  title="Entrenador"
                  subtitle="Puede entrar al panel de entrenador y gestionar clientes asignados."
                  trailing={<Switch checked={isUserTrainer} onCheckedChange={toggleTrainerRole} disabled={roleLoading} aria-label="Asignar rol de entrenador" />}
                />
              </ListGroup>

              {["full", "transform", "personal", "coach"].includes(currentTier || "") && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User2 className="w-6 h-6 text-primary shrink-0" />
                  <div>
                    <div className="type-headline">Entrenador responsable</div>
                    <div className="type-subhead text-muted-foreground">
                      {trainers.length === 0
                        ? "Aún no hay entrenadores disponibles. Asigna primero el rol de entrenador a una cuenta."
                        : "Elige quién llevará el seguimiento y verá el progreso de este cliente."}
                    </div>
                  </div>
                </div>
                {trainers.length > 0 && (
                  <Select
                    value={assignedTrainerId || "__none__"}
                    onValueChange={assignTrainer}
                    disabled={trainerSaving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin entrenador asignado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin entrenador asignado</SelectItem>
                      {trainers.map((t) => (
                        <SelectItem key={t.user_id} value={t.user_id}>{t.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Tab: Progress */}
        <TabsContent value="progress">
          <UserProgressPanel userId={profile.user_id} travelModeUntil={profile.travel_mode_until} travelEquipment={profile.travel_equipment} />
        </TabsContent>

        {/* Tab: Training */}
        <TabsContent value="training" className="space-y-8">
          <TrainingPlanForm dayPlans={dayPlans} onChange={setDayPlans} userSports={onboarding?.sports} equipmentType={onboarding?.equipment_type || "Mixto"} specificGoal={onboarding?.specific_goal || undefined} intensityLevel={onboarding?.intensity_level ?? 5} userGoal={onboarding?.goal || undefined} userInjuries={onboarding?.injuries || undefined} userAge={onboarding?.age ?? undefined} userAvailability={onboarding?.availability as Record<string, boolean> | null} />
          <div className="space-y-4 sep-t pt-6">
            <h2 className="flex items-center gap-2 type-title3">
              <Calendar className="w-5 h-5 text-muted-foreground" /> Calendario
            </h2>
            <AdminCalendarTab profile={profile} dayPlans={dayPlans} />
          </div>
        </TabsContent>

        {/* Tab: Nutrition */}
        <TabsContent value="nutrition" className="space-y-6">
          <div className="min-w-0 space-y-6">
            <h2 className="type-title2">Plan de nutrición</h2>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="type-footnote text-muted-foreground">
                  {onboarding?.weight
                    ? `Calcular macros (${onboarding.weight} kg)`
                    : "Añade el peso actual del cliente para calcular macros"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(MACRO_TEMPLATES).map(([key, tpl]) => (
                  <Button key={key} variant="secondary" size="sm" className="min-h-11 rounded-full" onClick={() => { void hapticTap(); applyMacroTemplate(key); }} disabled={!onboarding?.weight || onboarding.weight <= 0}>
                    {tpl.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "protein" as const, label: "Proteína (g)" },
                { key: "carbs" as const, label: "Carbos (g)" },
                { key: "fats" as const, label: "Grasas (g)" },
              ].map((m) => (
                <div key={m.key} className="min-w-0">
                  <Label htmlFor={`client-${profile.user_id}-${m.key}`} className="type-footnote text-muted-foreground">{m.label}</Label>
                  <Input
                    id={`client-${profile.user_id}-${m.key}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={macros[m.key]}
                    onChange={(e) => setMacros((prev) => ({ ...prev, [m.key]: e.target.value }))}
                    className="mt-1.5 text-center font-rounded font-bold tabular-nums"
                  />
                </div>
              ))}
            </div>

            <div>
              <Label className="type-footnote text-muted-foreground">Comidas (una por línea, formato: Nombre: Descripción)</Label>
              <Textarea
                value={mealsText}
                onChange={(e) => setMealsText(e.target.value)}
                placeholder={"Desayuno: Avena con frutos rojos y batido de proteínas\nAlmuerzo: Pollo a la plancha con arroz y verduras\nCena: Salmón al horno con patata y ensalada"}
                rows={8}
                className="mt-2 font-mono"
              />
              <p className="type-footnote text-muted-foreground mt-2">
                Cada línea se convierte en una comida. El texto antes de «:» es el nombre.
              </p>
            </div>
          </div>
        </TabsContent>


        {/* Tab: Chat */}
        {canMessageClient && <TabsContent value="chat" className="min-w-0">
          {restricted && <p className="mb-3 type-subhead text-muted-foreground">Conversación con {profile.name?.trim() || "tu cliente"}.</p>}
          {!restricted && assignedTrainerId ? (
            <div className="space-y-3">
              <div role="tablist" aria-label="Con quién hablar" className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
                {(["client", "trainer"] as const).map((t) => {
                  const trainerLabel = trainers.find((tr) => tr.user_id === assignedTrainerId)?.email || "asignado";
                  const active = chatTarget === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => { void hapticSelection(); setChatTarget(t); }}
                      className={`min-h-11 min-w-0 truncate rounded-full px-3 py-2 type-footnote font-medium transition ease-ios-standard active:opacity-70 ${active ? "bg-background text-foreground" : "text-muted-foreground"}`}
                    >
                      {t === "client" ? "Alumno" : `Entrenador (${trainerLabel})`}
                    </button>
                  );
                })}
              </div>
              {chatTarget === "trainer" ? (
                <>
                  <p className="text-center type-caption2 text-muted-foreground">Canal directo con el entrenador asignado a este cliente</p>
                  <Chat key={`t-${assignedTrainerId}`} conversationUserId={assignedTrainerId} isAdmin audience="trainer" />
                </>
              ) : (
                <Chat key={`c-${profile.user_id}`} conversationUserId={profile.user_id} isAdmin audience="client" />
              )}
            </div>
          ) : (
            <Chat conversationUserId={profile.user_id} isAdmin audience="client" />
          )}
        </TabsContent>}
      </Tabs>
    </div>
  );
};

export default UserDetail;

// ─── Staff Detail (trainer / admin) ──────────────────────────────────────────
interface StaffDetailProps {
  profile: Profile;
  onBack: () => void;
  onDelete?: (userId: string) => void;
  kind: "trainer" | "admin";
  restricted: boolean;
  deleting: boolean;
  setDeleting: (v: boolean) => void;
}

function StaffDetail({ profile, onBack, onDelete, kind, restricted, deleting, setDeleting }: StaffDetailProps) {
  const [trainerProfile, setTrainerProfile] = useState<import("@/integrations/supabase/types").TablesInsert<"trainer_profiles"> | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [assigned, setAssigned] = useState<{ user_id: string; email: string; plan_status: string; payment_status: string }[]>([]);
  const [assignEmail, setAssignEmail] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removingTrainerRole, setRemovingTrainerRole] = useState(false);

  const reloadAssigned = async () => {
    const { data: assignments } = await supabase
      .from("trainer_assignments")
      .select("user_id")
      .eq("trainer_id", profile.user_id);
    const ids = (assignments || []).map((a) => a.user_id);
    if (ids.length === 0) { setAssigned([]); return; }
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, email, plan_status, payment_status")
      .in("user_id", ids);
    setAssigned(profs || []);
  };

  const handleAssign = async () => {
    const email = assignEmail.trim();
    if (!email) return;
    setAssigning(true);
    const { error } = await supabase.rpc("admin_assign_user_to_trainer", {
      _trainer_id: profile.user_id,
      _email: email,
    });
    setAssigning(false);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Usuario asignado");
    setAssignEmail("");
    await reloadAssigned();
  };

  const handleUnassign = async (userId: string) => {
    if (!confirm("¿Quitar este usuario del entrenador?")) return;
    const { error } = await supabase.rpc("admin_unassign_user_from_trainer", {
      _trainer_id: profile.user_id,
      _user_id: userId,
    });
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Asignación eliminada");
    await reloadAssigned();
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (kind === "trainer") {
        const results = await Promise.all([
          supabase.from("trainer_profiles").select("*").eq("user_id", profile.user_id).maybeSingle(),
          supabase.from("trainer_assignments").select("user_id").eq("trainer_id", profile.user_id),
        ]);
        const tp = results[0]?.data || {
          user_id: profile.user_id,
          display_name: "",
          headline: "",
          bio: "",
          photo_url: "",
          specialty: "",
          sort_order: 0,
          visible: true,
        };
        const assignments = results[1]?.data || [];
        setTrainerProfile(tp);
        const ids = assignments.map((a) => a.user_id);
        if (ids.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, email, plan_status, payment_status")
            .in("user_id", ids);
          setAssigned(profs || []);
        }
      }
      setLoading(false);
    })();
  }, [profile.user_id, kind]);

  const uploadTrainerPhoto = async (file: File) => {
    if (!trainerProfile) return;
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `trainers/${profile.user_id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Error subiendo foto: " + error.message);
      setUploadingPhoto(false);
      return;
    }
    const url = supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
    setTrainerProfile({ ...trainerProfile, photo_url: url });
    setUploadingPhoto(false);
    toast.success("Foto actualizada");
  };

  const saveTrainerProfile = async () => {
    if (!trainerProfile) return;
    setSavingProfile(true);
    const payload = { ...trainerProfile, user_id: profile.user_id };
    const { error } = await supabase.from("trainer_profiles").upsert(payload, { onConflict: "user_id" });
    setSavingProfile(false);
    if (error) { toast.error("Error al guardar: " + error.message); return; }
    toast.success("Perfil del entrenador guardado");
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { target_user_id: profile.user_id },
    });
    if (error || !data?.success) {
      toast.error("Error al eliminar: " + (error?.message || data?.error || "desconocido"));
      setDeleting(false);
      return;
    }
    toast.success(`${kind === "admin" ? "Administrador" : "Entrenador"} eliminado`);
    onDelete?.(profile.user_id);
    onBack();
  };

  const handleRemoveTrainerRole = async () => {
    if (assigned.length > 0) return;
    setRemovingTrainerRole(true);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", profile.user_id)
      .eq("role", "trainer");
    setRemovingTrainerRole(false);
    if (error) {
      toast.error("No se pudo quitar el rol de entrenador");
      return;
    }
    toast.success("Rol de entrenador eliminado");
    onBack();
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-11 w-11 shrink-0" aria-label="Volver a clientes">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="type-title3 md:text-xl truncate">{profile.email}</h1>
          <span className="mt-0.5 flex items-center gap-1 type-footnote text-primary">
            {kind === "admin" ? <Crown className="w-3.5 h-3.5" /> : <Dumbbell className="w-3.5 h-3.5" />}
            {kind === "admin" ? "Administrador" : "Entrenador"}
          </span>
        </div>
        {!restricted && kind === "trainer" && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => impersonateUser(profile.user_id, "/trainer")}
              title="Abrir el panel del entrenador como esta persona"
            >
              <Eye className="w-4 h-4 mr-1.5" /> Ver como
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="plain" size="sm" className="shrink-0 text-destructive" disabled={removingTrainerRole}>
                  Quitar rol
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Quitarle el rol de entrenador?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {assigned.length > 0
                      ? `Primero reasigna o retira sus ${assigned.length} cliente${assigned.length === 1 ? "" : "s"} desde la pestaña «Asignados».`
                      : `${profile.email} dejará de tener acceso al panel de entrenador. Su cuenta y sus datos no se eliminarán.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    destructive
                    onClick={handleRemoveTrainerRole}
                    disabled={assigned.length > 0 || removingTrainerRole}
                  >
                    {removingTrainerRole ? "Quitando…" : "Quitar rol de entrenador"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
        {!restricted && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="shrink-0" disabled={deleting} aria-label="Eliminar">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar {kind === "admin" ? "administrador" : "entrenador"}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borrarán permanentemente todos los datos de <strong>{profile.email}</strong>. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction destructive onClick={handleDelete}>
                  {deleting ? "Eliminando…" : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-primary" label="Cargando" />
        </div>
      ) : (
        <Tabs defaultValue={kind === "trainer" ? "info" : "chat"} className="space-y-6">
          <TabsList className={`grid w-full ${kind === "trainer" ? "grid-cols-3" : "grid-cols-1"}`}>
            {kind === "trainer" && (
              <>
                <TabsTrigger value="info" className="gap-1.5 shrink-0 whitespace-nowrap">
                  <User2 className="w-3.5 h-3.5" /> Info
                </TabsTrigger>
                <TabsTrigger value="assigned" className="gap-1.5 shrink-0 whitespace-nowrap">
                  <Dumbbell className="w-3.5 h-3.5" /> Asignados ({assigned.length})
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="chat" className="gap-1.5 shrink-0 whitespace-nowrap">
              <MessageCircle className="w-3.5 h-3.5" /> Chat
            </TabsTrigger>
          </TabsList>

          {kind === "trainer" && (
            <TabsContent value="info">
              {trainerProfile && (
                <div className="space-y-6">
                  {/* Foto */}
                  <div className="flex items-start gap-5">
                    {trainerProfile.photo_url ? (
                      <img loading="lazy" decoding="async"
                        src={trainerProfile.photo_url}
                        alt={trainerProfile.display_name || profile.email}
                        className="w-24 h-24 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-secondary flex items-center justify-center">
                        <User2 className="w-10 h-10 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingPhoto}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTrainerPhoto(f); }}
                        />
                        <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-secondary px-4 type-subhead active:opacity-70">
                          {uploadingPhoto ? <Spinner size="sm" /> : <User2 className="w-4 h-4" />}
                          {uploadingPhoto ? "Subiendo…" : "Subir foto"}
                        </span>
                      </label>
                      {trainerProfile.photo_url && (
                        <button
                          type="button"
                          onClick={() => setTrainerProfile({ ...trainerProfile, photo_url: "" })}
                          className="min-h-11 type-footnote text-destructive text-left active:opacity-70"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visible toggle */}
                  <div className="flex items-center justify-between sep-t pt-4">
                    <div>
                      <Label className="type-body">Visible en la landing</Label>
                      <p className="type-footnote text-muted-foreground">Aparecerá en la sección "Entrenadores"</p>
                    </div>
                    <Switch
                      checked={!!trainerProfile.visible}
                      onCheckedChange={(v) => setTrainerProfile({ ...trainerProfile, visible: v })}
                    />
                  </div>

                  {/* Campos */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre público</Label>
                      <Input
                        className="mt-1.5"
                        value={trainerProfile.display_name || ""}
                        onChange={(e) => setTrainerProfile({ ...trainerProfile, display_name: e.target.value })}
                        placeholder="Carlos Méndez"
                      />
                    </div>
                    <div>
                      <Label>Especialidad</Label>
                      <Input
                        className="mt-1.5"
                        value={trainerProfile.specialty || ""}
                        onChange={(e) => setTrainerProfile({ ...trainerProfile, specialty: e.target.value })}
                        placeholder="Hipertrofia · Calistenia"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Titular corto</Label>
                    <Input
                      className="mt-1.5"
                      value={trainerProfile.headline || ""}
                      onChange={(e) => setTrainerProfile({ ...trainerProfile, headline: e.target.value })}
                      placeholder="Entrenador certificado · 5 años"
                    />
                  </div>
                  <div>
                    <Label>Descripción / Bio</Label>
                    <Textarea
                      className="mt-1.5"
                      rows={4}
                      value={trainerProfile.bio || ""}
                      onChange={(e) => setTrainerProfile({ ...trainerProfile, bio: e.target.value })}
                      placeholder="Cuenta brevemente quién es y a quién ayuda…"
                    />
                  </div>
                  <div>
                    <Label>Orden</Label>
                    <Input
                      className="mt-1.5 max-w-[120px]"
                      type="number"
                      inputMode="numeric"
                      enterKeyHint="done"
                      value={trainerProfile.sort_order ?? 0}
                      onChange={(e) => setTrainerProfile({ ...trainerProfile, sort_order: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <Button variant="hero" onClick={saveTrainerProfile} disabled={savingProfile}>
                    <Save className="w-4 h-4 mr-1.5" /> {savingProfile ? "Guardando…" : "Guardar perfil"}
                  </Button>
                </div>
              )}
            </TabsContent>
          )}

          {kind === "trainer" && (
            <TabsContent value="assigned">
              {!restricted && (
                <div className="mb-4 flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    enterKeyHint="done"
                    placeholder="email@usuario.com"
                    value={assignEmail}
                    onChange={(e) => setAssignEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAssign(); }}
                    className="flex-1"
                  />
                  <Button onClick={handleAssign} disabled={assigning || !assignEmail.trim()}>
                    {assigning ? <Spinner size="sm" className="mr-1.5 text-primary-foreground" /> : null}
                    Asignar usuario
                  </Button>
                </div>
              )}
              {assigned.length === 0 ? (
                <EmptyState icon={User2} title="Sin usuarios asignados" />
              ) : (
                <ListGroup>
                  {assigned.map((u) => (
                    <ListRow
                      key={u.user_id}
                      title={<span className="truncate selectable">{u.email}</span>}
                      subtitle={`${u.plan_status === "plan_ready" ? "Plan listo" : u.plan_status === "plan_pending" ? "Pendiente" : "Perfil pendiente"} · ${u.payment_status === "paid" ? "Pagado" : "Sin pagar"}`}
                      trailing={!restricted ? (
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); void hapticTap(); handleUnassign(u.user_id); }} aria-label="Quitar asignación">
                          <Trash2 className="w-5 h-5 text-destructive" />
                        </Button>
                      ) : undefined}
                    />
                  ))}
                </ListGroup>
              )}
            </TabsContent>
          )}

          <TabsContent value="chat">
            <Chat conversationUserId={profile.user_id} isAdmin audience={kind === "trainer" ? "trainer" : "team"} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─── Admin Calendar Tab ──────────────────────────────────────────────────────
// Envuelve el CalendarView con un panel superior de "Conflictos detectados"
// y un botón para invocar la auto-reorganización (edge function).
interface AdminCalendarTabProps {
  profile: Profile;
  dayPlans: DayPlan[];
}

interface ConflictItem {
  dayLabel: string;
  trainingTitle: string;
  conflictType: "overlap" | "recovery";
  externalTitle: string;
  hint: string;
}

function AdminCalendarTab({ profile, dayPlans }: AdminCalendarTabProps) {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [running, setRunning] = useState(false);

  const runAutoReschedule = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("auto-reschedule", {
      body: { user_id: profile.user_id },
    });
    setRunning(false);
    if (error) { toast.error("No se pudo aplicar el ajuste"); return; }
    const moved = data?.conflictsResolved ?? 0;
    if (moved === 0) toast.info("No había conflictos resolubles");
    else toast.success(`Reorganizamos ${moved} entreno${moved > 1 ? "s" : ""}`);
  };

  return (
    <div className="space-y-4">
      {conflicts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-6 h-6 text-primary shrink-0" />
              <div>
                <p className="type-headline">{conflicts.length} conflicto{conflicts.length > 1 ? "s" : ""} detectado{conflicts.length > 1 ? "s" : ""} esta semana</p>
                <p className="type-subhead text-muted-foreground">El sistema puede reubicar los entrenos automáticamente respetando recuperación.</p>
              </div>
            </div>
            <Button size="sm" onClick={runAutoReschedule} disabled={running} variant="hero">
              {running ? <Spinner size="sm" className="mr-1.5 text-primary-foreground" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              {running ? "Aplicando…" : "Aplicar auto-ajuste"}
            </Button>
          </div>
          <ul className="space-y-1.5">
            {conflicts.slice(0, 5).map((c, i) => (
              <li key={i} className="type-footnote flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  <strong>{c.dayLabel}</strong> · {c.trainingTitle} —{" "}
                  <span className="text-muted-foreground">{c.hint}</span>
                </span>
              </li>
            ))}
            {conflicts.length > 5 && (
              <li className="type-footnote text-muted-foreground">…y {conflicts.length - 5} más</li>
            )}
          </ul>
        </div>
      )}

      <CalendarView
        dayPlans={dayPlans}
        targetUserId={profile.user_id}
        targetUserEmail={profile.email}
        isAdminMode
        onConflictsChange={setConflicts}
      />
    </div>
  );
}
