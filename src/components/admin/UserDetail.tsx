import { generatePlanGuarded } from "@/lib/planShield";
import { getSportSchedules, getCustomActivities } from "@/lib/availability";
import { jsonObject, jsonString } from "@/lib/runtimeValues";
import { useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import Chat from "@/components/Chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, User2, Dumbbell, Trash2, AlertTriangle, Eye, Target, MoreHorizontal, UserRound, UserMinus, Crown, Check, ChevronRight, Info, FlaskConical } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ListGroup, ListRow } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";
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

// Pestañas de la ficha: los chips se reparten todo el ancho (2 → mitades, 3 → tercios);
// si son tantos que no caben a su tamaño natural, la barra pasa a scroll horizontal.
const CHIP_BAR = "no-scrollbar -mx-4 flex h-auto w-auto snap-x scroll-px-4 justify-start gap-2 overflow-x-auto rounded-none bg-transparent px-4 py-0 md:mx-0 md:scroll-px-0 md:px-0";
const CHIP = "h-11 flex-1 basis-0 min-w-fit snap-start rounded-full bg-secondary px-4 type-subhead font-medium text-foreground transition-[background-color,color,transform] duration-150 active:scale-[0.97] data-[state=active]:bg-primary/15 data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none";

/** Nombre visible del cliente: nunca el email completo como título. */
const clientDisplayName = (profile: Pick<Profile, "name" | "email">) =>
  profile.name?.trim() || profile.email.split("@")[0] || profile.email;

const Notice = ({ children, status }: { children: ReactNode; status?: boolean }) => (
  <div className="flex items-start gap-3">
    <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    <p role={status ? "status" : undefined} className="min-w-0 type-subhead text-muted-foreground">{children}</p>
  </div>
);

/** Fila clave-valor de una lista agrupada (como Ajustes > Información). */
const FactRow = ({ label, value, stacked }: { label: ReactNode; value: ReactNode; stacked?: boolean }) => {
  const shown = value === null || value === undefined || value === "" || value === 0 ? "—" : value;
  return (
    <div className="group/fact pl-4">
      <div
        className={cn(
          "min-h-[44px] py-[11px] pr-4 group-[:not(:last-child)]/fact:sep-b",
          stacked ? "space-y-0.5" : "flex items-baseline justify-between gap-4",
        )}
      >
        <div className={stacked ? "type-footnote text-muted-foreground" : "shrink-0 type-body"}>{label}</div>
        <div className={cn("min-w-0 break-words type-body selectable", !stacked && "text-right text-muted-foreground")}>{shown}</div>
      </div>
    </div>
  );
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
  const [isTestAccount, setIsTestAccount] = useState(false);
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
      void supabase.from("metrics_excluded_users").select("user_id").eq("user_id", profile.user_id).maybeSingle()
        .then(({ data }) => { if (active) setIsTestAccount(!!data); });
      

      if (tp?.workouts_json) {
        const existing = tp.workouts_json as unknown as DayPlan[];
        if (Array.isArray(existing) && existing.length > 0) setDayPlans(existing);
      }

      if (np?.macros_json) {
        const m = jsonObject(np.macros_json);
        const cargados = { protein: m.protein?.toString() || "", carbs: m.carbs?.toString() || "", fats: m.fats?.toString() || "" };
        setMacros(cargados);
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

  const toggleTestAccount = async () => {
    setRoleLoading(true);
    const { error } = isTestAccount
      ? await supabase.from("metrics_excluded_users").delete().eq("user_id", profile.user_id)
      : await supabase.from("metrics_excluded_users").insert({ user_id: profile.user_id });
    if (error) toast.error("No se pudo cambiar");
    else {
      setIsTestAccount(!isTestAccount);
      toast.success(isTestAccount ? "Vuelve a contar en métricas" : "Cuenta de prueba: fuera de métricas");
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
    const { data, error } = await generatePlanGuarded(supabase, { user_id: profile.user_id });
    if (data?.protected) { setGenerating(false); toast.info("Se ha conservado la rutina personalizada del cliente."); return; }
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
  const hasCoachTier = ["full", "transform", "personal", "coach"].includes(currentTier || "");
  const displayName = clientDisplayName(profile);
  const assignedTrainerEmail = trainers.find((tr) => tr.user_id === assignedTrainerId)?.email;

  return (
    <div className="min-w-0 space-y-6">
      {/* Móvil: identidad y «…» en la primera línea, Auto-generar + Guardar debajo. Escritorio: todo en una fila. */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-4">
        <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="hidden shrink-0 md:inline-flex" aria-label="Volver a clientes">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-16 w-16 shrink-0 md:h-11 md:w-11">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.name?.trim() || "Foto del cliente"} />
            <AvatarFallback className="bg-secondary type-title2 text-muted-foreground md:type-headline">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 data-nav-title className="break-words type-large-title md:type-title3">{displayName}</h1>
            <p className="break-all type-subhead text-muted-foreground selectable">{profile.email}</p>
          </div>
        </div>
        {!restricted && (
          <div className="shrink-0 md:order-last">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Más acciones" onPointerDown={() => void hapticTap()}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => impersonateUser(profile.user_id, "/dashboard")}>
                  <Eye className="h-4 w-4 text-muted-foreground" /> Ver como
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> Eliminar usuario
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
          </div>
        )}
        {hasAccess && (
          <div className="flex w-full items-center gap-2 md:w-auto md:shrink-0">
            <Button variant="plain" onClick={() => { void hapticTap(); void autoGeneratePlan(); }} disabled={generating} className="shrink-0 px-3">
              {generating ? <><Spinner size="sm" className="text-primary" label="Generando" /> Generando…</> : "Auto-generar"}
            </Button>
            <Button onClick={() => { void hapticTap(); void savePlans(); }} disabled={saving} className="min-w-0 flex-1 md:min-w-28 md:flex-none">
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
      </header>

      <Tabs key={profile.user_id} defaultValue={restricted ? "summary" : "info"} className="min-w-0 space-y-6">
        <TabsList className={CHIP_BAR} aria-label="Ficha del cliente">
          {restricted && <TabsTrigger value="summary" className={CHIP} onPointerDown={() => void hapticSelection()}>Plan</TabsTrigger>}
          {!restricted && <TabsTrigger value="info" className={CHIP} onPointerDown={() => void hapticSelection()}>Plan</TabsTrigger>}
          <TabsTrigger value="perfil" className={CHIP} onPointerDown={() => void hapticSelection()}>Perfil</TabsTrigger>
          {!restricted && <TabsTrigger value="acceso" className={CHIP} onPointerDown={() => void hapticSelection()}>Acceso</TabsTrigger>}
          <TabsTrigger value="progress" className={CHIP} onPointerDown={() => void hapticSelection()}>Progreso</TabsTrigger>
          <TabsTrigger value="training" className={CHIP} onPointerDown={() => void hapticSelection()}>Entreno</TabsTrigger>
          {profile.payment_status === "paid" && (
            <>
              <TabsTrigger hidden value="progress-dup" className={CHIP} onPointerDown={() => void hapticSelection()}>Progreso</TabsTrigger>
              <TabsTrigger value="training" className={CHIP} onPointerDown={() => void hapticSelection()}>Entreno</TabsTrigger>
              {canViewNutrition && <TabsTrigger value="nutrition" className={CHIP} onPointerDown={() => void hapticSelection()}>Nutrición</TabsTrigger>}
              {canMessageClient && <TabsTrigger value="chat" className={CHIP} onPointerDown={() => void hapticSelection()}>Chat</TabsTrigger>}
            </>
          )}
        </TabsList>

        {restricted && (
          <TabsContent value="summary" className="space-y-6">
            <section className="space-y-3">
              <div>
                <h2 className="type-title2">Resumen del plan</h2>
                <p className="mt-1 type-subhead text-muted-foreground">{dayPlans.length ? `${dayPlans.length} sesiones guardadas para este cliente.` : "Este cliente aún no tiene sesiones guardadas."}</p>
              </div>
              {dayPlans.length > 0 && (
                <ListGroup>
                  {dayPlans.map((plan, index) => (
                    <ListRow
                      key={`${plan.day}-${index}`}
                      title={plan.day}
                      subtitle={`${plan.type === "gimnasio" ? (plan.routine_name || "Entrenamiento") : (plan.sport || "Actividad")} · ${plan.type === "gimnasio" ? `${plan.exercises?.length || 0} ejercicios` : (plan.duration || "Duración pendiente")}`}
                    />
                  ))}
                </ListGroup>
              )}
            </section>
            {!onboarding && <Notice>Falta completar el perfil del cliente. Pide al administrador que revise sus datos.</Notice>}
            {!("subscription_tier" in profile) && <Notice status>La información de acceso del cliente está pendiente de actualizar. El chat con el cliente aparecerá cuando se confirme su acceso Coach.</Notice>}
            {"subscription_tier" in profile && !canMessageClient && <Notice>Este cliente no tiene acceso activo al chat de seguimiento Coach.</Notice>}
          </TabsContent>
        )}

        {/* Tab: Plan (admin) */}
        <TabsContent value="info" className="space-y-10">
          {!restricted && (
            <section className="space-y-3">
              <p className="type-subhead text-muted-foreground">Toca un plan para aplicarlo al instante. No genera ningún cobro.</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Plan del cliente">
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
                      className={cn(
                        "flex min-h-[88px] flex-col items-center justify-center rounded-2xl px-2 py-3 text-center transition-[background-color,opacity,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default",
                        active ? "bg-primary/15 text-primary" : "bg-card active:scale-[0.97] active:bg-accent disabled:opacity-40",
                      )}
                    >
                      <span className="type-headline">{opt.name}</span>
                      <span className={cn("mt-0.5 type-footnote tabular-nums", active ? "text-primary" : "text-muted-foreground")}>{opt.price} €/mes</span>
                      {active && (
                        <span className="mt-1.5 inline-flex items-center gap-1 type-caption1 font-semibold">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> Actual
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {tierSaving && <Spinner size="sm" className="mx-auto block text-primary" label="Guardando" />}
            </section>
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

        {/* Tab: Perfil (datos del cuestionario y físico objetivo) */}
        <TabsContent value="perfil" className="space-y-8">
          {editingOnboarding && !restricted ? (
            <OnboardingEditor
              userId={profile.user_id}
              data={onboarding}
              onSaved={(next) => { setOnboarding(next as OnboardingData); setEditingOnboarding(false); }}
              onCancel={() => setEditingOnboarding(false)}
            />
          ) : onboarding ? (
            (() => {
              const av = jsonObject(onboarding.availability);
              const sportSchedules = getSportSchedules(onboarding.availability);
              const customActivities = getCustomActivities(onboarding.availability);
              const dowNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
              const formatSchedule = (s: { dow: number; start: string; end: string }) =>
                `${dowNames[s.dow] ?? "?"} ${s.start}–${s.end}`;
              const days = av?.days ? `${av.days} días/sem` : null;
              const hours = av?.hours ? `${av.hours}h por sesión` : null;
              const summary = [days, hours].filter(Boolean).join(" · ") || null;
              const groups: { header: string; facts: { label: string; value: ReactNode; stacked?: boolean }[] }[] = [
                {
                  header: "Cuerpo",
                  facts: [
                    { label: "Edad", value: onboarding.age },
                    { label: "Sexo", value: onboarding.sex === "male" ? "Hombre" : onboarding.sex === "female" ? "Mujer" : null },
                    { label: "Altura", value: onboarding.height ? `${onboarding.height} cm` : null },
                    { label: "Peso", value: onboarding.weight ? `${onboarding.weight} kg` : null },
                  ],
                },
                {
                  header: "Objetivo",
                  facts: [
                    { label: "Objetivo", value: onboarding.goal ? (goalLabel[onboarding.goal] || onboarding.goal) : null },
                    { label: "Meta específica", value: onboarding.specific_goal ? onboarding.specific_goal : null },
                    { label: "Intensidad", value: onboarding.intensity_level ? `${onboarding.intensity_level}/10` : null },
                  ],
                },
                {
                  header: "Entrenamiento",
                  facts: [
                    { label: "Equipamiento", value: onboarding.equipment_type ? onboarding.equipment_type : null },
                    { label: "Deportes", value: onboarding.sports },
                    { label: "Disponibilidad", value: summary },
                    { label: "Días elegidos", value: Array.isArray(av?.training_days) ? av.training_days.map((d: number) => dowNames[d]).join(", ") : null },
                    { label: "Estructura", value: ({ full_body: "Full Body", torso_pierna: "Torso / Pierna", ppl: "Empuje / Tirón / Pierna", coach: "Elige el entrenador" } as Record<string, string>)[jsonString(av.structure)] || null },
                    { label: "Modalidad", value: av?.training_mode === "pareja" ? `En pareja · ${av.partner_email || ""}` : av?.training_mode ? "Individual" : null },
                  ],
                },
                {
                  header: "Seguimiento",
                  facts: [
                    { label: "Revisión preferida", value: av?.checkin_time ? `${dowNames[typeof av.checkin_dow === "number" ? av.checkin_dow : -1] ?? "?"} ${av.checkin_time}` : null },
                    { label: "Estilo de coach", value: ({ direct: "Directo y exigente", flexible: "Flexible y realista", technical: "Técnico y analítico" } as Record<string, string>)[jsonString(av.coach_style)] || null },
                  ],
                },
                {
                  header: "Nutrición",
                  facts: [
                    { label: "Cocina", value: ({ quick: "Rápido / sin tiempo", normal: "Algo de cocina", loves: "Le gusta cocinar" } as Record<string, string>)[jsonString(av.cooking)] || null },
                    { label: "Preferencias nutricionales", value: onboarding.nutrition_preferences, stacked: true },
                    { label: "Alergias", value: onboarding.allergies, stacked: true },
                  ],
                },
              ];
              return (
                <div className="min-w-0 space-y-8">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 type-subhead text-muted-foreground">Datos del cuestionario del cliente.</p>
                    {!restricted && (
                      <Button variant="plain" size="sm" className="-mr-3 shrink-0" onClick={() => { void hapticTap(); setEditingOnboarding(true); }}>Editar</Button>
                    )}
                  </div>
                  {onboarding.injuries && (
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-destructive" strokeWidth={1.75} />
                      <div className="min-w-0">
                        <div className="type-headline text-destructive">Lesiones y condiciones</div>
                        <div className="mt-0.5 break-words type-subhead text-muted-foreground selectable">{onboarding.injuries}</div>
                      </div>
                    </div>
                  )}
                  <div className="grid gap-6 md:grid-cols-2 md:items-start">
                    {groups.map((group) => (
                      <ListGroup key={group.header} header={group.header}>
                        {group.facts.map((fact) => <FactRow key={fact.label} label={fact.label} value={fact.value} stacked={fact.stacked} />)}
                      </ListGroup>
                    ))}
                    {Object.keys(sportSchedules).length > 0 && (
                      <ListGroup header="Horarios de deportes">
                        {Object.entries(sportSchedules).map(([sport, sched]) => (
                          <FactRow key={sport} label={<span className="capitalize">{sport}</span>} value={<span className="tabular-nums">{formatSchedule(sched)}</span>} />
                        ))}
                      </ListGroup>
                    )}
                    {customActivities.length > 0 && (
                      <ListGroup header="Actividades personalizadas">
                        {customActivities.map((act, i) => (
                          <FactRow key={i} label={act.title} value={<span className="tabular-nums">{formatSchedule(act)}</span>} />
                        ))}
                      </ListGroup>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <EmptyState
              icon={UserRound}
              title="Aún no hay datos de perfil"
              action={!restricted ? <Button variant="plain" onClick={() => { void hapticTap(); setEditingOnboarding(true); }}>Añadir datos</Button> : undefined}
            />
          )}
          {profile.payment_status === "paid" && (
            <details onToggle={(event) => setShowGoalDetails(event.currentTarget.open)}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-2xl bg-card px-4 transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <Target className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 py-[11px] type-body">Físico objetivo</span>
                <ChevronRight
                  className={cn("h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ease-ios", showGoalDetails && "rotate-90")}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </summary>
              {showGoalDetails && (
                <div className="pt-6">
                  <UserGoalPanel userId={profile.user_id} email={profile.email} />
                </div>
              )}
            </details>
          )}
        </TabsContent>

        {/* Tab: Acceso (roles y entrenador responsable) */}
        {!restricted && (
          <TabsContent value="acceso" className="space-y-8">
            <p className="type-subhead text-muted-foreground">Controla los permisos de esta cuenta{hasCoachTier ? " y quién acompaña al cliente" : ""}.</p>

            <ListGroup header="Roles">
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
              <ListRow
                icon={<FlaskConical className="text-muted-foreground" />}
                title="Cuenta de prueba"
                subtitle="No cuenta en métricas ni estadísticas."
                trailing={<Switch checked={isTestAccount} onCheckedChange={toggleTestAccount} disabled={roleLoading} aria-label="Marcar como cuenta de prueba" />}
              />
            </ListGroup>

            {hasCoachTier && (
              <section>
                <h2 className="type-group-header px-4 pb-1.5">Entrenador responsable</h2>
                {trainers.length > 0 && (
                  <Select
                    value={assignedTrainerId || "__none__"}
                    onValueChange={assignTrainer}
                    disabled={trainerSaving}
                  >
                    <SelectTrigger aria-label="Entrenador responsable" className="rounded-2xl bg-card px-4">
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
                <p className="px-4 pt-1.5 type-footnote text-muted-foreground">
                  {trainers.length === 0
                    ? "Aún no hay entrenadores disponibles. Asigna primero el rol de entrenador a una cuenta."
                    : "Elige quién llevará el seguimiento y verá el progreso de este cliente."}
                </p>
              </section>
            )}
          </TabsContent>
        )}

        {/* Tab: Progress */}
        <TabsContent value="progress">
          <UserProgressPanel userId={profile.user_id} travelModeUntil={profile.travel_mode_until} travelEquipment={profile.travel_equipment} />
        </TabsContent>

        {/* Tab: Training */}
        <TabsContent value="training" className="space-y-10">
          <TrainingPlanForm dayPlans={dayPlans} onChange={setDayPlans} userSports={onboarding?.sports} equipmentType={onboarding?.equipment_type || "Mixto"} specificGoal={onboarding?.specific_goal || undefined} intensityLevel={onboarding?.intensity_level ?? 5} userGoal={onboarding?.goal || undefined} userInjuries={onboarding?.injuries || undefined} userAge={onboarding?.age ?? undefined} userAvailability={onboarding?.availability as Record<string, boolean> | null} />
          <section className="space-y-4">
            <SectionHeader size="lg" title="Calendario" />
            <AdminCalendarTab profile={profile} dayPlans={dayPlans} />
          </section>
        </TabsContent>

        {/* Tab: Nutrition */}
        <TabsContent value="nutrition" className="space-y-8">
          <section>
            <h2 className="type-group-header px-4 pb-1.5">Calcular macros</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MACRO_TEMPLATES).map(([key, tpl]) => (
                <Button key={key} variant="secondary" size="sm" className="h-11" onClick={() => { void hapticTap(); applyMacroTemplate(key); }} disabled={!onboarding?.weight || onboarding.weight <= 0}>
                  {tpl.label}
                </Button>
              ))}
            </div>
            <p className="px-4 pt-1.5 type-footnote text-muted-foreground tabular-nums">
              {onboarding?.weight
                ? `Según su peso actual (${onboarding.weight} kg).`
                : "Añade el peso actual del cliente para calcular macros."}
            </p>
          </section>

          <section>
            <h2 className="type-group-header px-4 pb-1.5">Macros diarios</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "protein" as const, label: "Proteína (g)" },
                { key: "carbs" as const, label: "Carbos (g)" },
                { key: "fats" as const, label: "Grasas (g)" },
              ].map((m) => (
                <div key={m.key} className="min-w-0">
                  <Input
                    id={`client-${profile.user_id}-${m.key}`}
                    type="number"
                    inputMode="decimal"
                    enterKeyHint={m.key === "fats" ? "done" : "next"}
                    min={0}
                    step="any"
                    value={macros[m.key]}
                    onChange={(e) => setMacros((prev) => ({ ...prev, [m.key]: e.target.value }))}
                    className="h-14 rounded-2xl text-center font-rounded text-[22px] font-bold tabular-nums md:h-11 md:rounded-xl md:text-lg"
                  />
                  <Label htmlFor={`client-${profile.user_id}-${m.key}`} className="mt-1.5 block text-center type-footnote font-normal text-muted-foreground">{m.label}</Label>
                </div>
              ))}
            </div>
          </section>

          <section>
            <Label htmlFor={`client-${profile.user_id}-meals`} className="mb-1.5 block px-4 type-group-header font-normal">Comidas</Label>
            <Textarea
              id={`client-${profile.user_id}-meals`}
              value={mealsText}
              onChange={(e) => setMealsText(e.target.value)}
              placeholder={"Desayuno: Avena con frutos rojos y batido de proteínas\nAlmuerzo: Pollo a la plancha con arroz y verduras\nCena: Salmón al horno con patata y ensalada"}
              rows={8}
              className="rounded-2xl"
            />
            <p className="px-4 pt-1.5 type-footnote text-muted-foreground">
              Una comida por línea, con el formato «Nombre: Descripción». El texto antes de «:» es el nombre.
            </p>
          </section>
        </TabsContent>

        {/* Tab: Chat */}
        {canMessageClient && (
          <TabsContent value="chat" className="min-w-0">
            {restricted && <p className="mb-3 type-subhead text-muted-foreground">Conversación con {profile.name?.trim() || "tu cliente"}.</p>}
            {!restricted && assignedTrainerId ? (
              <Tabs value={chatTarget} onValueChange={(value) => { void hapticSelection(); setChatTarget(value as "client" | "trainer"); }} className="space-y-3">
                <TabsList aria-label="Con quién hablar" className="grid w-full grid-cols-2">
                  <TabsTrigger value="client" className="min-w-0">Cliente</TabsTrigger>
                  <TabsTrigger value="trainer" className="min-w-0">Entrenador</TabsTrigger>
                </TabsList>
                <TabsContent value="client" className="mt-0">
                  <Chat key={`c-${profile.user_id}`} conversationUserId={profile.user_id} isAdmin audience="client" />
                </TabsContent>
                <TabsContent value="trainer" className="mt-0 space-y-3">
                  <p className="break-words type-footnote text-muted-foreground">
                    Canal directo con el entrenador asignado a este cliente
                    {assignedTrainerEmail ? <>: <span className="text-foreground selectable">{assignedTrainerEmail}</span></> : null}.
                  </p>
                  <Chat key={`t-${assignedTrainerId}`} conversationUserId={assignedTrainerId} isAdmin audience="trainer" />
                </TabsContent>
              </Tabs>
            ) : (
              <Chat conversationUserId={profile.user_id} isAdmin audience="client" />
            )}
          </TabsContent>
        )}
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
  // Hojas de confirmación abiertas desde el menú «…» y desde las filas de asignados.
  const [removeRoleOpen, setRemoveRoleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<{ user_id: string; email: string } | null>(null);

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

  // La confirmación la pide la alerta de «Quitar asignación» antes de llamar aquí.
  const handleUnassign = async (userId: string) => {
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

  const displayName = clientDisplayName(profile);
  const roleLabel = kind === "admin" ? "Administrador" : "Entrenador";

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="hidden shrink-0 md:inline-flex" aria-label="Volver a clientes">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary md:h-11 md:w-11" aria-hidden="true">
            {kind === "admin"
              ? <Crown className="h-7 w-7 text-primary md:h-5 md:w-5" strokeWidth={1.75} />
              : <Dumbbell className="h-7 w-7 text-primary md:h-5 md:w-5" strokeWidth={1.75} />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 data-nav-title className="break-words type-large-title md:type-title3">{displayName}</h1>
            <p className="break-all type-subhead text-muted-foreground selectable">{roleLabel} · {profile.email}</p>
          </div>
        </div>
        {!restricted && (
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Más acciones" onPointerDown={() => void hapticTap()}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {kind === "trainer" && (
                  <>
                    <DropdownMenuItem onSelect={() => impersonateUser(profile.user_id, "/trainer")}>
                      <Eye className="h-4 w-4 text-muted-foreground" /> Ver como
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={removingTrainerRole}
                      onSelect={() => setRemoveRoleOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <UserMinus className="h-4 w-4" /> Quitar rol de entrenador
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem disabled={deleting} onSelect={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> Eliminar {kind === "admin" ? "administrador" : "entrenador"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {kind === "trainer" && (
              <AlertDialog open={removeRoleOpen} onOpenChange={setRemoveRoleOpen}>
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
            )}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
          </div>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-primary" label="Cargando" />
        </div>
      ) : (
        <Tabs defaultValue={kind === "trainer" ? "info" : "chat"} className="space-y-6">
          {kind === "trainer" && (
            <TabsList className="w-full">
              <TabsTrigger value="info" onPointerDown={() => void hapticSelection()}>Perfil</TabsTrigger>
              <TabsTrigger value="assigned" className="tabular-nums" onPointerDown={() => void hapticSelection()}>Asignados ({assigned.length})</TabsTrigger>
              <TabsTrigger value="chat" onPointerDown={() => void hapticSelection()}>Chat</TabsTrigger>
            </TabsList>
          )}

          {kind === "trainer" && (
            <TabsContent value="info" className="mt-0">
              {trainerProfile && (
                <div className="space-y-8">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <TrainerPhoto url={trainerProfile.photo_url || ""} alt={trainerProfile.display_name || profile.email} />
                    <div className="flex items-center gap-5">
                      <label className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 type-body text-primary transition-opacity active:opacity-60", uploadingPhoto && "pointer-events-none opacity-60")}>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingPhoto}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTrainerPhoto(f); }}
                        />
                        {uploadingPhoto && <Spinner size="sm" className="text-primary" label="Subiendo" />}
                        {uploadingPhoto ? "Subiendo…" : trainerProfile.photo_url ? "Cambiar foto" : "Subir foto"}
                      </label>
                      {trainerProfile.photo_url && (
                        <button
                          type="button"
                          onClick={() => { void hapticTap(); setTrainerProfile({ ...trainerProfile, photo_url: "" }); }}
                          className="min-h-11 type-body text-destructive transition-opacity active:opacity-60"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>
                  </div>

                  <ListGroup footer="Aparecerá en la sección «Entrenadores» de la web.">
                    <ListRow
                      title="Visible en la landing"
                      trailing={
                        <Switch
                          checked={!!trainerProfile.visible}
                          onCheckedChange={(v) => { void hapticSelection(); setTrainerProfile({ ...trainerProfile, visible: v }); }}
                          aria-label="Visible en la landing"
                        />
                      }
                    />
                  </ListGroup>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`trainer-${profile.user_id}-name`} className="mb-1.5 block font-normal text-muted-foreground">Nombre público</Label>
                        <Input
                          id={`trainer-${profile.user_id}-name`}
                          autoCapitalize="words"
                          autoComplete="off"
                          enterKeyHint="next"
                          value={trainerProfile.display_name || ""}
                          onChange={(e) => setTrainerProfile({ ...trainerProfile, display_name: e.target.value })}
                          placeholder="Carlos Méndez"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`trainer-${profile.user_id}-specialty`} className="mb-1.5 block font-normal text-muted-foreground">Especialidad</Label>
                        <Input
                          id={`trainer-${profile.user_id}-specialty`}
                          enterKeyHint="next"
                          value={trainerProfile.specialty || ""}
                          onChange={(e) => setTrainerProfile({ ...trainerProfile, specialty: e.target.value })}
                          placeholder="Hipertrofia · Calistenia"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`trainer-${profile.user_id}-headline`} className="mb-1.5 block font-normal text-muted-foreground">Titular corto</Label>
                      <Input
                        id={`trainer-${profile.user_id}-headline`}
                        enterKeyHint="next"
                        value={trainerProfile.headline || ""}
                        onChange={(e) => setTrainerProfile({ ...trainerProfile, headline: e.target.value })}
                        placeholder="Entrenador certificado · 5 años"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`trainer-${profile.user_id}-bio`} className="mb-1.5 block font-normal text-muted-foreground">Descripción</Label>
                      <Textarea
                        id={`trainer-${profile.user_id}-bio`}
                        rows={4}
                        value={trainerProfile.bio || ""}
                        onChange={(e) => setTrainerProfile({ ...trainerProfile, bio: e.target.value })}
                        placeholder="Cuenta brevemente quién es y a quién ayuda…"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`trainer-${profile.user_id}-order`} className="mb-1.5 block font-normal text-muted-foreground">Orden</Label>
                      <Input
                        id={`trainer-${profile.user_id}-order`}
                        className="max-w-[120px] tabular-nums"
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="done"
                        value={trainerProfile.sort_order ?? 0}
                        onChange={(e) => setTrainerProfile({ ...trainerProfile, sort_order: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <Button size="lg" className="w-full md:w-auto" onClick={() => { void hapticTap(); void saveTrainerProfile(); }} disabled={savingProfile}>
                    {savingProfile ? "Guardando…" : "Guardar perfil"}
                  </Button>
                </div>
              )}
            </TabsContent>
          )}

          {kind === "trainer" && (
            <TabsContent value="assigned" className="mt-0 space-y-6">
              {!restricted && (
                <section>
                  <Label htmlFor={`trainer-${profile.user_id}-assign`} className="mb-1.5 block px-4 type-group-header font-normal">Asignar usuario</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`trainer-${profile.user_id}-assign`}
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
                      className="min-w-0 flex-1"
                    />
                    <Button className="shrink-0" onClick={() => { void hapticTap(); void handleAssign(); }} disabled={assigning || !assignEmail.trim()}>
                      {assigning ? <Spinner size="sm" className="text-primary-foreground" label="Asignando" /> : null}
                      Asignar
                    </Button>
                  </div>
                </section>
              )}
              {assigned.length === 0 ? (
                <EmptyState icon={User2} title="Sin usuarios asignados" description="Los clientes que asignes a este entrenador aparecerán aquí." />
              ) : (
                <ListGroup>
                  {assigned.map((u) => (
                    <ListRow
                      key={u.user_id}
                      title={<span className="truncate selectable">{u.email}</span>}
                      subtitle={`${u.plan_status === "plan_ready" ? "Plan listo" : u.plan_status === "plan_pending" ? "Pendiente" : "Perfil pendiente"} · ${u.payment_status === "paid" ? "Pagado" : "Sin pagar"}`}
                      trailing={!restricted ? (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => { e.stopPropagation(); void hapticTap(); setUnassignTarget({ user_id: u.user_id, email: u.email }); setUnassignOpen(true); }} aria-label="Quitar asignación">
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      ) : undefined}
                    />
                  ))}
                </ListGroup>
              )}
              <AlertDialog open={unassignOpen} onOpenChange={setUnassignOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Quitar este usuario del entrenador?</AlertDialogTitle>
                    <AlertDialogDescription>
                      <span className="break-all">{unassignTarget?.email}</span> dejará de estar asignado a este entrenador.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction destructive onClick={() => { if (unassignTarget) void handleUnassign(unassignTarget.user_id); }}>
                      Quitar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>
          )}

          <TabsContent value="chat" className="mt-0">
            <Chat conversationUserId={profile.user_id} isAdmin audience={kind === "trainer" ? "trainer" : "team"} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/** Foto pública del entrenador con hueco compuesto si falta o no carga. */
function TrainerPhoto({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  if (!url || failed) {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary" aria-hidden="true">
        <User2 className="h-10 w-10 text-muted-foreground" strokeWidth={1.75} />
      </div>
    );
  }
  return (
    <img
      loading="lazy"
      decoding="async"
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-24 w-24 rounded-full bg-secondary object-cover"
    />
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
    <div className="space-y-6">
      {conflicts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="type-headline">{conflicts.length} conflicto{conflicts.length > 1 ? "s" : ""} detectado{conflicts.length > 1 ? "s" : ""} esta semana</p>
              <p className="mt-0.5 type-subhead text-muted-foreground">El sistema puede reubicar los entrenos automáticamente respetando recuperación.</p>
              <Button variant="plain" size="sm" className="-ml-3.5 mt-1" onClick={() => { void hapticTap(); void runAutoReschedule(); }} disabled={running}>
                {running ? <><Spinner size="sm" className="text-primary" label="Aplicando" /> Aplicando…</> : "Aplicar auto-ajuste"}
              </Button>
            </div>
          </div>
          <ListGroup footer={conflicts.length > 5 ? `Y ${conflicts.length - 5} más.` : undefined}>
            {conflicts.slice(0, 5).map((c, i) => (
              <ListRow key={i} title={`${c.dayLabel} · ${c.trainingTitle}`} subtitle={c.hint} />
            ))}
          </ListGroup>
        </section>
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
