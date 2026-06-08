import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Sparkles, Calendar as CalendarIcon, Check, Loader2, Zap, Upload, Image as ImageIcon, X } from "lucide-react";
import PricingTiers from "@/components/PricingTiers";

// Pasos dinámicos: la lista activa se calcula según los datos del usuario.
// Claves posibles: about, focus_goal, specific_goal, sports_schedule, level, health, summary
type StepKey =
  | "about"
  | "focus_goal"
  | "specific_goal"
  | "sports_schedule"
  | "level"
  | "health"
  | "summary";

const STEP_LABELS: Record<StepKey, string> = {
  about: "Sobre ti",
  focus_goal: "Enfoque y objetivo",
  specific_goal: "Tu skill",
  sports_schedule: "Tu agenda",
  level: "Tu nivel",
  health: "Salud y nutrición",
  summary: "Resumen",
};

const PRIMARY_FOCUS_OPTIONS = [
  { value: "gimnasio", label: "Gimnasio", emoji: "💪", desc: "Cargas, hipertrofia y fuerza." },
  { value: "calistenia", label: "Calistenia", emoji: "🤸", desc: "Skills y peso corporal." },
  { value: "mixto", label: "Mixto", emoji: "⚡", desc: "Lo mejor de los dos." },
];

const OCCUPATION_OPTIONS = [
  { value: "oficina", label: "Trabajo de oficina (sentado)", emoji: "💻" },
  { value: "fisico", label: "Trabajo físico (de pie / activo)", emoji: "🔧" },
  { value: "estudiante", label: "Estudiante", emoji: "🎓" },
  { value: "casa", label: "En casa / cuido de otros", emoji: "🏠" },
  { value: "otro", label: "Otro", emoji: "✍️" },
];

const GOALS = [
  { value: "lose_weight", label: "Perder grasa", emoji: "🔥" },
  { value: "gain_muscle", label: "Ganar músculo", emoji: "💪" },
  { value: "recomp", label: "Recomposición", emoji: "⚡" },
  { value: "improve_endurance", label: "Resistencia", emoji: "🏃" },
  { value: "general_health", label: "Salud general", emoji: "❤️" },
  { value: "skill_based", label: "Skill concreto", emoji: "🎯" },
];

const SPORTS = [
  { value: "gimnasio", label: "Gimnasio", emoji: "🏋️" },
  { value: "running", label: "Running", emoji: "🏃" },
  { value: "natacion", label: "Natación", emoji: "🏊" },
  { value: "calistenia", label: "Calistenia", emoji: "🤸" },
  { value: "boxeo", label: "Boxeo", emoji: "🥊" },
  { value: "escalada", label: "Escalada", emoji: "🧗" },
  { value: "ciclismo", label: "Ciclismo", emoji: "🚴" },
  { value: "yoga", label: "Yoga", emoji: "🧘" },
];

const SPECIFIC_GOAL_SUGGESTIONS: Record<string, string[]> = {
  Calistenia: ["Handstand / Pino", "Muscle Up", "Planche", "Front Lever", "Pistol Squat"],
  Gimnasio: ["Press banca 100kg", "Sentadilla 120kg", "Peso muerto 140kg", "Dominadas +20kg"],
  Mixto: ["Handstand / Pino", "Muscle Up", "Press banca 100kg", "Front Lever"],
};

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const SPORT_SCHEDULE_DEFAULTS: Record<string, { dow: number; start: string; end: string }> = {
  boxeo:    { dow: 2, start: "19:00", end: "20:00" },
  escalada: { dow: 4, start: "18:00", end: "19:30" },
  yoga:     { dow: 3, start: "08:00", end: "09:00" },
  running:  { dow: 6, start: "09:00", end: "09:45" },
  natacion: { dow: 5, start: "19:00", end: "19:45" },
  ciclismo: { dow: 6, start: "10:00", end: "11:30" },
};

type Schedule = { dow: number; start: string; end: string };
type CustomActivity = { id: string; title: string; dow: number; start: string; end: string };

