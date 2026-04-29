import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Sparkles, Calendar as CalendarIcon, Check, Loader2, Zap } from "lucide-react";
import PricingTiers from "@/components/PricingTiers";

const STEPS = [
  "Datos Físicos",
  "Sexo",
  "Equipamiento",
  "Enfoque Principal",
  "Objetivo",
  "Meta Específica",
  "Deportes",
  "Horarios",
  "Intensidad",
  "Tests de Nivel",
  "Lesiones",
  "Nutrición",
  "Google Calendar",
  "Resumen",
];

const EQUIPMENT_TYPES = [
  { value: "Gimnasio", label: "Gimnasio", emoji: "🏋️", desc: "Máquinas, barras, mancuernas" },
  { value: "Calistenia", label: "Calistenia", emoji: "🤸", desc: "Solo peso corporal" },
  { value: "Mixto", label: "Mixto", emoji: "⚡", desc: "Combina ambos" },
];

const PRIMARY_FOCUS_OPTIONS = [
  {
    value: "gimnasio",
    label: "Foco gimnasio",
    emoji: "💪",
    desc: "Hipertrofia y fuerza con cargas. Banca, sentadilla, peso muerto.",
  },
  {
    value: "calistenia",
    label: "Foco calistenia",
    emoji: "🤸",
    desc: "Skills y control corporal. Pino, muscle up, planche, lever.",
  },
  {
    value: "mixto",
    label: "Mixto / híbrido",
    emoji: "⚡",
    desc: "Lo mejor de los dos mundos. Fuerza con cargas + skills.",
  },
];

const GOALS = [
  { value: "lose_weight", label: "Perder grasa", emoji: "🔥" },
  { value: "gain_muscle", label: "Ganar músculo", emoji: "💪" },
  { value: "recomp", label: "Recomposición", emoji: "⚡" },
  { value: "improve_endurance", label: "Mejorar resistencia", emoji: "🏃" },
  { value: "general_health", label: "Salud general", emoji: "❤️" },
  { value: "skill_based", label: "Lograr un skill concreto", emoji: "🎯" },
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
  Calistenia: ["Handstand / Pino", "Muscle Up", "Planche", "Front Lever", "Back Lever", "Human Flag", "Pistol Squat"],
  Gimnasio: ["Press banca 100kg", "Sentadilla 120kg", "Peso muerto 140kg", "Press militar 60kg", "Dominadas lastradas +20kg"],
  Mixto: ["Handstand / Pino", "Muscle Up", "Press banca 100kg", "Front Lever", "Sentadilla 120kg"],
};

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Horario sugerido por defecto al seleccionar un deporte (el usuario puede cambiarlo).
// Ahora trabajamos con hora de inicio y hora de fin (no duración).
const SPORT_SCHEDULE_DEFAULTS: Record<string, { dow: number; start: string; end: string }> = {
  boxeo:    { dow: 2, start: "19:00", end: "20:00" },
  escalada: { dow: 4, start: "18:00", end: "19:30" },
  yoga:     { dow: 3, start: "08:00", end: "09:00" },
  running:  { dow: 6, start: "09:00", end: "09:45" },
  natacion: { dow: 5, start: "19:00", end: "19:45" },
  ciclismo: { dow: 6, start: "10:00", end: "11:30" },
  futbol:   { dow: 5, start: "20:00", end: "21:30" },
  tenis:    { dow: 4, start: "19:00", end: "20:00" },
  padel:    { dow: 4, start: "20:00", end: "21:00" },
  danza:    { dow: 3, start: "19:00", end: "20:00" },
};

type Schedule = { dow: number; start: string; end: string };
type CustomActivity = { id: string; title: string; dow: number; start: string; end: string };

