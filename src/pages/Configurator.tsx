import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { hasCoaching } from "@/lib/entitlements";
import { logConsent } from "@/lib/consents";
import { track } from "@/lib/analytics";
import PageHead from "@/components/PageHead";
import PlanPreview from "@/components/PlanPreview";

const KEY = "autopilot_config";
const DOW = [
  { v: 1, s: "L", l: "Lunes" }, { v: 2, s: "M", l: "Martes" }, { v: 3, s: "X", l: "Miércoles" },
  { v: 4, s: "J", l: "Jueves" }, { v: 5, s: "V", l: "Viernes" }, { v: 6, s: "S", l: "Sábado" }, { v: 0, s: "D", l: "Domingo" },
];
const GOALS = [
  { v: "lose_weight", l: "Perder grasa" }, { v: "gain_muscle", l: "Ganar músculo" },
  { v: "recomp", l: "Recomposición" }, { v: "general_health", l: "Fuerza y salud" },
];
const FOCUS = [{ v: "gimnasio", l: "Gimnasio" }, { v: "calistenia", l: "Calistenia" }, { v: "mixto", l: "Mixto" }];
const DURATION = [{ v: 40, l: "30–45 min" }, { v: 55, l: "45–60 min" }, { v: 75, l: "60–90 min" }];
const STRUCTURE = [
  { v: "full_body", l: "Full Body" }, { v: "torso_pierna", l: "Torso / Pierna" },
  { v: "ppl", l: "Empuje / Tirón / Pierna" }, { v: "coach", l: "Que elija mi entrenador" },
];
const COOKING = [
  { v: "quick", l: "Rápido, sin complicarme", d: "Recetas de menos de 15 min" },
  { v: "normal", l: "Algo de cocina", d: "Platos sencillos y variados" },
  { v: "loves", l: "Me gusta cocinar", d: "Recetas más elaboradas" },
];
const STYLE = [
  { v: "direct", l: "Directo y exigente" }, { v: "flexible", l: "Flexible y realista" }, { v: "technical", l: "Técnico y analítico" },
];
const MODE = [
  { v: "individual", l: "Individual", d: "Un plan solo para ti" },
  { v: "pareja", l: "En pareja", d: "Plus 44€/mes o Coach 74€/mes para los dos (~25% menos)" },
];
const TIMES = Array.from({ length: 32 }, (_, i) => {
  const m = 7 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
});

type Cfg = {
  mode: string; partner_email: string; goal: string; focus: string; days: number[]; minutes: number; structure: string;
  meals: number; avoid: string; cooking: string; weight: string; checkin_dow: number; checkin_time: string; style: string;
};
const initial: Cfg = {
  mode: "individual", partner_email: "", goal: "", focus: "", days: [], minutes: 55, structure: "coach",
  meals: 3, avoid: "", cooking: "normal", weight: "", checkin_dow: 0, checkin_time: "19:30", style: "flexible",
};

const label = (arr: { v: any; l: string }[], v: any) => arr.find((x) => x.v === v)?.l ?? "—";

