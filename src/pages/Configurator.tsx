import { generatePlanGuarded } from "@/lib/planShield";
import { clearConfiguratorDraft, readConfiguratorDraft, saveConfiguratorDraft } from "@/lib/configuratorDraft";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { hasCoaching } from "@/lib/entitlements";
import { logConsent } from "@/lib/consents";
import { track } from "@/lib/analytics";
import { hapticImpact, hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { ListGroup, ListRow } from "@/components/ui/list";
import Screen from "@/components/native/Screen";
import PageHead from "@/components/PageHead";
import PlanPreview from "@/components/PlanPreview";

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
  { v: "ppl", l: "Empuje / Tirón / Pierna" }, { v: "coach", l: "No lo sé, que Autopilot elija" },
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

/** Paso al que reanudar un borrador sin saltarse datos obligatorios. */
const draftResumeStep = (cfg: Cfg): number => {
  if (!cfg.goal || !cfg.focus || (cfg.mode !== "individual" && !/\S+@\S+\.\S+/.test(cfg.partner_email))) return 0;
  if (!Array.isArray(cfg.days) || cfg.days.length < 2) return 1;
  return 4;
};

type Option = { v: string | number; l: string; d?: string };

const Choices = ({ header, options, value, onChange }: {
  header?: string; options: Option[]; value: string | number; onChange: (v: string | number) => void;
}) => (
  <section>
    {header ? <h2 className="type-group-header px-4 pb-1.5">{header}</h2> : null}
    <div className="overflow-hidden rounded-2xl bg-card">
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button key={o.v} type="button" aria-pressed={on}
            onClick={() => { void hapticSelection(); onChange(o.v); }}
            className="group/row flex min-h-[56px] sm:min-h-[60px] w-full items-center gap-3 pl-4 sm:pl-5 text-left transition-colors duration-150 active:bg-accent">
            <span className="flex min-h-[56px] sm:min-h-[60px] min-w-0 flex-1 items-center gap-3 py-3 sm:py-3.5 pr-4 sm:pr-5 group-[:not(:last-child)]/row:sep-b">
              <span className="min-w-0 flex-1">
                <span className="block type-headline sm:text-[18px]">{o.l}</span>
                {o.d ? <span className="mt-0.5 block type-subhead sm:text-[15px] text-muted-foreground">{o.d}</span> : null}
              </span>
              <Check aria-hidden="true" strokeWidth={2.75}
                className={cn("h-5 w-5 shrink-0 text-primary", on ? "opacity-100" : "opacity-0")} />
            </span>
          </button>
        );
      })}
    </div>
  </section>
);

const DayPicker = ({ header, isOn, onToggle, pressed }: {
  header: string; isOn: (v: number) => boolean; onToggle: (v: number) => void; pressed: boolean;
}) => (
  <section>
    <h2 className="type-group-header px-4 pb-2">{header}</h2>
    <div className="grid grid-cols-7 gap-1">
      {DOW.map((d) => {
        const on = isOn(d.v);
        return (
          <button key={d.v} type="button" aria-label={d.l} aria-pressed={pressed ? on : undefined}
            onClick={() => { void hapticSelection(); onToggle(d.v); }}
            className={cn("mx-auto flex aspect-square w-full min-w-[44px] max-w-[52px] items-center justify-center rounded-full type-headline transition-colors active:opacity-70",
              on ? "bg-primary/15 text-primary" : "bg-card")}>
            {d.s}
          </button>
        );
      })}
    </div>
  </section>
);

const Field = ({ header, children }: { header: string; children: React.ReactNode }) => (
  <section>
    <h2 className="type-group-header px-4 pb-1.5">{header}</h2>
    {children}
  </section>
);