const TIME_OPTIONS = Array.from({ length: 36 }).map((_, i) => {
  const totalMin = 6 * 60 + i * 30; // 06:00 → 23:30
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

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
    equipment_type: "",
    primary_focus: "",
    goal: "",
    specific_goal: "",
    sports: [] as string[],
    sport_schedules: {} as Record<string, Schedule>,
    custom_activities: [] as CustomActivity[],
    intensity_level: 5,
    initial_tests: { pullups: "", pushups: "", squat: "", plank: "" },
    injuries: "",
    nutrition_preferences: "",
    allergies: "",
  });

  const update = (field: string, value: any) => setData((d) => ({ ...d, [field]: value }));

  // Detectar si volvemos del OAuth de Google Calendar y saltar al paso del calendario.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal") === "connected") {
      setStep(12);
      setGcalConnected(true);
      window.history.replaceState({}, "", "/onboarding");
    }
  }, []);

  // Comprobar estado de conexión a Google Calendar
  useEffect(() => {
    if (!user) return;
    supabase
      .from("google_calendar_tokens")
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

  // --- Custom activities (cosas no deportivas: salir con amigos, trabajo, etc.) ---
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

    // Auto-calcular días disponibles para entrenar = días sin actividad fija que ocupe la franja 17-22.
    // Si una actividad fija ocupa la noche, ese día NO se considera disponible para gym/calistenia.
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
    const autoHours = 1.25; // duración estándar por sesión

    const { error } = await supabase.from("onboarding").upsert(
      {
        user_id: user.id,
        age: parseInt(data.age) || null,
        height: parseFloat(data.height) || null,
        weight: parseFloat(data.weight) || null,
        sex: data.sex || null,
        equipment_type: data.equipment_type || "Mixto",
        primary_focus: data.primary_focus || "mixto",
        goal: data.goal,
        specific_goal: data.specific_goal || null,
        sports: data.sports.join(", "),
        intensity_level: data.intensity_level,
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
        // Fetch yearly price from settings to show in paywall
        const { data: settings } = await supabase
          .from("settings")
          .select("yearly_price_eur")
          .limit(1)
          .single();
        if (settings?.yearly_price_eur) setYearlyPrice(settings.yearly_price_eur);
        toast.success("¡Cuestionario completado! Elige tu plan.");
        setShowPaywall(true);
      }
    } else {
      toast.error("Algo salió mal. Por favor, inténtalo de nuevo.");
    }
    setLoading(false);
  };

  const goToCheckout = async (plan: "monthly" | "yearly") => {
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

  const canNext = () => {
    if (step === 0) return data.age && data.height && data.weight;
    if (step === 1) return data.sex;
    if (step === 2) return data.equipment_type;
    if (step === 3) return data.primary_focus;
    if (step === 4) return data.goal;
    return true;
  };

  const suggestions = SPECIFIC_GOAL_SUGGESTIONS[data.equipment_type] || SPECIFIC_GOAL_SUGGESTIONS["Mixto"];

  // Paywall view (shown after completing onboarding if user is unpaid)
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
          <PricingTiers onSelect={goToCheckout} yearlyPrice={yearlyPrice} />
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
          <h1 className="text-2xl font-bold font-display mt-6 mb-2">Cuéntanos Sobre Ti</h1>
          <p className="text-muted-foreground text-sm">Paso {step + 1} de {STEPS.length}: {STEPS[step]}</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>

        <div className="bg-card rounded-2xl p-8 border border-border card-shadow">
          {/* Step 0: Physical data */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label>Edad</Label>
                <Input type="number" value={data.age} onChange={(e) => update("age", e.target.value)} placeholder="25" className="mt-1.5" />
              </div>
              <div>
                <Label>Altura (cm)</Label>
                <Input type="number" value={data.height} onChange={(e) => update("height", e.target.value)} placeholder="175" className="mt-1.5" />
              </div>
              <div>
                <Label>Peso (kg)</Label>
                <Input type="number" value={data.weight} onChange={(e) => update("weight", e.target.value)} placeholder="70" className="mt-1.5" />
              </div>
            </div>
          )}

          {/* Step 1: Sex */}
          {step === 1 && (
            <div>
              <Label className="mb-3 block">Sexo biológico</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "male", label: "Hombre", emoji: "♂️" },
                  { value: "female", label: "Mujer", emoji: "♀️" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("sex", opt.value)}
                    className={`p-5 rounded-xl border-2 text-center transition-all ${
                      data.sex === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="text-3xl mb-2">{opt.emoji}</div>
                    <div className="font-medium text-sm">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Equipment type */}
          {step === 2 && (
            <div>
              <Label className="mb-3 block">¿Cómo prefieres entrenar?</Label>
              <div className="grid grid-cols-1 gap-2">
                {EQUIPMENT_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("equipment_type", opt.value)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      data.equipment_type === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Primary focus (gym vs calisthenics vs mixed) */}
          {step === 3 && (
            <div>
              <Label className="mb-1.5 block">¿En qué quieres centrarte?</Label>
              <p className="text-xs text-muted-foreground mb-4">
                Esto define la lógica de tu plan: cargas progresivas, skills, o un híbrido.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {PRIMARY_FOCUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("primary_focus", opt.value)}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      data.primary_focus === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span className="text-2xl mt-0.5">{opt.emoji}</span>
                    <div>
                      <span className="font-medium block">{opt.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Goal */}
          {step === 4 && (
            <div>
              <Label className="mb-3 block">¿Cuál es tu objetivo principal?</Label>
              <div className="grid grid-cols-1 gap-2">
                {GOALS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("goal", opt.value)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      data.goal === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Specific Goal */}
          {step === 5 && (
            <div>
              <Label className="mb-1.5 block">¿Tienes alguna meta específica?</Label>
              <p className="text-xs text-muted-foreground mb-4">
                Cuéntanos qué quieres lograr y adaptaremos tu rutina para ello
              </p>
              <Textarea
                value={data.specific_goal}
                onChange={(e) => update("specific_goal", e.target.value)}
                placeholder="Ej: Hacer handstand, muscle up, levantar 100kg en press banca..."
                rows={3}
                className="mb-4"
              />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Sugerencias para {data.equipment_type || "tu tipo"}:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => {
                    const parts = data.specific_goal
                      .split(",")
                      .map((p) => p.trim())
                      .filter(Boolean);
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
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[10px] ${
                          isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                        }`}>
                          {isSelected ? "✓" : ""}
                        </span>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Sports */}
          {step === 6 && (
            <div>
              <Label className="mb-3 block">¿Qué deportes practicas o te interesan?</Label>
              <p className="text-xs text-muted-foreground mb-4">Selecciona todos los que quieras</p>
              <div className="grid grid-cols-2 gap-2">
                {SPORTS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleSport(s.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all text-sm ${
                      data.sports.includes(s.value)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span className="text-xl">{s.emoji}</span>
                    <span className="font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 7: Sport schedules */}
          {step === 7 && (
            <div>
              <Label className="mb-1.5 block">Tu agenda semanal fija</Label>
              <p className="text-xs text-muted-foreground mb-4">
                Indica a qué hora <span className="text-foreground font-medium">empieza y acaba</span> cada deporte y cualquier otra cosa fija (trabajo, salir con amigos, clases…). Tu plan de entrenos se ajustará a los huecos libres automáticamente.
              </p>

              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {/* Deportes secundarios */}
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

                {/* Actividades personalizadas */}
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
                      Trabajo, clases, quedadas, recoger niños… cualquier cosa que ocupe horas fijas en tu semana.
                    </div>
                  )}

                  {data.custom_activities.map((act) => (
                    <div key={act.id} className="p-3 rounded-xl border border-border bg-card">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Input
                          value={act.title}
                          onChange={(e) => updateCustomActivity(act.id, { title: e.target.value })}
                          placeholder="Ej: Salir con amigos, trabajo, clase de inglés…"
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

                <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
                  ✨ Calcularemos automáticamente los días y huecos libres que tienes para entrenar.
                </div>
              </div>
            </div>
          )}

          {/* Step 8: Intensity */}
          {step === 8 && (
            <div>
              <Label className="mb-3 block">¿Qué nivel de intensidad buscas?</Label>
              <p className="text-xs text-muted-foreground mb-6">1 = suave y progresivo · 10 = máxima intensidad</p>
              <div className="px-2">
                <Slider
                  value={[data.intensity_level]}
                  onValueChange={([v]) => update("intensity_level", v)}
                  min={1}
                  max={10}
                  step={1}
                />
                <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                  <span>Suave</span>
                  <span className="text-2xl font-bold font-display text-primary">{data.intensity_level}</span>
                  <span>Intenso</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 9: Initial level tests */}
          {step === 9 && (
            <div>
              <Label className="mb-1.5 block">¿Cuál es tu nivel ahora mismo?</Label>
              <p className="text-xs text-muted-foreground mb-5">
                Aproxima sin obsesionarte. Lo usaré para calibrar tu plan inicial. Déjalo en blanco si no lo sabes.
              </p>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">Dominadas máximas (reps)</Label>
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
                <div>
                  <Label className="text-sm">Flexiones máximas (reps)</Label>
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
                <div>
                  <Label className="text-sm">Sentadilla con tu peso (reps máximas)</Label>
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

          {/* Step 10: Injuries */}
          {step === 10 && (
            <div>
              <Label className="mb-1.5 block">¿Tienes lesiones, molestias o condiciones físicas?</Label>
              <p className="text-xs text-muted-foreground mb-3">Déjalo vacío si no tienes ninguna</p>
              <Textarea
                value={data.injuries}
                onChange={(e) => update("injuries", e.target.value)}
                placeholder="Ej: Dolor lumbar, tendinitis hombro derecho, escoliosis..."
                rows={3}
              />
            </div>
          )}

          {/* Step 11: Nutrition */}
          {step === 11 && (
            <div className="space-y-4">
              <div>
                <Label>Preferencias nutricionales</Label>
                <Textarea
                  value={data.nutrition_preferences}
                  onChange={(e) => update("nutrition_preferences", e.target.value)}
                  placeholder="Vegetariano, alta en proteínas, mediterránea..."
                  className="mt-1.5"
                  rows={2}
                />
              </div>
              <div>
                <Label>Alergias o intolerancias</Label>
                <Textarea
                  value={data.allergies}
                  onChange={(e) => update("allergies", e.target.value)}
                  placeholder="Lactosa, gluten, frutos secos..."
                  className="mt-1.5"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Step 12: Google Calendar (opcional) */}
          {step === 12 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <CalendarIcon className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold font-display">Conecta tu Google Calendar</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Tus entrenos y comidas aparecerán automáticamente en tu calendario, a las horas que tú eliges.
                  <br />
                  <span className="text-xs">Es opcional — puedes hacerlo más tarde desde Ajustes.</span>
                </p>
              </div>

              {gcalConnected ? (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-5 text-center">
                  <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                    <Check className="w-5 h-5" />
                    Conectado correctamente
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sincronizaremos tu plan en cuanto esté listo.
                  </p>
                </div>
              ) : (
                <Button
                  onClick={handleConnectGoogle}
                  disabled={gcalLoading}
                  variant="hero"
                  className="w-full"
                  size="lg"
                >
                  {gcalLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Conectar Google Calendar
                </Button>
              )}

              <p className="text-[11px] text-center text-muted-foreground">
                Solo permisos de calendario. Puedes desconectarlo cuando quieras desde Ajustes.
              </p>
            </div>
          )}

          {/* Step 13: Summary */}
          {step === 13 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <div className="text-4xl mb-2">🎯</div>
                <h2 className="text-xl font-bold font-display">Tu plan personalizado</h2>
                <p className="text-sm text-muted-foreground mt-1">Esto es lo que recibirás en menos de 48h</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <span className="text-xl">🏋️</span>
                  <div>
                    <p className="font-semibold text-sm">
                      Rutina ajustada a tus huecos libres ·{" "}
                      {PRIMARY_FOCUS_OPTIONS.find((p) => p.value === data.primary_focus)?.label || "Mixto"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.sports.length > 0
                        ? SPORTS.filter((s) => data.sports.includes(s.value)).map((s) => s.label).join(", ")
                        : "Adaptada a tus deportes"}
                    </p>
                  </div>
                </div>

                {data.specific_goal && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <span className="text-xl">🎯</span>
                    <div>
                      <p className="font-semibold text-sm">Meta: {data.specific_goal}</p>
                      <p className="text-xs text-muted-foreground">Tu rutina se ajustará para lograrlo</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <span className="text-xl">🍽️</span>
                  <div>
                    <p className="font-semibold text-sm">
                      Plan nutricional de ~{data.weight ? Math.round(Number(data.weight) * 30) : "?"} kcal
                    </p>
                    <p className="text-xs text-muted-foreground">Macros personalizados para tu objetivo</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <span className="text-xl">💬</span>
                  <div>
                    <p className="font-semibold text-sm">Chat directo con tu entrenador</p>
                    <p className="text-xs text-muted-foreground">Dudas, cambios y seguimiento incluido</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <span className="text-xl">🔄</span>
                  <div>
                    <p className="font-semibold text-sm">Renovación mensual automática</p>
                    <p className="text-xs text-muted-foreground">Tu plan evoluciona contigo cada mes</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground mt-4">
                Objetivo: <span className="font-medium text-foreground">{GOALS.find((g) => g.value === data.goal)?.label || data.goal}</span>
                {data.weight && <> · <span className="font-medium text-foreground">{data.weight}kg</span></>}
                {data.intensity_level && <> · Intensidad <span className="font-medium text-foreground">{data.intensity_level}/10</span></>}
              </p>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
            </Button>
            {step < STEPS.length - 1 ? (
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