const Pill = ({ on, onClick, children, sub }: { on: boolean; onClick: () => void; children: React.ReactNode; sub?: string }) => (
  <button type="button" onClick={onClick}
    className={`text-left rounded-xl border px-4 py-3 transition-colors ${on ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}>
    <div className="font-medium text-sm">{children}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </button>
);

const Configurator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [c, setC] = useState<Cfg>(initial);
  const [accept, setAccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setC((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (Date.now() - (p.createdAt || 0) > 7 * 864e5) return localStorage.removeItem(KEY);
      setC({ ...initial, ...p.data });
      setStep(4);
    } catch {}
  }, []);

  const valid = [
    !!c.goal && !!c.focus && (c.mode === "individual" || /\S+@\S+\.\S+/.test(c.partner_email)),
    c.days.length >= 2,
    true,
    true,
    accept,
  ];

  const save = async () => {
    if (!user) {
      try { localStorage.setItem(KEY, JSON.stringify({ data: c, createdAt: Date.now() })); } catch {}
      track("onboarding_complete", { paid: false, anonymous: true });
      navigate("/signup?from=quiz");
      return;
    }
    setSaving(true);
    const nutrition = [`${c.meals} comidas al día`, `Cocina: ${label(COOKING, c.cooking)}`, c.avoid && `Evitar: ${c.avoid}`]
      .filter(Boolean).join(" · ");
    const { error } = await supabase.from("onboarding").upsert({
      user_id: user.id,
      goal: c.goal,
      primary_focus: c.focus,
      equipment_type: c.focus === "gimnasio" ? "Gimnasio" : c.focus === "calistenia" ? "Calistenia" : "Mixto",
      intensity_level: 7,
      nutrition_preferences: nutrition,
      weight: Number(c.weight) > 30 ? Number(c.weight) : null,
      availability: {
        days: String(c.days.length), hours: String(+(c.minutes / 60).toFixed(2)),
        training_days: c.days, session_minutes: c.minutes, structure: c.structure,
        meals_per_day: c.meals, avoid_foods: c.avoid, cooking: c.cooking,
        checkin_dow: c.checkin_dow, checkin_time: c.checkin_time, coach_style: c.style,
        training_mode: c.mode, partner_email: c.mode === "pareja" ? c.partner_email : null,
      },
    }, { onConflict: "user_id" });
    if (error) { setSaving(false); toast.error("No se pudo guardar. Inténtalo de nuevo."); return; }
    try { localStorage.removeItem(KEY); } catch {}
    try {
      await Promise.all([
        logConsent("terms", true, { source: "configurator" }),
        logConsent("privacy", true, { source: "configurator" }),
        logConsent("health_data", true, { source: "configurator" }),
      ]);
    } catch {}
    await supabase.from("profiles").update({ plan_status: "plan_pending" }).eq("user_id", user.id);
    const { data: profile } = await supabase.from("profiles")
      .select("payment_status, subscription_tier, subscription_status, subscription_end, stripe_payment_id")
      .eq("user_id", user.id).maybeSingle();
    if (!hasCoaching(profile)) {
      const { data: g, error: ge } = await supabase.functions.invoke("generate-plan", { body: { user_id: user.id } });
      if (ge || !g?.success) toast.error("Tu configuración está guardada; la rutina se preparará en breve.");
    }
    track("onboarding_complete", { paid: hasCoaching(profile) });
    navigate("/dashboard");
  };

  const dayNames = DOW.filter((d) => c.days.includes(d.v)).map((d) => d.s).join(", ");
  const titles = ["¿Qué quieres conseguir?", "Tu semana de entrenamiento", "Tu nutrición", "Tu seguimiento", "Tu plan Autopilot"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHead title="Diseña tu plan · Autopilot" description="Configura tu plan de entrenamiento y nutrición en un minuto." path="/onboarding" />
      <div className="max-w-xl w-full mx-auto px-5 py-8 flex-1">
        <div className="flex gap-1.5 mb-8">
          {titles.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`} />)}
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Paso {step + 1} de 5</p>
        <h1 className="text-2xl md:text-3xl font-bold font-display mt-1 mb-6">{titles[step]}</h1>

        {step === 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2">{MODE.map((m) => <Pill key={m.v} on={c.mode === m.v} sub={m.d} onClick={() => set("mode", m.v)}>{m.l}</Pill>)}</div>
            {c.mode === "pareja" && (
              <Input type="email" placeholder="Email de tu pareja de entreno" value={c.partner_email} onChange={(e) => set("partner_email", e.target.value)} />
            )}
            <div className="grid grid-cols-2 gap-2">{GOALS.map((g) => <Pill key={g.v} on={c.goal === g.v} onClick={() => set("goal", g.v)}>{g.l}</Pill>)}</div>
            <div>
              <p className="text-sm font-medium mb-2">¿Dónde entrenas?</p>
              <div className="grid grid-cols-3 gap-2">{FOCUS.map((f) => <Pill key={f.v} on={c.focus === f.v} onClick={() => set("focus", f.v)}>{f.l}</Pill>)}</div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">¿Qué días vas a entrenar? <span className="text-muted-foreground">(mínimo 2)</span></p>
              <div className="grid grid-cols-7 gap-1.5">
                {DOW.map((d) => {
                  const on = c.days.includes(d.v);
                  return (
                    <button key={d.v} type="button" aria-label={d.l} aria-pressed={on}
                      onClick={() => set("days", on ? c.days.filter((x) => x !== d.v) : [...c.days, d.v])}
                      className={`aspect-square rounded-xl border font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                      {d.s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Tiempo por sesión</p>
              <div className="grid grid-cols-3 gap-2">{DURATION.map((d) => <Pill key={d.v} on={c.minutes === d.v} onClick={() => set("minutes", d.v)}>{d.l}</Pill>)}</div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Estructura</p>
              <div className="grid grid-cols-2 gap-2">{STRUCTURE.map((s) => <Pill key={s.v} on={c.structure === s.v} onClick={() => set("structure", s.v)}>{s.l}</Pill>)}</div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">Comidas al día</p>
              <div className="grid grid-cols-4 gap-2">{[2, 3, 4, 5].map((n) => <Pill key={n} on={c.meals === n} onClick={() => set("meals", n)}>{n}</Pill>)}</div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">¿Te gusta cocinar?</p>
              <div className="grid gap-2">{COOKING.map((o) => <Pill key={o.v} on={c.cooking === o.v} sub={o.d} onClick={() => set("cooking", o.v)}>{o.l}</Pill>)}</div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">¿Algo que no quieras ver en tu plan? <span className="text-muted-foreground">(opcional)</span></p>
              <Input placeholder="Ej. pescado, avena…" value={c.avoid} onChange={(e) => set("avoid", e.target.value)} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Tu peso para calcular la nutrición <span className="text-muted-foreground">(opcional)</span></p>
              <Input type="number" inputMode="decimal" min="30" max="350" placeholder="Ej. 72 kg" value={c.weight} onChange={(e) => set("weight", e.target.value)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">¿Qué día prefieres tu revisión semanal?</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DOW.map((d) => (
                  <button key={d.v} type="button" aria-label={d.l} onClick={() => set("checkin_dow", d.v)}
                    className={`aspect-square rounded-xl border font-semibold ${c.checkin_dow === d.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                    {d.s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">¿A qué hora?</p>
              <select value={c.checkin_time} onChange={(e) => set("checkin_time", e.target.value)}
                className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm">
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">¿Cómo quieres que te acompañemos?</p>
              <div className="grid gap-2">{STYLE.map((s) => <Pill key={s.v} on={c.style === s.v} onClick={() => set("style", s.v)}>{s.l}</Pill>)}</div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase text-primary">Cuestionario completado</p>
              <p className="mt-1 text-sm text-muted-foreground">Esta muestra usa tus respuestas; el plan completo se genera al guardarlo.</p>
            </div>
            <PlanPreview focus={c.focus} goal={c.goal} weight={Number(c.weight) || undefined} days={c.days.length} registered={Boolean(user)} />
            <div className="rounded-xl border border-border bg-secondary/25 p-3 text-xs text-muted-foreground">
              <p><span className="font-semibold text-foreground">Tu semana:</span> {c.days.length} días ({dayNames}) · {label(DURATION, c.minutes)} · {label(STRUCTURE, c.structure)}.</p>
              <p className="mt-1"><span className="font-semibold text-foreground">Tu revisión:</span> {DOW.find((d) => d.v === c.checkin_dow)?.l} a las {c.checkin_time} · {label(STYLE, c.style)}.</p>
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked={accept} onCheckedChange={(v) => setAccept(!!v)} className="mt-0.5" />
              <span>Acepto los <Link to="/legal/terminos" className="underline">términos</Link>, la <Link to="/legal/privacidad" className="underline">privacidad</Link> y el tratamiento de mis datos de salud para preparar mi plan.</span>
            </label>
          </div>
        )}

        <div className="flex justify-between mt-8">
          <Button variant="ghost" onClick={() => (step === 0 ? navigate("/") : setStep((s) => s - 1))} disabled={saving}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!valid[step]}>
              Siguiente <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={save} disabled={!accept || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {user ? "Guardar mi plan" : "Guardar mi plan gratis"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Configurator;
