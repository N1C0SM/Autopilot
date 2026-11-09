import { generatePlanGuarded } from "@/shared/lib/planShield";
import { clearConfiguratorDraft, readConfiguratorDraft, saveConfiguratorDraft } from "@/shared/lib/configuratorDraft";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { ArrowRight, CalendarDays, Check, Columns2, Dumbbell, Flame, HeartPulse, Moon, RefreshCw, Rows3, Smartphone, Sun, Target, User, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { useAuth } from "@/shared/contexts/AuthContext";
import { supabase } from "@/shared/integrations/supabase/client";
import { hasCoaching } from "@/shared/lib/entitlements";
import { logConsent } from "@/shared/lib/consents";
import { track } from "@/shared/lib/analytics";
import { hapticImpact, hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { Spinner } from "@/shared/components/ui/spinner";
import Screen from "@/shared/components/native/Screen";
import PageHead from "@/web/components/PageHead";
import PlanPreview from "@/app/components/PlanPreview";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";
import { setWorkoutLayout, type WorkoutLayout } from "@/shared/lib/workoutPreferences";

const DOW = [
  { v: 1, s: "L", l: "Lunes" }, { v: 2, s: "M", l: "Martes" }, { v: 3, s: "X", l: "Miércoles" },
  { v: 4, s: "J", l: "Jueves" }, { v: 5, s: "V", l: "Viernes" }, { v: 6, s: "S", l: "Sábado" }, { v: 0, s: "D", l: "Domingo" },
];
const GOALS = [
  { v: "lose_weight", l: "Perder grasa", icon: Flame }, { v: "gain_muscle", l: "Ganar músculo", icon: Dumbbell },
  { v: "recomp", l: "Recomposición", icon: RefreshCw }, { v: "general_health", l: "Fuerza y salud", icon: HeartPulse },
];
const FOCUS = [
  { v: "gimnasio", l: "Gimnasio", photo: BRAND_PHOTOS.gym },
  { v: "calistenia", l: "Calistenia", photo: BRAND_PHOTOS.pullupBar },
  { v: "mixto", l: "Mixto", photo: BRAND_PHOTOS.dumbbells },
];
const DURATION = [{ v: 40, l: "30–45 min" }, { v: 55, l: "45–60 min" }, { v: 75, l: "60–90 min" }];
const STRUCTURE = [
  { v: "full_body", l: "Full Body" }, { v: "torso_pierna", l: "Torso / Pierna" },
  { v: "ppl", l: "Empuje / Tirón / Pierna" }, { v: "coach", l: "No lo sé, que Autopilot elija" },
];
const STYLE = [
  { v: "direct", l: "Directo y exigente" }, { v: "flexible", l: "Flexible y realista" }, { v: "technical", l: "Técnico y analítico" },
];
// Filas de una línea, iguales que «Perder grasa» / «Ganar músculo».
const MODE = [{ v: "individual", l: "Individual", icon: User }, { v: "pareja", l: "En pareja", icon: Users }];
const TIMES = Array.from({ length: 32 }, (_, i) => {
  const m = 7 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
});

type Cfg = {
  mode: string; partner_email: string; goal: string; focus: string; days: number[]; minutes: number; structure: string;
  meals: number; avoid: string; likes: string[]; dislikes: string[]; cooking: string; weight: string; checkin_dow: number; checkin_time: string; style: string;
  appearance: "system" | "light" | "dark"; workoutLayout: WorkoutLayout;
};
const initial: Cfg = {
  mode: "individual", partner_email: "", goal: "", focus: "", days: [], minutes: 55, structure: "coach",
  meals: 3, avoid: "", likes: [], dislikes: [], cooking: "normal", weight: "", checkin_dow: 0, checkin_time: "19:30", style: "flexible",
  appearance: "system", workoutLayout: "rows",
};

const label = (arr: { v: string | number; l: string }[], v: string | number) => arr.find((x) => x.v === v)?.l ?? "—";
/** Lo que de verdad trae el plan gratuito: rutina, progresión, nutrición básica y progreso. */
const PLAN_INCLUDES = ["Rutina de entrenamiento personalizada", "Progresión de cargas", "Recomendaciones de nutrición", "Seguimiento de tu progreso"];

/** Paso al que reanudar un borrador sin saltarse datos obligatorios. */
const draftResumeStep = (cfg: Cfg): number => {
  if (!cfg.goal || !cfg.focus || (cfg.mode !== "individual" && !/\S+@\S+\.\S+/.test(cfg.partner_email))) return 0;
  if (!Array.isArray(cfg.days) || cfg.days.length < 2) return 1;
  return 2;
};

type Option = { v: string | number; l: string; d?: string; icon?: LucideIcon };

/** Círculo de selección del rediseño: anillo vacío o dorado con check. */
const SelectMark = ({ on }: { on: boolean }) => (
  <span aria-hidden="true" className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors", on ? "bg-primary text-primary-foreground" : "border-2 border-foreground/25")}>
    {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
  </span>
);

/** Opciones con foto, como las fichas de material de la landing: misma identidad dentro y fuera. */
const PhotoChoices = ({ header, options, value, onChange }: {
  header: string; options: { v: string; l: string; photo: string }[]; value: string; onChange: (v: string) => void;
}) => (
  <section>
    <h2 className="px-1 pb-2.5 type-headline">{header}</h2>
    <div className="grid grid-cols-3 gap-2.5">
      {options.map((o) => {
        const on = o.v === value;
        return <button key={o.v} type="button" aria-pressed={on} onClick={() => { void hapticSelection(); onChange(o.v); }}
          className={cn("relative flex aspect-[4/5] items-end overflow-hidden rounded-media bg-card p-3 text-left ring-2 transition-[transform,box-shadow] duration-200 ease-out active:scale-[0.97]", on ? "ring-primary" : "ring-border")}>
          <img src={o.photo} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_35%]" />
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
          <span className="relative type-headline text-white">{o.l}</span>
          <span className="absolute right-2 top-2"><SelectMark on={on} /></span>
        </button>;
      })}
    </div>
  </section>
);

const Choices = ({ header, options, value, onChange, columns = false, stackOnMobile = false, iconTiles = false }: {
  header?: string; options: Option[]; value: string | number; onChange: (v: string | number) => void;
  /** Dos opciones lado a lado (Individual / En pareja), como la maqueta. */
  columns?: boolean;
  stackOnMobile?: boolean;
  iconTiles?: boolean;
}) => (
  <section>
    {header ? <h2 className="px-1 pb-2.5 type-headline">{header}</h2> : null}
    {/* Cada opción en su tarjeta: icono, texto y círculo de selección; la elegida con borde dorado. */}
    <div className={columns ? stackOnMobile ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2" : "grid grid-cols-2 gap-2.5" : "space-y-2.5"}>
      {options.map((o) => {
        const on = o.v === value;
        const Icon = o.icon;
        return (
          <button key={o.v} type="button" aria-pressed={on}
            onClick={() => { void hapticSelection(); onChange(o.v); }}
            className={cn(
              "flex min-h-[56px] sm:min-h-[60px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-[transform,background-color,border-color] duration-150 active:scale-[0.985]",
              on ? "border-primary bg-primary/[0.08]" : "border-border bg-card",
            )}>
            {Icon ? iconTiles ? (
              <span aria-hidden="true" className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-chip", on ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                <Icon className="h-6 w-6" strokeWidth={2} />
              </span>
            ) : (
              <Icon aria-hidden="true" className={cn("h-5 w-5 shrink-0", on ? "text-primary" : "text-muted-foreground")} strokeWidth={1.9} />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block type-headline sm:text-[18px]">{o.l}</span>
              {o.d ? <span className="mt-0.5 block type-subhead sm:text-[15px] text-muted-foreground">{o.d}</span> : null}
            </span>
            <SelectMark on={on} />
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
  const { setTheme } = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [c, setC] = useState<Cfg>(initial);
  const [accept, setAccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setC((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const draft = readConfiguratorDraft<Partial<Cfg>>();
    if (!draft) return;
    const merged: Cfg = { ...initial, ...draft.data };
    if (merged.appearance !== "system" && merged.appearance !== "light" && merged.appearance !== "dark") merged.appearance = initial.appearance;
    if (merged.workoutLayout !== "rows" && merged.workoutLayout !== "columns") merged.workoutLayout = initial.workoutLayout;
    // Si el borrador no tiene lo imprescindible (versión antigua o incompleto),
    // no saltamos al último paso: se empieza por el primero que falte.
    setC(merged);
    setStep(draftResumeStep(merged));
    setRestoredDraft(true);
  }, []);

  useEffect(() => {
    setTheme(c.appearance);
  }, [c.appearance, setTheme]);

  // Tras verificar el correo con el cuestionario ya completo (`?guardar=1`),
  // no se reenseña el último paso: se guarda y se entra directo al plan.
  const [searchParams] = useSearchParams();
  const autoSave = searchParams.get("guardar") === "1";
  const autoSaveTried = useRef(false);
  useEffect(() => {
    if (!autoSave || autoSaveTried.current || !restoredDraft || !user) return;
    autoSaveTried.current = true;
    if (draftResumeStep(c) === titles.length - 1) void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, restoredDraft, user]);

  const restart = () => {
    void hapticTap();
    clearConfiguratorDraft();
    setC(initial);
    setAccept(false);
    setShowValidation(false);
    setStep(0);
    setRestoredDraft(false);
  };

  const valid = [
    !!c.goal && !!c.focus && (c.mode === "individual" || /\S+@\S+\.\S+/.test(c.partner_email)),
    c.days.length >= 2,
    accept,
  ];
  const validationMessage = (() => {
    if (!showValidation) return null;
    if (step === 0) {
      const missing = [];
      if (!c.goal) missing.push("Elige un objetivo");
      if (!c.focus) missing.push("Indica dónde entrenas");
      if (c.mode === "pareja" && !/\S+@\S+\.\S+/.test(c.partner_email)) missing.push("Añade un email válido de tu pareja");
      return missing.length ? `${missing.join(". ")}.` : null;
    }
    if (step === 1) return c.days.length < 2 ? "Selecciona al menos 2 días para continuar." : null;
    return accept ? null : "Marca la casilla de términos y condiciones para guardar tu plan.";
  })();

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
    if (!accept) { setShowValidation(true); return; }
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
    const { error } = await supabase.from("onboarding").upsert({
      user_id: user.id,
      goal: c.goal,
      primary_focus: c.focus,
      equipment_type: c.focus === "gimnasio" ? "Gimnasio" : c.focus === "calistenia" ? "Calistenia" : "Mixto",
      intensity_level: 7,
      // Las comidas son de Plus: se preguntan en Nutrición al tener Plus, no aquí.
      // Acepta «72,5» y nunca borra un peso ya guardado si el campo se deja vacío.
      ...(Number(String(c.weight).replace(",", ".")) > 30 ? { weight: Number(String(c.weight).replace(",", ".")) } : {}),
      availability: {
        days: String(c.days.length), hours: String(+(c.minutes / 60).toFixed(2)),
        training_days: c.days, session_minutes: c.minutes, structure: c.structure,
        checkin_dow: c.checkin_dow, checkin_time: c.checkin_time, coach_style: c.style,
        training_mode: c.mode, partner_email: c.mode === "pareja" ? c.partner_email : null,
      },
    }, { onConflict: "user_id" });
    if (error) { setSaving(false); void reportSaveError(error); return; }
    setWorkoutLayout(user.id, c.workoutLayout);
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
    t("Tu plan Autopilot", "Vuestro plan conjunto"),
  ];
  const leads = [
    t("Cuéntanos tu objetivo y dónde entrenas.", "Un mismo calendario, con cargas adaptadas a cada uno."),
    t("Elige al menos dos días. Ajustamos el plan a tu semana.", "Elegid al menos dos días que os vengan bien a los dos."),
    user
      ? t("Así queda con tus respuestas. Confirma para guardar tu plan completo.", "Así queda vuestro plan. Confirma para guardarlo.")
      : t("Así queda con tus respuestas. Crea tu cuenta para guardar tu plan completo.", "Así queda vuestro plan. Crea tu cuenta para guardarlo."),
  ];
  const last = titles.length - 1;
  const goBack = () => { if (saving) return; if (step === 0) navigate("/"); else setStep((s) => s - 1); };

  const footer = (
    <div className="pb-2">
      {validationMessage ? <p role="alert" className="mb-2 rounded-card bg-background px-3 py-2 text-center type-footnote text-destructive">{validationMessage}</p> : null}
      {step < last ? (
        <Button variant="hero" size="lg" className="w-full" onClick={() => {
          void hapticTap();
          if (!valid[step]) { setShowValidation(true); return; }
          setShowValidation(false);
          setStep((s) => s + 1);
        }}>
          Continuar
        </Button>
      ) : (
        <Button variant="hero" size="lg" className="w-full" onClick={() => {
          void hapticImpact();
          if (!accept) { setShowValidation(true); return; }
          setShowValidation(false);
          void save();
        }} disabled={saving}>
          {saving && <Spinner size="sm" className="mr-2 text-primary-foreground" label="Guardando" />}
          {user ? "Guardar mi plan" : "Guardar mi plan gratis"}
          {!saving && <ArrowRight className="ml-1 h-5 w-5" aria-hidden="true" />}
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
        <div className="mt-3 flex items-center justify-between gap-3 rounded-media bg-card px-4 py-2">
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
            <Choices header="¿Cómo vas a entrenar?" columns options={MODE} value={c.mode} onChange={(v) => set("mode", String(v))} />
            {c.mode === "pareja" && (
              <Field header="Tu pareja de entreno">
                <Input type="email" inputMode="email" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done" aria-label="Email de tu pareja de entreno" placeholder="Email de tu pareja de entreno" value={c.partner_email} onChange={(e) => set("partner_email", e.target.value)} />
              </Field>
            )}
            <Choices header={t("¿Cuál es tu objetivo principal?", "¿Cuál es vuestro objetivo principal?")} options={GOALS} value={c.goal} onChange={(v) => set("goal", String(v))} />
            <PhotoChoices header={t("¿Dónde entrenas habitualmente?", "¿Dónde entrenáis habitualmente?")} options={FOCUS} value={c.focus} onChange={(v) => set("focus", v)} />
          </>
        )}

        {step === 1 && (
          <>
            <DayPicker header={t("¿Qué días vas a entrenar?", "¿Qué días entrenáis juntos?")} pressed isOn={(v) => c.days.includes(v)}
              onToggle={(v) => set("days", c.days.includes(v) ? c.days.filter((x) => x !== v) : [...c.days, v])} />
            <Choices header="Tiempo por sesión" options={DURATION} value={c.minutes} onChange={(v) => set("minutes", Number(v))} />
            <Choices header="Estructura" options={STRUCTURE} value={c.structure} onChange={(v) => set("structure", String(v))} />
            <Field header="Tu peso en kg (opcional)">
              <Input type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" aria-label="Tu peso en kg" placeholder="Ej. 72 kg" value={c.weight} onChange={(e) => set("weight", e.target.value.replace(/[^\d.,]/g, ""))} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Choices header="Apariencia" columns stackOnMobile options={[
              { v: "system", l: "Según el sistema", d: "Sigue el modo del dispositivo", icon: Smartphone },
              { v: "light", l: "Claro", d: "Fondo claro siempre", icon: Sun },
              { v: "dark", l: "Oscuro", d: "Fondo oscuro siempre", icon: Moon },
            ]} value={c.appearance} onChange={(v) => {
              const appearance = v === "light" || v === "dark" ? v : "system";
              set("appearance", appearance);
              setTheme(appearance);
            }} />
            <Choices header="¿Cómo quieres ver los ejercicios?" columns stackOnMobile iconTiles options={[
              { v: "rows", l: "Una columna", d: "Un ejercicio a lo ancho, en cada fila.", icon: Rows3 },
              { v: "columns", l: "Dos columnas", d: "Dos ejercicios lado a lado, en cada fila.", icon: Columns2 },
            ]} value={c.workoutLayout} onChange={(v) => set("workoutLayout", v === "columns" ? "columns" : "rows")} />
            {/* Resumen en filas con icono y lo que incluye el plan (diseño ChatGPT). */}
            <section className="overflow-hidden rounded-card bg-card animate-fade-in" aria-label={`Días de entreno: ${dayNames}`}>
              {[
                { icon: Target, k: "Objetivo", v: label(GOALS, c.goal) },
                { icon: Dumbbell, k: "Tipo de entrenamiento", v: label(FOCUS, c.focus) },
                { icon: duo ? Users : User, k: "Modalidad", v: label(MODE, c.mode) },
                { icon: CalendarDays, k: t("Tu semana", "Vuestra semana"), v: `${c.days.length} días (${dayNames}) · ${label(DURATION, c.minutes)}` },
              ].map((row, i) => (
                <div key={row.k} className={cn("flex items-center gap-4 px-5 py-3.5", i > 0 && "border-t border-border")}>
                  <row.icon className="h-6 w-6 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="type-footnote text-muted-foreground">{row.k}</p>
                    <p className="type-headline">{row.v}</p>
                  </div>
                </div>
              ))}
            </section>
            <p className="-mt-4 px-1 type-footnote text-muted-foreground">
              {c.structure === "coach"
                ? `Distribución: Autopilot elige la mejor para ${c.days.length} días.`
                : `Distribución: ${label(STRUCTURE, c.structure)}.`}
              {duo ? " Mismo calendario, cargas adaptadas a cada uno." : ""}
            </p>
            <section>
              <h2 className="px-1 type-headline">{t("Tu plan incluirá", "Vuestro plan incluirá")}</h2>
              <ul className="mt-3 space-y-2.5 px-1">
                {PLAN_INCLUDES.map((item) => (
                  <li key={item} className="flex items-center gap-3 type-subhead">
                    <Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.25} aria-hidden="true" />{item}
                  </li>
                ))}
              </ul>
            </section>
            <PlanPreview focus={c.focus} goal={c.goal} weight={Number(c.weight) || undefined} days={c.days.length} registered={Boolean(user)} hideHeader />
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