const Configurator = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [c, setC] = useState<Cfg>(initial);
  const [accept, setAccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setC((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const draft = readConfiguratorDraft<Partial<Cfg>>();
    if (!draft) return;
    const merged: Cfg = { ...initial, ...draft.data };
    // Si el borrador no tiene lo imprescindible (versión antigua o incompleto),
    // no saltamos al último paso: se empieza por el primero que falte.
    setC(merged);
    setStep(draftResumeStep(merged));
    setRestoredDraft(true);
  }, []);

  const restart = () => {
    void hapticTap();
    clearConfiguratorDraft();
    setC(initial);
    setAccept(false);
    setStep(0);
    setRestoredDraft(false);
  };

  const valid = [
    !!c.goal && !!c.focus && (c.mode === "individual" || /\S+@\S+\.\S+/.test(c.partner_email)),
    c.days.length >= 2,
    true,
    true,
    accept,
  ];

  /**
   * El toast genérico ocultaba la causa real del fallo del upsert. Además de
   * registrarla en consola, se muestra el código y el mensaje del servidor para
   * poder diagnosticarlo sin abrir las herramientas del navegador. Si el fallo
   * es de sesión, se manda a iniciar sesión de nuevo en vez de dejar al usuario
   * en un callejón sin salida.
   */
  const reportSaveError = async (error: { message?: string; code?: string; details?: string; hint?: string }) => {
    console.error("[configurator] no se pudo guardar el onboarding", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      user_id: user?.id ?? null,
    });

    // 23503 en onboarding_user_id_fkey = el JWT es válido pero la cuenta ya no
    // existe en auth.users (sesión fantasma: la cuenta se borró o se reseteó el
    // proyecto mientras esta pestaña conservaba el token). Ni reintentar ni
    // recargar lo arreglan: hay que volver a crear la cuenta.
    const ghostSession =
      error.code === "23503" && /user_id_fkey/i.test(`${error.details ?? ""} ${error.message ?? ""}`);
    if (ghostSession) {
      toast.error("Tu cuenta ya no existe en el servidor (sesión antigua). Crea la cuenta de nuevo; tus respuestas se conservan.", { duration: 12000 });
      try {
        await signOut();
      } catch {
        // Si el cierre de sesión remoto falla, la navegación al alta sigue igualmente.
      }
      // Después del signOut (que limpia borradores): conservamos las respuestas.
      saveConfiguratorDraft(c);
      navigate("/signup?from=quiz&next=/onboarding", { replace: true });
      return;
    }

    const authProblem =
      error.code === "PGRST301" ||
      /jwt|expired|not authenticated|sesión/i.test(error.message ?? "");
    if (authProblem) {
      toast.error("Tu sesión ha caducado. Vuelve a iniciar sesión y guarda el plan.", { duration: 10000 });
      navigate(`/login?next=${encodeURIComponent("/onboarding")}`);
      return;
    }
    const code = error.code ? ` (${error.code})` : "";
    toast.error(`No se pudo guardar${code}. Inténtalo de nuevo.`, {
      description: error.message,
      duration: 10000,
    });
  };

  const save = async () => {
    if (!user) {
      saveConfiguratorDraft(c);
      track("onboarding_complete", { paid: false, anonymous: true });
      navigate("/signup?from=quiz");
      return;
    }
    // Una sesión sin correo confirmado nunca entra al panel: primero se verifica.
    if (!user.email_confirmed_at) {
      saveConfiguratorDraft(c);
      navigate("/verify-email");
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
    if (error) { setSaving(false); void reportSaveError(error); return; }
    clearConfiguratorDraft();
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
      const { data: g, error: ge } = await generatePlanGuarded(supabase, { user_id: user.id }, { userId: user.id });
      if (ge || (!g?.success && !g?.protected)) toast.error("Tu configuración está guardada; la rutina se preparará en breve.");
    }
    track("onboarding_complete", { paid: hasCoaching(profile) });
    navigate("/dashboard");
  };

  const dayNames = DOW.filter((d) => c.days.includes(d.v)).map((d) => d.s).join(", ");
  const duo = c.mode === "pareja";
  const t = (solo: string, pair: string) => (duo ? pair : solo);
  const titles = [
    t("¿Qué quieres conseguir?", "¿Qué queréis conseguir?"),
    t("Tu semana", "Vuestra semana juntos"),
    t("Tu nutrición", "Vuestras comidas"),
    t("Tu revisión semanal", "Vuestra revisión semanal"),
    t("Tu plan Autopilot", "Vuestro plan conjunto"),
  ];
  const leads = [
    t("Cuéntanos tu objetivo y dónde entrenas.", "Un mismo calendario, con cargas adaptadas a cada uno."),
    t("Elige al menos dos días. Ajustamos el plan a tu semana.", "Elegid al menos dos días que os vengan bien a los dos."),
    t("Para que las comidas encajen con tu día.", "Recetas sencillas que os gusten a los dos."),
    t("Un momento a la semana para ajustar tu plan.", "Un momento a la semana para ajustar el plan de ambos."),
    user
      ? t("Así queda con tus respuestas. Confirma para guardar tu plan completo.", "Así queda vuestro plan. Confirma para guardarlo.")
      : t("Así queda con tus respuestas. Crea tu cuenta para guardar tu plan completo.", "Así queda vuestro plan. Crea tu cuenta para guardarlo."),
  ];
  const last = titles.length - 1;
  const goBack = () => { if (saving) return; if (step === 0) navigate("/"); else setStep((s) => s - 1); };

  const footer = (
    <div className="pb-2">
      {step < last ? (
        <Button variant="hero" size="lg" className="w-full" onClick={() => { void hapticTap(); setStep((s) => s + 1); }} disabled={!valid[step]}>
          Continuar
        </Button>
      ) : (
        <Button variant="hero" size="lg" className="w-full" onClick={() => { void hapticImpact(); void save(); }} disabled={!accept || saving}>
          {saving && <Spinner size="sm" className="mr-2 text-primary-foreground" label="Guardando" />}
          {user ? "Guardar mi plan" : "Guardar mi plan gratis"}
        </Button>
      )}
    </div>
  );

  return (
    <Screen title={`${step + 1} de ${titles.length}`} onBack={goBack} maxWidth="md" contentClassName="pt-2 sm:pt-4" footer={footer}>
      <PageHead title="Diseña tu plan · Autopilot" description="Configura tu plan de entrenamiento y nutrición en un minuto." path="/onboarding" />
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={1} aria-valuemax={titles.length} aria-valuenow={step + 1}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-ios" style={{ width: `${((step + 1) / titles.length) * 100}%` }} />
      </div>
      {restoredDraft ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-2">
          <p className="type-footnote text-muted-foreground">Hemos recuperado tus respuestas anteriores.</p>
          <Button type="button" variant="plain" size="sm" className="h-9 shrink-0 px-3" onClick={restart}>
            Empezar de nuevo
          </Button>
        </div>
      ) : null}
      <h1 className="mt-6 sm:mt-8 type-title1 sm:text-[34px] sm:leading-[40px]">{titles[step]}</h1>
      <p className="mt-2 type-subhead sm:text-[17px] sm:leading-[24px] text-muted-foreground">{leads[step]}</p>

      <div className="mt-8 space-y-8 pb-4">
        {step === 0 && (
          <>
            <Choices options={MODE} value={c.mode} onChange={(v) => set("mode", String(v))} />
            {c.mode === "pareja" && (
              <Field header="Tu pareja de entreno">
                <Input type="email" inputMode="email" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done" aria-label="Email de tu pareja de entreno" placeholder="Email de tu pareja de entreno" value={c.partner_email} onChange={(e) => set("partner_email", e.target.value)} />
              </Field>
            )}
            <Choices header="Objetivo" options={GOALS} value={c.goal} onChange={(v) => set("goal", String(v))} />
            <Choices header="¿Dónde entrenas?" options={FOCUS} value={c.focus} onChange={(v) => set("focus", String(v))} />
          </>
        )}

        {step === 1 && (
          <>
            <DayPicker header="¿Qué días vas a entrenar?" pressed isOn={(v) => c.days.includes(v)}
              onToggle={(v) => set("days", c.days.includes(v) ? c.days.filter((x) => x !== v) : [...c.days, v])} />
            <Choices header="Tiempo por sesión" options={DURATION} value={c.minutes} onChange={(v) => set("minutes", Number(v))} />
            <Choices header="Estructura" options={STRUCTURE} value={c.structure} onChange={(v) => set("structure", String(v))} />
          </>
        )}

        {step === 2 && (
          <>
            <Choices header="Comidas al día" options={[2, 3, 4, 5].map((n) => ({ v: n, l: `${n} comidas` }))} value={c.meals} onChange={(v) => set("meals", Number(v))} />
            <Choices header="¿Te gusta cocinar?" options={COOKING} value={c.cooking} onChange={(v) => set("cooking", String(v))} />
            <Field header="¿Algo que no quieras ver? (opcional)">
              <Input autoComplete="off" enterKeyHint="next" aria-label="Alimentos que no quieres ver" placeholder="Ej. pescado, avena…" value={c.avoid} onChange={(e) => set("avoid", e.target.value)} />
            </Field>
            <Field header="Tu peso en kg (opcional)">
              <Input type="number" inputMode="decimal" enterKeyHint="done" min="30" max="350" aria-label="Tu peso en kg" placeholder="Ej. 72 kg" value={c.weight} onChange={(e) => set("weight", e.target.value)} />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <DayPicker header="Día de tu revisión semanal" pressed={false} isOn={(v) => c.checkin_dow === v} onToggle={(v) => set("checkin_dow", v)} />
            <Field header="¿A qué hora?">
              <select aria-label="Hora de la revisión" value={c.checkin_time} onChange={(e) => set("checkin_time", e.target.value)} className="field w-full">
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Choices header="¿Cómo quieres que te acompañemos?" options={STYLE} value={c.style} onChange={(v) => set("style", String(v))} />
          </>
        )}

        {step === 4 && (
          <>
            <PlanPreview focus={c.focus} goal={c.goal} weight={Number(c.weight) || undefined} days={c.days.length} registered={Boolean(user)} hideHeader />
            <ListGroup header="Tu semana">
              <ListRow title="Días" value={`${c.days.length} · ${dayNames}`} />
              <ListRow title="Sesión" value={label(DURATION, c.minutes)} />
              <ListRow title="Estructura" value={label(STRUCTURE, c.structure)} />
              <ListRow title="Revisión" value={`${DOW.find((d) => d.v === c.checkin_dow)?.l} a las ${c.checkin_time}`} />
              <ListRow title="Estilo" value={label(STYLE, c.style)} />
            </ListGroup>
            <label className="flex min-h-[44px] items-start gap-3 px-4 type-footnote text-muted-foreground">
              <Checkbox checked={accept} onCheckedChange={(v) => { void hapticSelection(); setAccept(!!v); }} className="mt-0.5" />
              <span>Acepto los <Link to="/legal/terminos" className="text-primary">términos</Link>, la <Link to="/legal/privacidad" className="text-primary">privacidad</Link> y el tratamiento de mis datos de salud para preparar mi plan.</span>
            </label>
          </>
        )}
      </div>
    </Screen>
  );
};

export default Configurator;
