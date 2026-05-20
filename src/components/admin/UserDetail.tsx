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
import { ArrowLeft, Save, ShieldCheck, User2, Dumbbell, Apple, MessageCircle, Loader2, Zap, Wand2, CreditCard, Trash2, TrendingUp, Calendar, AlertTriangle, Sparkles, Target } from "lucide-react";
import UserProgressPanel from "./UserProgressPanel";
import UserGoalPanel from "./UserGoalPanel";
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
    label: "💪 Ganar músculo",
    calc: (w) => ({ protein: Math.round(w * 2.2), carbs: Math.round(w * 4), fats: Math.round(w * 1) }),
  },
  lose_weight: {
    label: "🔥 Perder grasa",
    calc: (w) => ({ protein: Math.round(w * 2.4), carbs: Math.round(w * 2), fats: Math.round(w * 0.8) }),
  },
  recomp: {
    label: "⚡ Recomposición",
    calc: (w) => ({ protein: Math.round(w * 2.2), carbs: Math.round(w * 3), fats: Math.round(w * 0.9) }),
  },
  maintenance: {
    label: "⚖️ Mantenimiento",
    calc: (w) => ({ protein: Math.round(w * 1.8), carbs: Math.round(w * 3.5), fats: Math.round(w * 1) }),
  },
};

interface Props {
  profile: Profile;
  onBack: () => void;
  onUpdate: (userId: string, updates: Partial<Profile>) => void;
  onDelete?: (userId: string) => void;
  restricted?: boolean;
}