const TIME_OPTIONS = Array.from({ length: 36 }).map((_, i) => {
  const totalMin = 6 * 60 + i * 30;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const focusToEquipment = (focus: string) => {
  if (focus === "gimnasio") return "Gimnasio";
  if (focus === "calistenia") return "Calistenia";
  return "Mixto";
};

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [yearlyPrice, setYearlyPrice] = useState(190);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [data, setData] = useState({
    age: "",
    height: "",
    weight: "",
    sex: "",
    occupation: "",
    occupation_detail: "",
    primary_focus: "",
    goal: "",
    specific_goal: "",
    sports: [] as string[],
    sport_schedules: {} as Record<string, Schedule>,
    custom_activities: [] as CustomActivity[],
    initial_tests: { pullups: "", pushups: "", squat: "", plank: "" },
    injuries: "",
    nutrition_preferences: "",
    allergies: "",
    goal_photo_url: "",
  });

  const update = (field: string, value: any) => setData((d) => ({ ...d, [field]: value }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal") === "connected") {
      setGcalConnected(true);
      // Saltamos al último paso una vez se conozcan los pasos activos
      setTimeout(() => setStep(99), 0);
      window.history.replaceState({}, "", "/onboarding");
    }
  }, []);

  // Pre-rellenar desde el AI Scan si existe en sessionStorage
  const [scanPrefill, setScanPrefill] = useState<{
    goal?: string;
    primary_focus?: string;
    intensity?: number;
    specific_goal?: string;
    objectiveImg?: string;
    used: boolean;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("autopilot_scan");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Date.now() - (parsed.createdAt || 0) > 24 * 60 * 60 * 1000) {
        sessionStorage.removeItem("autopilot_scan");
        return;
      }
      const r = parsed.result || {};
      const goal = ["lose_weight", "gain_muscle", "recomp", "improve_endurance", "general_health", "skill_based"].includes(r.inferred_goal)
        ? r.inferred_goal
        : undefined;
      const focus = ["gimnasio", "calistenia", "mixto"].includes(r.inferred_focus) ? r.inferred_focus : undefined;
      const specific = Array.isArray(r.inferred_specific_goals) ? r.inferred_specific_goals.join(", ") : undefined;
      setScanPrefill({
        goal,
        primary_focus: focus,
        intensity: typeof r.inferred_intensity === "number" ? r.inferred_intensity : undefined,
        specific_goal: specific,
        objectiveImg: parsed.objectiveImg,
        used: false,
      });
      setData((d) => ({
        ...d,
        goal: d.goal || goal || "",
        primary_focus: d.primary_focus || focus || "",
        specific_goal: d.specific_goal || specific || "",
      }));
    } catch {}
  }, []);

  // Subir foto objetivo del scan al bucket si no hay aún
  useEffect(() => {
    if (!user || !scanPrefill?.objectiveImg || data.goal_photo_url || scanPrefill.used) return;
    (async () => {
      try {
        // dataURL a Blob
        const res = await fetch(scanPrefill.objectiveImg!);
        const blob = await res.blob();
        const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
        const path = `${user.id}/scan-goal-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("progress-photos").upload(path, blob, { upsert: false });
        if (upErr) return;
        const { data: pub } = supabase.storage.from("progress-photos").getPublicUrl(path);
        update("goal_photo_url", pub.publicUrl);
        setScanPrefill((p) => (p ? { ...p, used: true } : p));
      } catch {}
    })();
  }, [user, scanPrefill, data.goal_photo_url]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("google_calendar_connections" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setGcalConnected(!!data));
  }, [user]);

  const handleConnectGoogle = async () => {
    setGcalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gcal-oauth-start", {
        body: { return_to: `${window.location.origin}/onboarding?gcal=connected` },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      toast.error("No se pudo iniciar la conexión con Google");
      setGcalLoading(false);
    }
  };

  const toggleSport = (sport: string) => {
    setData((d) => {
      const has = d.sports.includes(sport);
      const newSports = has ? d.sports.filter((s) => s !== sport) : [...d.sports, sport];
      const newSchedules = { ...d.sport_schedules };
      if (has) {
        delete newSchedules[sport];
      } else if (!newSchedules[sport]) {
        newSchedules[sport] = SPORT_SCHEDULE_DEFAULTS[sport] || { dow: 2, start: "19:00", end: "20:00" };
      }
      return { ...d, sports: newSports, sport_schedules: newSchedules };
    });
  };

  const updateSchedule = (sport: string, patch: Partial<Schedule>) => {
    setData((d) => ({
      ...d,
      sport_schedules: {
        ...d.sport_schedules,
        [sport]: { ...(d.sport_schedules[sport] || SPORT_SCHEDULE_DEFAULTS[sport] || { dow: 2, start: "19:00", end: "20:00" }), ...patch },
      },
    }));
  };

  const addCustomActivity = () => {
    setData((d) => ({
      ...d,
      custom_activities: [
        ...d.custom_activities,
        { id: crypto.randomUUID(), title: "", dow: 5, start: "20:00", end: "22:00" },
      ],
    }));
  };

  const updateCustomActivity = (id: string, patch: Partial<CustomActivity>) => {
    setData((d) => ({
      ...d,
      custom_activities: d.custom_activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const removeCustomActivity = (id: string) => {
    setData((d) => ({ ...d, custom_activities: d.custom_activities.filter((a) => a.id !== id) }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    const busyEveningDays = new Set<number>();
    Object.values(data.sport_schedules).forEach((s) => {
      const startH = parseInt((s.start || "00:00").split(":")[0]);
      if (startH >= 17 && startH <= 21) busyEveningDays.add(s.dow);
    });
    data.custom_activities.forEach((a) => {
      const startH = parseInt((a.start || "00:00").split(":")[0]);
      if (startH >= 17 && startH <= 21) busyEveningDays.add(a.dow);
    });
    const freeDays = [1, 2, 3, 4, 5, 6, 0].filter((d) => !busyEveningDays.has(d));
    const autoDays = Math.max(3, Math.min(5, freeDays.length));
    const autoHours = 1.25;

    const occupationFinal = data.occupation === "otro"
      ? (data.occupation_detail || "otro")
      : (OCCUPATION_OPTIONS.find((o) => o.value === data.occupation)?.label || data.occupation || null);

    const { error } = await supabase.from("onboarding").upsert(
      {
        user_id: user.id,
        age: parseInt(data.age) || null,
        height: parseFloat(data.height) || null,
        weight: parseFloat(data.weight) || null,
        sex: data.sex || null,
        occupation: occupationFinal,
        equipment_type: focusToEquipment(data.primary_focus),
        primary_focus: data.primary_focus || "mixto",
        goal: data.goal,
        specific_goal: data.specific_goal || null,
        sports: data.sports.join(", "),
        intensity_level: 7,
        initial_tests: data.initial_tests,
        injuries: data.injuries || null,
        availability: {
          days: String(autoDays),
          hours: String(autoHours),
          auto_calculated: true,
          sport_schedules: data.sport_schedules,
          custom_activities: data.custom_activities,
        },
        nutrition_preferences: data.nutrition_preferences,
        allergies: data.allergies,
        goal_photo_url: data.goal_photo_url || null,
      },
      { onConflict: "user_id" }
    );

    if (!error) {
      await supabase.from("profiles").update({ plan_status: "plan_pending" }).eq("user_id", user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("payment_status")
        .eq("user_id", user.id)
        .single();

      if (profile?.payment_status === "paid") {
        supabase.functions.invoke("generate-plan", { body: { user_id: user.id } });
        toast.success("¡Tu plan se está preparando! 🎉");
        navigate("/dashboard");
      } else {
        const { data: settingsData } = await (supabase.rpc as any)("get_public_settings");
        const settings = Array.isArray(settingsData) ? settingsData[0] : settingsData;
        if (settings?.yearly_price_eur) setYearlyPrice(settings.yearly_price_eur);
        toast.success("¡Cuestionario completado! Elige tu plan.");
        setShowPaywall(true);
      }
    } else {
      toast.error("Algo salió mal. Por favor, inténtalo de nuevo.");
    }
    setLoading(false);
  };

  const goToCheckout = async (plan: "training" | "full") => {
    setLoading(true);
    const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
      "create-checkout",
      { body: { referral_code: "", plan } }
    );
    if (checkoutError || !checkoutData?.url) {
      toast.error("Error al iniciar el pago. Inténtalo de nuevo.");
      setLoading(false);
    } else {
      window.location.href = checkoutData.url;
    }
  };

  // Pasos dinámicos según datos
  const activeSteps: StepKey[] = (() => {
    const arr: StepKey[] = ["about", "focus_goal"];
    if (data.goal === "skill_based") arr.push("specific_goal");
    arr.push("sports_schedule", "level", "health", "summary");
    return arr;
  })();

  // Si el step actual se sale del rango (p.ej. tras cambio dinámico), lo recortamos
  useEffect(() => {
    if (step > activeSteps.length - 1) setStep(activeSteps.length - 1);
  }, [activeSteps.length, step]);

  const currentKey = activeSteps[Math.min(step, activeSteps.length - 1)];

  const canNext = () => {
    if (currentKey === "about") {
      if (!(data.age && data.height && data.weight && data.sex && data.occupation)) return false;
      if (data.occupation === "otro" && !data.occupation_detail.trim()) return false;
      return true;
    }
    if (currentKey === "focus_goal") return !!data.primary_focus && !!data.goal;
    return true;
  };

  const suggestions = SPECIFIC_GOAL_SUGGESTIONS[focusToEquipment(data.primary_focus)] || SPECIFIC_GOAL_SUGGESTIONS["Mixto"];

  if (showPaywall) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <span className="font-display text-2xl font-bold text-gradient">Autopilot</span>
            <h1 className="text-3xl font-bold font-display mt-6 mb-2">Elige tu plan</h1>
            <p className="text-muted-foreground text-sm">
              Empieza con 7 días gratis · Cancela cuando quieras
            </p>
          </div>
          <PricingTiers onSelect={goToCheckout} recommended="full" />
          {loading && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              Preparando tu pago...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="font-display text-2xl font-bold text-gradient">Autopilot</span>
          <h1 className="text-2xl font-bold font-display mt-6 mb-2">Cuéntanos lo justo</h1>
          <p className="text-muted-foreground text-sm">Paso {Math.min(step, activeSteps.length - 1) + 1} de {activeSteps.length}: {STEP_LABELS[currentKey]}</p>
        </div>

        <div className="flex gap-1.5 mb-8">
          {activeSteps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>

        <div className="bg-card rounded-2xl p-8 border border-border card-shadow">
          {/* Step 0: Sobre ti */}
          {currentKey === "about" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Edad</Label>
                  <Input type="number" value={data.age} onChange={(e) => update("age", e.target.value)} placeholder="25" className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs">Altura (cm)</Label>
                  <Input type="number" value={data.height} onChange={(e) => update("height", e.target.value)} placeholder="175" className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs">Peso (kg)</Label>
                  <Input type="number" value={data.weight} onChange={(e) => update("weight", e.target.value)} placeholder="70" className="mt-1.5" />
                </div>
              </div>

              <div>
                <Label className="mb-2 block text-xs">Sexo biológico</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "male", label: "Hombre", emoji: "♂️" },
                    { value: "female", label: "Mujer", emoji: "♀️" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update("sex", opt.value)}
                      className={`p-3 rounded-xl border-2 text-center transition-all flex items-center justify-center gap-2 ${
                        data.sex === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      <span className="font-medium text-sm">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block text-xs">¿A qué te dedicas?</Label>
                <div className="grid grid-cols-1 gap-1.5">
                  {OCCUPATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update("occupation", opt.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all text-sm ${
                        data.occupation === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="text-lg">{opt.emoji}</span>
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
                {data.occupation === "otro" && (
                  <Input
                    value={data.occupation_detail}
                    onChange={(e) => update("occupation_detail", e.target.value)}
                    placeholder="Cuéntanos a qué te dedicas"
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          )}

          {/* Enfoque + Objetivo (combinados) */}
          {currentKey === "focus_goal" && (
            <div className="space-y-5">
              <div>
                <Label className="mb-2 block text-xs">¿En qué quieres centrarte?</Label>
                {scanPrefill?.primary_focus && (
                  <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-[10px] uppercase tracking-wider text-primary">
                    <Sparkles className="w-3 h-3" /> Detectado por IA
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {PRIMARY_FOCUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update("primary_focus", opt.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        data.primary_focus === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span className="font-medium text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block text-xs">Tu objetivo principal</Label>
                {scanPrefill?.goal && (
                  <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-[10px] uppercase tracking-wider text-primary">
                    <Sparkles className="w-3 h-3" /> Detectado por IA
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update("goal", opt.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left text-sm transition-all ${
                        data.goal === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="text-lg">{opt.emoji}</span>
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Skill concreto: solo si goal === skill_based */}
          {currentKey === "specific_goal" && (
            <div>
              <Label className="mb-1.5 block">¿Qué skill quieres conseguir?</Label>
              <p className="text-xs text-muted-foreground mb-3">Elige uno o varios, o escribe el tuyo</p>
                <Textarea
                  value={data.specific_goal}
                  onChange={(e) => update("specific_goal", e.target.value)}
                  placeholder="Ej: handstand, muscle up, press banca 100kg…"
                  rows={2}
                  className="mb-2"
                />
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => {
                    const parts = data.specific_goal.split(",").map((p) => p.trim()).filter(Boolean);
                    const isSelected = parts.some((p) => p.toLowerCase() === s.toLowerCase());
                    const toggle = () => {
                      const next = isSelected
                        ? parts.filter((p) => p.toLowerCase() !== s.toLowerCase())
                        : [...parts, s];
                      update("specific_goal", next.join(", "));
                    };
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={toggle}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                        }`}
                      >
                        {isSelected ? "✓ " : "+ "}{s}
                      </button>
                    );
                  })}
                </div>
            </div>
          )}

          {/* Deportes + Horarios (combinados) */}
          {currentKey === "sports_schedule" && (
            <div>
              <Label className="mb-1.5 block">Deportes y agenda</Label>
              <p className="text-xs text-muted-foreground mb-4">
                Marca los deportes que practicas y añade cosas fijas (trabajo, clases…). Encajaremos los entrenos en tus huecos libres.
              </p>

              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">Deportes</p>
                <div className="grid grid-cols-2 gap-2">
                  {SPORTS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleSport(s.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all text-sm ${
                        data.sports.includes(s.value) ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="text-lg">{s.emoji}</span>
                      <span className="font-medium">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {(() => {
                  const secondary = data.sports.filter((s) => s !== "gimnasio" && s !== "calistenia");
                  if (secondary.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Deportes</p>
                      {secondary.map((sportKey) => {
                        const sport = SPORTS.find((s) => s.value === sportKey);
                        const sched = data.sport_schedules[sportKey] || SPORT_SCHEDULE_DEFAULTS[sportKey] || { dow: 2, start: "19:00", end: "20:00" };
                        return (
                          <div key={sportKey} className="p-3 rounded-xl border border-border bg-card">
                            <div className="flex items-center gap-2 mb-2.5">
                              <span className="text-xl">{sport?.emoji}</span>
                              <span className="font-medium text-sm">{sport?.label}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Día</Label>
                                <select
                                  value={sched.dow}
                                  onChange={(e) => updateSchedule(sportKey, { dow: parseInt(e.target.value) })}
                                  className="w-full mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm"
                                >
                                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                                    <option key={d} value={d}>{DAYS_ES[d].slice(0, 3)}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Inicio</Label>
                                <select
                                  value={sched.start}
                                  onChange={(e) => updateSchedule(sportKey, { start: e.target.value })}
                                  className="w-full mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm"
                                >
                                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fin</Label>
                                <select
                                  value={sched.end}
                                  onChange={(e) => updateSchedule(sportKey, { end: e.target.value })}
                                  className="w-full mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm"
                                >
                                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Otras cosas fijas</p>
                    <button
                      type="button"
                      onClick={addCustomActivity}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      + Añadir
                    </button>
                  </div>

                  {data.custom_activities.length === 0 && (
                    <div className="p-3 rounded-xl bg-muted/30 border border-dashed border-border text-center text-xs text-muted-foreground">
                      Trabajo, clases, quedadas, recoger niños…
                    </div>
                  )}

                  {data.custom_activities.map((act) => (
                    <div key={act.id} className="p-3 rounded-xl border border-border bg-card">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Input
                          value={act.title}
                          onChange={(e) => updateCustomActivity(act.id, { title: e.target.value })}
                          placeholder="Ej: Trabajo, clase…"
                          className="h-8 text-sm flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomActivity(act.id)}
                          className="text-muted-foreground hover:text-destructive text-lg leading-none px-1"
                          aria-label="Eliminar"
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Día</Label>
                          <select
                            value={act.dow}
                            onChange={(e) => updateCustomActivity(act.id, { dow: parseInt(e.target.value) })}
                            className="w-full mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm"
                          >
                            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                              <option key={d} value={d}>{DAYS_ES[d].slice(0, 3)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Inicio</Label>
                          <select
                            value={act.start}
                            onChange={(e) => updateCustomActivity(act.id, { start: e.target.value })}
                            className="w-full mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm"
                          >
                            {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fin</Label>
                          <select
                            value={act.end}
                            onChange={(e) => updateCustomActivity(act.id, { end: e.target.value })}
                            className="w-full mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm"
                          >
                            {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tu nivel — campos según enfoque */}
          {currentKey === "level" && (
            <div>
              <Label className="mb-1.5 block">¿Cuál es tu nivel ahora?</Label>
              <p className="text-xs text-muted-foreground mb-5">
                Solo lo relevante para tu enfoque. Déjalo en blanco si no lo sabes.
              </p>
              <div className="space-y-3">
                {(data.primary_focus === "calistenia" || data.primary_focus === "mixto" || !data.primary_focus) && (
                  <div>
                    <Label className="text-sm">Dominadas máximas</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={data.initial_tests.pullups}
                      onChange={(e) =>
                        setData((d) => ({ ...d, initial_tests: { ...d.initial_tests, pullups: e.target.value } }))
                      }
                      placeholder="0 si no haces ninguna"
                      className="mt-1.5"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-sm">Flexiones máximas</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={data.initial_tests.pushups}
                    onChange={(e) =>
                      setData((d) => ({ ...d, initial_tests: { ...d.initial_tests, pushups: e.target.value } }))
                    }
                    placeholder="Ej: 15"
                    className="mt-1.5"
                  />
                </div>
                {(data.primary_focus === "gimnasio" || data.primary_focus === "mixto") && (
                  <div>
                    <Label className="text-sm">Sentadilla con tu peso (reps)</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={data.initial_tests.squat}
                      onChange={(e) =>
                        setData((d) => ({ ...d, initial_tests: { ...d.initial_tests, squat: e.target.value } }))
                      }
                      placeholder="Ej: 30"
                      className="mt-1.5"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-sm">Plancha frontal (segundos)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={data.initial_tests.plank}
                    onChange={(e) =>
                      setData((d) => ({ ...d, initial_tests: { ...d.initial_tests, plank: e.target.value } }))
                    }
                    placeholder="Ej: 60"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Salud + Nutrición (combinados) */}
          {currentKey === "health" && (
            <div className="space-y-4">
              <div>
                <Label>¿Lesiones o molestias?</Label>
                <Textarea
                  value={data.injuries}
                  onChange={(e) => update("injuries", e.target.value)}
                  placeholder="Ej: Lumbar, tendinitis hombro derecho…"
                  className="mt-1.5"
                  rows={2}
                />
              </div>
              <div>
                <Label>Preferencias nutricionales</Label>
                <Textarea
                  value={data.nutrition_preferences}
                  onChange={(e) => update("nutrition_preferences", e.target.value)}
                  placeholder="Vegetariano, alta en proteínas, mediterránea…"
                  className="mt-1.5"
                  rows={2}
                />
              </div>
              <div>
                <Label>Alergias o intolerancias</Label>
                <Textarea
                  value={data.allergies}
                  onChange={(e) => update("allergies", e.target.value)}
                  placeholder="Lactosa, gluten, frutos secos…"
                  className="mt-1.5"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Resumen */}
          {currentKey === "summary" && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <div className="text-4xl mb-2">🎯</div>
                <h2 className="text-xl font-bold font-display">Tu plan personalizado</h2>
                <p className="text-sm text-muted-foreground mt-1">Esto recibirás en menos de 48h</p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <span className="text-xl">🏋️</span>
                  <div>
                    <p className="font-semibold text-sm">
                      Rutina ajustada a tus huecos · {PRIMARY_FOCUS_OPTIONS.find((p) => p.value === data.primary_focus)?.label || "Mixto"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.sports.length > 0
                        ? SPORTS.filter((s) => data.sports.includes(s.value)).map((s) => s.label).join(", ")
                        : "Adaptada a ti"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <span className="text-xl">🍽️</span>
                  <div>
                    <p className="font-semibold text-sm">
                      Plan nutricional ~{data.weight ? Math.round(Number(data.weight) * 30) : "?"} kcal
                    </p>
                    <p className="text-xs text-muted-foreground">Macros para tu objetivo</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <span className="text-xl">💬</span>
                  <div>
                    <p className="font-semibold text-sm">Chat directo con tu entrenador</p>
                    <p className="text-xs text-muted-foreground">Dudas, cambios y seguimiento</p>
                  </div>
                </div>
              </div>

              {/* Optional: Google Calendar */}
              <div className="border-t border-border pt-5">
                <div className="flex items-start gap-3 mb-3">
                  <CalendarIcon className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Google Calendar (opcional)</p>
                    <p className="text-xs text-muted-foreground">Verás tus entrenos y comidas en tu calendario.</p>
                  </div>
                </div>
                {gcalConnected ? (
                  <div className="flex items-center gap-2 text-primary text-sm font-medium">
                    <Check className="w-4 h-4" /> Conectado
                  </div>
                ) : (
                  <Button onClick={handleConnectGoogle} disabled={gcalLoading} variant="outline" size="sm" className="w-full">
                    {gcalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                    Conectar Google Calendar
                  </Button>
                )}
              </div>

              {/* Optional: Goal photo */}
              <div className="border-t border-border pt-5">
                <div className="flex items-start gap-3 mb-3">
                  <ImageIcon className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Foto de físico objetivo (opcional)</p>
                    <p className="text-xs text-muted-foreground">Para que tu entrenador la use de referencia.</p>
                  </div>
                </div>
                {data.goal_photo_url ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={data.goal_photo_url} alt="Físico objetivo" className="w-full max-h-60 object-contain bg-secondary" />
                    <button
                      type="button"
                      onClick={() => update("goal_photo_url", "")}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user) return;
                        if (file.size > 8 * 1024 * 1024) { toast.error("Máx 8MB"); return; }
                        setLoading(true);
                        try {
                          const ext = file.name.split(".").pop() || "jpg";
                          const path = `${user.id}/goal-${Date.now()}.${ext}`;
                          const { error: upErr } = await supabase.storage.from("progress-photos").upload(path, file, { upsert: false });
                          if (upErr) throw upErr;
                          const { data: pub } = supabase.storage.from("progress-photos").getPublicUrl(path);
                          update("goal_photo_url", pub.publicUrl);
                          toast.success("Foto subida");
                        } catch (err: any) {
                          toast.error(err.message || "Error al subir");
                        }
                        setLoading(false);
                      }}
                    />
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                      {loading ? (
                        <Loader2 className="w-6 h-6 mx-auto text-primary animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1.5" />
                          <p className="text-xs font-medium">Sube tu foto de referencia</p>
                          <p className="text-[10px] text-muted-foreground">JPG, PNG · máx 8MB</p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
            </Button>
            {step < activeSteps.length - 1 ? (
              <Button variant="default" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                Siguiente <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button variant="hero" onClick={handleSubmit} disabled={loading}>
                <Sparkles className="w-4 h-4 mr-1" /> {loading ? "Enviando..." : "Crear mi plan"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;