import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { hasCoaching } from "@/lib/entitlements";
import { logConsent } from "@/lib/consents";
import { track } from "@/lib/analytics";
import { hapticTap } from "@/lib/native";
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
  { v: "pareja", l: "En pareja", d: "Entrenáis juntos con un plan para los dos" },
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

const label = (arr: { v: string | number; l: string }[], v: string | number) => arr.find((x) => x.v === v)?.l ?? "—";

const Pill = ({ on, onClick, children, sub }: { on: boolean; onClick: () => void; children: React.ReactNode; sub?: string }) => (
  <button type="button" onClick={() => { void hapticTap(); onClick(); }} aria-pressed={on}
    className={`text-left rounded-2xl px-4 py-3.5 transition-colors active:opacity-70 ${on ? "bg-primary/10 ring-2 ring-inset ring-primary" : "bg-secondary"}`}>
    <div className="font-semibold text-[15px] tracking-[-0.01em]">{children}</div>
    {sub && <div className="text-[13px] leading-snug text-muted-foreground mt-0.5">{sub}</div>}
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
    } catch { /* Best-effort browser feature; the primary flow remains available. */ }
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
      try { localStorage.setItem(KEY, JSON.stringify({ data: c, createdAt: Date.now() })); } catch { /* Best-effort browser feature; the primary flow remains available. */ }
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
    try { localStorage.removeItem(KEY); } catch { /* Best-effort browser feature; the primary flow remains available. */ }
    try {
      await Promise.all([
        logConsent("terms", true, { source: "configurator" }),
        logConsent("privacy", true, { source: "configurator" }),
        logConsent("health_data", true, { source: "configurator" }),
      ]);
    } catch { /* Best-effort browser feature; the primary flow remains available. */ }
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
  const titles = ["¿Qué quieres conseguir?", "Horarios y disponibilidad", "Tu nutrición", "Tu seguimiento", "Tu plan Autopilot"];

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <PageHead title="Diseña tu plan · Autopilot" description="Configura tu plan de entrenamiento y nutrición en un minuto." path="/onboarding" />
      <div className="max-w-xl w-full mx-auto px-4 pb-8 pt-3 flex-1">
        <div className="flex h-11 items-center justify-between">
          <button
            type="button"
            onClick={() => { void hapticTap(); if (step === 0) navigate("/"); else setStep((s) => s - 1); }}
            disabled={saving}
            aria-label="Atrás"
            className="-ml-2 inline-flex h-10 items-center gap-0.5 rounded-full pl-1 pr-2.5 text-foreground/85 transition-colors active:bg-secondary/60"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-[15px] font-medium">Atrás</span>
          </button>
          <span className="text-[13px] font-medium tabular-nums text-muted-foreground">{step + 1} de {titles.length}</span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={1} aria-valuemax={titles.length} aria-valuenow={step + 1}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${((step + 1) / titles.length) * 100}%` }} />
        </div>
        <h1 className="mt-8 mb-8 text-[28px] font-bold font-display tracking-[-0.03em] leading-[1.1]">{titles[step]}</h1>

        {step === 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2">{MODE.map((m) => <Pill key={m.v} on={c.mode === m.v} sub={m.d} onClick={() => set("mode", m.v)}>{m.l}</Pill>)}</div>
            {c.mode === "pareja" && (
              <Input type="email" placeholder="Email de tu pareja de entreno" value={c.partner_email} onChange={(e) => set("partner_email", e.target.value)} className="h-12 border-0 bg-secondary text-[16px]" />
            )}
            <div className="grid grid-cols-2 gap-2">{GOALS.map((g) => <Pill key={g.v} on={c.goal === g.v} onClick={() => set("goal", g.v)}>{g.l}</Pill>)}</div>
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">¿Dónde entrenas?</p>
              <div className="grid grid-cols-3 gap-2">{FOCUS.map((f) => <Pill key={f.v} on={c.focus === f.v} onClick={() => set("focus", f.v)}>{f.l}</Pill>)}</div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">¿Qué días vas a entrenar? <span className="normal-case tracking-normal">(mínimo 2)</span></p>
              <div className="grid grid-cols-7 gap-1.5">
                {DOW.map((d) => {
                  const on = c.days.includes(d.v);
                  return (
                    <button key={d.v} type="button" aria-label={d.l} aria-pressed={on}
                      onClick={() => { void hapticTap(); set("days", on ? c.days.filter((x) => x !== d.v) : [...c.days, d.v]); }}
                      className={`aspect-square rounded-full text-[15px] font-semibold transition-colors active:opacity-70 ${on ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                      {d.s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">Tiempo por sesión</p>
              <div className="grid grid-cols-3 gap-2">{DURATION.map((d) => <Pill key={d.v} on={c.minutes === d.v} onClick={() => set("minutes", d.v)}>{d.l}</Pill>)}</div>
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">Estructura</p>
              <div className="grid grid-cols-2 gap-2">{STRUCTURE.map((s) => <Pill key={s.v} on={c.structure === s.v} onClick={() => set("structure", s.v)}>{s.l}</Pill>)}</div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">Comidas al día</p>
              <div className="grid grid-cols-4 gap-2">{[2, 3, 4, 5].map((n) => <Pill key={n} on={c.meals === n} onClick={() => set("meals", n)}>{n}</Pill>)}</div>
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">¿Te gusta cocinar?</p>
              <div className="grid gap-2">{COOKING.map((o) => <Pill key={o.v} on={c.cooking === o.v} sub={o.d} onClick={() => set("cooking", o.v)}>{o.l}</Pill>)}</div>
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">¿Algo que no quieras ver en tu plan? <span className="normal-case tracking-normal">(opcional)</span></p>
              <Input placeholder="Ej. pescado, avena…" value={c.avoid} onChange={(e) => set("avoid", e.target.value)} className="h-12 border-0 bg-secondary text-[16px]" />
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">Tu peso para calcular la nutrición <span className="normal-case tracking-normal">(opcional)</span></p>
              <Input type="number" inputMode="decimal" min="30" max="350" placeholder="Ej. 72 kg" value={c.weight} onChange={(e) => set("weight", e.target.value)} className="h-12 border-0 bg-secondary text-[16px]" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">¿Qué día prefieres tu revisión semanal?</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DOW.map((d) => (
                  <button key={d.v} type="button" aria-label={d.l} onClick={() => { void hapticTap(); set("checkin_dow", d.v); }}
                    className={`aspect-square rounded-full text-[15px] font-semibold transition-colors active:opacity-70 ${c.checkin_dow === d.v ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {d.s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">¿A qué hora?</p>
              <select value={c.checkin_time} onChange={(e) => set("checkin_time", e.target.value)}
                className="w-full h-12 rounded-xl border-0 bg-secondary px-3 text-[16px]">
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground mb-2 pl-1">¿Cómo quieres que te acompañemos?</p>
              <div className="grid gap-2">{STYLE.map((s) => <Pill key={s.v} on={c.style === s.v} onClick={() => set("style", s.v)}>{s.l}</Pill>)}</div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-primary">Cuestionario completado</p>
              <p className="mt-1 text-[15px] text-muted-foreground">Esta muestra usa tus respuestas; el plan completo se genera al guardarlo.</p>
            </div>
            <PlanPreview focus={c.focus} goal={c.goal} weight={Number(c.weight) || undefined} days={c.days.length} registered={Boolean(user)} />
            <div className="rounded-2xl bg-secondary p-4 text-[13px] leading-relaxed text-muted-foreground">
              <p><span className="font-semibold text-foreground">Horarios:</span> {c.days.length} días ({dayNames}) · {label(DURATION, c.minutes)} · {label(STRUCTURE, c.structure)}.</p>
              <p className="mt-1"><span className="font-semibold text-foreground">Tu revisión:</span> {DOW.find((d) => d.v === c.checkin_dow)?.l} a las {c.checkin_time} · {label(STYLE, c.style)}.</p>
            </div>
            <label className="flex items-start gap-3 text-[13px] leading-snug text-muted-foreground">
              <Checkbox checked={accept} onCheckedChange={(v) => setAccept(!!v)} className="mt-0.5" />
              <span>Acepto los <Link to="/legal/terminos" className="underline">términos</Link>, la <Link to="/legal/privacidad" className="underline">privacidad</Link> y el tratamiento de mis datos de salud para preparar mi plan.</span>
            </label>
          </div>
        )}

        <div className="mt-10">
          {step < 4 ? (
            <Button variant="hero" size="lg" className="h-[52px] w-full text-[17px] font-semibold tracking-[-0.015em]" onClick={() => { void hapticTap(); setStep((s) => s + 1); }} disabled={!valid[step]}>
              Continuar
            </Button>
          ) : (
            <Button variant="hero" size="lg" className="h-[52px] w-full text-[17px] font-semibold tracking-[-0.015em]" onClick={() => { void hapticTap(); void save(); }} disabled={!accept || saving}>
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