const UserDetail = ({ profile, onBack, onUpdate, onDelete, restricted = false }: Props) => {
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [macros, setMacros] = useState({ protein: "", carbs: "", fats: "" });
  const [mealsText, setMealsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);



  useEffect(() => {
    const fetchData = async () => {
      const [{ data: onb }, { data: roleData }, { data: tp }, { data: np }] = await Promise.all([
        supabase.from("onboarding").select("*").eq("user_id", profile.user_id).single(),
        supabase.from("user_roles").select("role").eq("user_id", profile.user_id).eq("role", "admin").maybeSingle(),
        supabase.from("training_plan").select("workouts_json").eq("user_id", profile.user_id).single(),
      supabase.from("nutrition_plan").select("macros_json, meals_json").eq("user_id", profile.user_id).single(),
      ]);
      setOnboarding(onb as OnboardingData | null);
      setIsUserAdmin(!!roleData);
      

      if (tp?.workouts_json) {
        const existing = tp.workouts_json as unknown as DayPlan[];
        if (Array.isArray(existing) && existing.length > 0) setDayPlans(existing);
      }

      if (np?.macros_json) {
        const m = np.macros_json as any;
        setMacros({ protein: m.protein?.toString() || "", carbs: m.carbs?.toString() || "", fats: m.fats?.toString() || "" });
      }
      if (np?.meals_json) {
        const meals = np.meals_json as any[];
        if (Array.isArray(meals)) {
          setMealsText(meals.map((m: any) => `${m.name}: ${m.description}`).join("\n"));
        }
      }
      setDataLoading(false);
    };
    fetchData();
  }, [profile.user_id]);

  const toggleAdminRole = async () => {
    setRoleLoading(true);
    if (isUserAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", profile.user_id).eq("role", "admin");
      if (!error) { setIsUserAdmin(false); toast.success("Rol de admin eliminado"); }
      else toast.error("Error al cambiar rol");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: profile.user_id, role: "admin" as any });
      if (!error) { setIsUserAdmin(true); toast.success("Rol de admin asignado"); }
      else toast.error("Error al cambiar rol");
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
    const weight = onboarding?.weight || 70;
    const result = tpl.calc(weight);
    setMacros({
      protein: result.protein.toString(),
      carbs: result.carbs.toString(),
      fats: result.fats.toString(),
    });
    toast.success(`Macros calculados para ${weight}kg (${tpl.label})`);
  };

  const savePlans = async () => {
    setSaving(true);
    const meals = mealsText.split("\n").filter(Boolean).map((line) => {
      const [name, ...rest] = line.split(":");
      return { name: name?.trim() || "", description: rest.join(":").trim() || "" };
    });

    const { error: tpError } = await supabase.from("training_plan").upsert({
      user_id: profile.user_id,
      workouts_json: dayPlans as unknown as Json,
    }, { onConflict: "user_id" });

    const { error: npError } = await supabase.from("nutrition_plan").upsert({
      user_id: profile.user_id,
      macros_json: { protein: parseInt(macros.protein) || 0, carbs: parseInt(macros.carbs) || 0, fats: parseInt(macros.fats) || 0 } as unknown as Json,
      meals_json: meals as unknown as Json,
    }, { onConflict: "user_id" });

    if (!tpError && !npError) {
      await supabase.from("profiles").update({ plan_status: "plan_ready" }).eq("user_id", profile.user_id);
      toast.success("¡Planes guardados y usuario notificado!");
      onUpdate(profile.user_id, { plan_status: "plan_ready" });
    } else {
      toast.error("Error al guardar los planes.");
    }
    setSaving(false);
  };

  const autoGeneratePlan = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-plan", {
      body: { user_id: profile.user_id },
    });
    if (error || !data?.success) {
      toast.error("Error al generar plan automático: " + (error?.message || data?.error || "Error desconocido"));
      setGenerating(false);
      return;
    }

    // Reload the plan data
    const [{ data: tp }, { data: np }] = await Promise.all([
      supabase.from("training_plan").select("workouts_json").eq("user_id", profile.user_id).single(),
      supabase.from("nutrition_plan").select("macros_json, meals_json").eq("user_id", profile.user_id).single(),
    ]);

    if (tp?.workouts_json) {
      const plans = tp.workouts_json as unknown as DayPlan[];
      if (Array.isArray(plans)) setDayPlans(plans);
    }
    if (np?.macros_json) {
      const m = np.macros_json as any;
      setMacros({ protein: m.protein?.toString() || "", carbs: m.carbs?.toString() || "", fats: m.fats?.toString() || "" });
    }
    if (np?.meals_json) {
      const meals = np.meals_json as any[];
      if (Array.isArray(meals)) {
        setMealsText(meals.map((m: any) => `${m.name}: ${m.description}`).join("\n"));
      }
    }

    onUpdate(profile.user_id, { plan_status: "plan_ready" });
    toast.success(`¡Plan auto-generado! ${data.training_days} días de entrenamiento, macros: P${data.macros.protein}/C${data.macros.carbs}/F${data.macros.fats}`);
    setGenerating(false);
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const goalLabel: Record<string, string> = {
    lose_weight: "🔥 Perder grasa",
    gain_muscle: "💪 Ganar músculo",
    recomp: "⚡ Recomposición",
    improve_endurance: "🏃 Mejorar resistencia",
    general_health: "❤️ Salud general",
  };

  const trainingOnly = (profile as any).subscription_tier === "training";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold font-display truncate">{profile.email}</h1>
          <div className="flex gap-2 mt-1">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${profile.payment_status === "paid" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
              {profile.payment_status === "paid" ? "Pagado" : "Sin pagar"}
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${profile.plan_status === "plan_ready" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
              {profile.plan_status === "plan_ready" ? "Plan listo" : profile.plan_status === "plan_pending" ? "Pendiente" : "Onboarding"}
            </span>
          </div>
        </div>
        {profile.payment_status === "paid" && (
          <>
            <Button variant="outline" onClick={autoGeneratePlan} disabled={generating} className="shrink-0">
              <Wand2 className="w-4 h-4 mr-1" /> {generating ? "Generando..." : "Auto-generar"}
            </Button>
            <Button variant="hero" onClick={savePlans} disabled={saving} className="shrink-0">
              <Save className="w-4 h-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
            </Button>
          </>
        )}
        {!restricted && <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon" className="shrink-0" disabled={deleting}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminarán permanentemente todos los datos de <strong>{profile.email}</strong>: perfil, planes, entrenamientos, chat, fotos y cuenta. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>}
      </div>

      {/* Tabs */}
      {profile.payment_status !== "paid" && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 text-center">
          <p className="text-sm font-medium text-amber-400">⚠️ Este usuario aún no ha pagado.</p>
          <p className="text-xs text-muted-foreground mt-1">Solo puedes ver su info. Para asignar planes, el usuario debe completar el pago primero.</p>
        </div>
      )}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList className={`grid w-full bg-secondary/50 ${profile.payment_status === "paid" ? (trainingOnly ? "grid-cols-6" : "grid-cols-7") : "grid-cols-1"}`}>
          <TabsTrigger value="info" className="text-xs gap-1.5">
            <User2 className="w-3.5 h-3.5" /> Info
          </TabsTrigger>
          {profile.payment_status === "paid" && (
            <>
              <TabsTrigger value="goal" className="text-xs gap-1.5">
                <Target className="w-3.5 h-3.5" /> Objetivo
              </TabsTrigger>
              <TabsTrigger value="progress" className="text-xs gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Progreso
              </TabsTrigger>
              <TabsTrigger value="training" className="text-xs gap-1.5">
                <Dumbbell className="w-3.5 h-3.5" /> Entreno
              </TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Calendario
              </TabsTrigger>
              {!trainingOnly && (
                <TabsTrigger value="nutrition" className="text-xs gap-1.5">
                  <Apple className="w-3.5 h-3.5" /> Nutrición
                </TabsTrigger>
              )}
              <TabsTrigger value="chat" className="text-xs gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" /> Chat
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Tab: Info */}
        <TabsContent value="info" className="space-y-6">
          {/* Payment status toggle */}
          {!restricted && <div className="bg-card rounded-xl p-5 border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Estado de pago</div>
                <div className="text-xs text-muted-foreground">
                  {profile.payment_status === "paid" ? "✅ Pagado" : "❌ Sin pagar"}
                </div>
              </div>
            </div>
            <Switch
              checked={profile.payment_status === "paid"}
              onCheckedChange={async (checked) => {
                const newStatus = checked ? "paid" : "unpaid";
                const updates: any = { payment_status: newStatus };
                if (checked && profile.plan_status === "onboarding") {
                  updates.plan_status = "plan_pending";
                }
                if (!checked) {
                  updates.plan_status = "onboarding";
                }
                const { error } = await supabase.from("profiles").update(updates).eq("user_id", profile.user_id);
                if (!error) {
                  onUpdate(profile.user_id, updates);
                  toast.success(checked ? "Usuario marcado como pagado" : "Usuario marcado como sin pagar");
                } else {
                  toast.error("Error al actualizar estado de pago");
                }
              }}
            />
          </div>}

          {/* Admin role toggle */}
          {!restricted && <div className="bg-card rounded-xl p-5 border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Rol de Administrador</div>
                <div className="text-xs text-muted-foreground">
                  {isUserAdmin ? "Este usuario es admin" : "Usuario normal"}
                </div>
              </div>
            </div>
            <Switch checked={isUserAdmin} onCheckedChange={toggleAdminRole} disabled={roleLoading} />
          </div>}

          {onboarding ? (
            <div className="bg-card rounded-xl p-6 border border-border">
              <h2 className="font-bold font-display mb-4 text-sm uppercase tracking-wider text-muted-foreground">Datos del Onboarding</h2>
              {(() => {
                const av = onboarding.availability as any;
                const sportSchedules: Record<string, { dow: number; start: string; end: string }> = av?.sport_schedules || {};
                const customActivities: Array<{ title: string; dow: number; start: string; end: string }> = av?.custom_activities || [];
                const dowNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                const formatSchedule = (s: { dow: number; start: string; end: string }) =>
                  `${dowNames[s.dow] ?? "?"} ${s.start}–${s.end}`;
                const days = av?.days ? `${av.days} días/sem` : null;
                const hours = av?.hours ? `${av.hours}h por sesión` : null;
                const summary = [days, hours].filter(Boolean).join(" · ") || null;
                return (
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: "Edad", value: onboarding.age },
                  { label: "Sexo", value: onboarding.sex === "male" ? "Hombre" : onboarding.sex === "female" ? "Mujer" : null },
                  { label: "Altura", value: onboarding.height ? `${onboarding.height} cm` : null },
                  { label: "Peso", value: onboarding.weight ? `${onboarding.weight} kg` : null },
                  { label: "Equipamiento", value: onboarding.equipment_type ? `🏋️ ${onboarding.equipment_type}` : null },
                  { label: "Objetivo", value: onboarding.goal ? (goalLabel[onboarding.goal] || onboarding.goal) : null },
                  { label: "Meta específica", value: onboarding.specific_goal ? `🎯 ${onboarding.specific_goal}` : null },
                  { label: "Deportes", value: onboarding.sports },
                  { label: "Intensidad", value: onboarding.intensity_level ? `${onboarding.intensity_level}/10` : null },
                  { label: "Disponibilidad", value: summary },
                ].map((item) => (
                  <div key={item.label} className="bg-secondary/30 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-sm font-medium">{item.value || "—"}</div>
                  </div>
                ))}
                {Object.keys(sportSchedules).length > 0 && (
                  <div className="sm:col-span-2 bg-secondary/30 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">🏃 Horarios de deportes</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(sportSchedules).map(([sport, sched]) => (
                        <div key={sport} className="bg-card rounded-md px-3 py-1.5 text-xs border border-border">
                          <span className="font-semibold capitalize">{sport}</span>
                          <span className="text-muted-foreground ml-2">{formatSchedule(sched)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {customActivities.length > 0 && (
                  <div className="sm:col-span-2 bg-secondary/30 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">📌 Actividades personalizadas</div>
                    <div className="flex flex-wrap gap-2">
                      {customActivities.map((act, i) => (
                        <div key={i} className="bg-card rounded-md px-3 py-1.5 text-xs border border-border">
                          <span className="font-semibold">{act.title}</span>
                          <span className="text-muted-foreground ml-2">{formatSchedule(act)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {onboarding.injuries && (
                  <div className="sm:col-span-2 bg-destructive/10 rounded-lg p-3 border border-destructive/20">
                    <div className="text-[10px] uppercase tracking-wider text-destructive mb-1">⚠️ Lesiones / Condiciones</div>
                    <div className="text-sm">{onboarding.injuries}</div>
                  </div>
                )}
                <div className="sm:col-span-2 bg-secondary/30 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Preferencias nutricionales</div>
                  <div className="text-sm">{onboarding.nutrition_preferences || "—"}</div>
                </div>
                <div className="sm:col-span-2 bg-secondary/30 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Alergias</div>
                  <div className="text-sm">{onboarding.allergies || "—"}</div>
                </div>
              </div>
                );
              })()}
            </div>
          ) : (
            <div className="bg-card rounded-xl p-8 border border-border text-center">
              <p className="text-sm text-muted-foreground">El usuario aún no ha completado el onboarding.</p>
            </div>
          )}
        </TabsContent>

        {/* Tab: Goal */}
        <TabsContent value="goal">
          <UserGoalPanel userId={profile.user_id} email={profile.email} />
        </TabsContent>

        {/* Tab: Progress */}
        <TabsContent value="progress">
          <UserProgressPanel userId={profile.user_id} travelModeUntil={profile.travel_mode_until} travelEquipment={profile.travel_equipment} />
        </TabsContent>

        {/* Tab: Training */}
        <TabsContent value="training" className="space-y-6">
          <TrainingPlanForm dayPlans={dayPlans} onChange={setDayPlans} userSports={onboarding?.sports} equipmentType={onboarding?.equipment_type || "Mixto"} specificGoal={onboarding?.specific_goal || undefined} intensityLevel={onboarding?.intensity_level ?? 5} userGoal={onboarding?.goal || undefined} userInjuries={onboarding?.injuries || undefined} userAge={onboarding?.age ?? undefined} userAvailability={onboarding?.availability as Record<string, boolean> | null} />
        </TabsContent>

        {/* Tab: Calendar (admin) */}
        <TabsContent value="calendar" className="space-y-6">
          <AdminCalendarTab profile={profile} dayPlans={dayPlans} />
        </TabsContent>

        {/* Tab: Nutrition */}
        <TabsContent value="nutrition" className="space-y-6">
          <div className="bg-card rounded-xl p-6 border border-border">
            <h2 className="font-bold font-display mb-4 flex items-center gap-2">
              <Apple className="w-5 h-5 text-primary" />
              Plan de Nutrición
            </h2>

            {/* Macro templates */}
            <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Calcular macros ({onboarding?.weight || 70}kg)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(MACRO_TEMPLATES).map(([key, tpl]) => (
                  <Button key={key} variant="outline" size="sm" className="text-xs h-7" onClick={() => applyMacroTemplate(key)}>
                    {tpl.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { key: "protein" as const, label: "Proteína (g)", emoji: "🥩" },
                { key: "carbs" as const, label: "Carbos (g)", emoji: "🍚" },
                { key: "fats" as const, label: "Grasas (g)", emoji: "🥑" },
              ].map((m) => (
                <div key={m.key} className="bg-secondary/30 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-1">{m.emoji}</div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</Label>
                  <Input
                    type="number"
                    value={macros[m.key]}
                    onChange={(e) => setMacros((prev) => ({ ...prev, [m.key]: e.target.value }))}
                    className="mt-1 text-center text-lg font-bold bg-background"
                  />
                </div>
              ))}
            </div>

            {/* Meals */}
            <div>
              <Label className="text-xs text-muted-foreground">Comidas (una por línea, formato: Nombre: Descripción)</Label>
              <Textarea
                value={mealsText}
                onChange={(e) => setMealsText(e.target.value)}
                placeholder={"Desayuno: Avena con frutos rojos y batido de proteínas\nAlmuerzo: Pollo a la plancha con arroz y verduras\nCena: Salmón al horno con patata y ensalada"}
                rows={8}
                className="mt-2 font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-2">
                💡 Cada línea se convierte en una comida. El texto antes de ":" es el nombre.
              </p>
            </div>
          </div>
        </TabsContent>


        {/* Tab: Chat */}
        <TabsContent value="chat">
          <Chat conversationUserId={profile.user_id} isAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserDetail;

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
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">{conflicts.length} conflicto{conflicts.length > 1 ? "s" : ""} detectado{conflicts.length > 1 ? "s" : ""} esta semana</p>
                <p className="text-xs text-muted-foreground mt-0.5">El sistema puede reubicar los entrenos automáticamente respetando recuperación.</p>
              </div>
            </div>
            <Button size="sm" onClick={runAutoReschedule} disabled={running} variant="hero">
              {running ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              {running ? "Aplicando…" : "Aplicar auto-ajuste"}
            </Button>
          </div>
          <ul className="space-y-1.5">
            {conflicts.slice(0, 5).map((c, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>
                  <strong>{c.dayLabel}</strong> · {c.trainingTitle} —{" "}
                  <span className="text-muted-foreground">{c.hint}</span>
                </span>
              </li>
            ))}
            {conflicts.length > 5 && (
              <li className="text-xs text-muted-foreground italic">…y {conflicts.length - 5} más</li>
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
