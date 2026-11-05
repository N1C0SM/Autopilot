import { Link } from "react-router-dom";
import { ArrowRight, Check, Play, Zap, Utensils, BarChart3, Layers, Target, TrendingUp, Infinity as InfinityIcon, ShieldCheck, Smartphone, Monitor, Gift, UserRound, Circle, House, Dumbbell, Apple, LineChart, BookOpen } from "lucide-react";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import type { PlanKey } from "@/shared/config/tiers";
import { track } from "@/shared/lib/analytics";
import { hapticTap } from "@/shared/lib/native";
import heroAthlete from "@/shared/assets/landing/hero-athlete.jpg";
import problemSunset from "@/shared/assets/landing/problem-sunset.jpg";
import finalHorizon from "@/shared/assets/landing/final-horizon.jpg";

/** Píldoras de la portada: dorado relleno para la acción, contorno claro para la secundaria. */
export const pillGold = "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[16px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-75";
export const pillLine = "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-foreground/35 px-7 text-[16px] font-semibold text-foreground transition-colors hover:bg-foreground/5 active:opacity-75";

const Kicker = ({ children, className = "" }: { children: React.ReactNode; className?: string }) =>
  <p className={`text-[11px] font-bold uppercase tracking-[0.2em] text-primary sm:text-[12px] ${className}`}>{children}</p>;

const cta = (source: string) => () => { void hapticTap(); track("cta_click", { cta: "free_signup", source }); };

export function LandingHero({ ctaRef }: { ctaRef: React.Ref<HTMLDivElement> }) {
  const pillars = [
    { icon: Zap, t: "Plan personalizado", s: "según tu objetivo" },
    { icon: Utensils, t: "Nutrición", s: "adaptada a ti" },
    { icon: BarChart3, t: "Progreso", s: "real y medible" },
    { icon: Layers, t: "Academia", s: "para aprender más" },
  ];
  return <section className="relative overflow-hidden">
    <img src={heroAthlete} alt="" aria-hidden="true" width={1600} height={1008} fetchPriority="high" className="absolute inset-y-0 right-0 h-full w-full object-cover object-[75%_20%] opacity-55 sm:w-[78%] sm:opacity-100" />
    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent sm:via-background/40" />
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-8 sm:pt-14">
      <div className="max-w-[560px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground sm:text-[12px]">Entrenamiento · Nutrición · Progreso</p>
        <h1 className="mt-4 text-[40px] font-bold leading-[1.05] tracking-[-0.025em] sm:text-[52px]">Convierte la disciplina <span className="block">en <span className="text-primary">resultados.</span></span></h1>
        <p className="mt-5 text-[17px] leading-[24px] text-foreground/90 sm:text-[18px]">Tu sistema de entrenamiento, nutrición y progreso.<br className="hidden sm:block" /> Simple, personal y basado en datos.</p>
        <div ref={ctaRef} className="mt-7 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link to="/onboarding" onClick={cta("hero")} className={pillGold}>Empezar gratis <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/como-funciona#demo" onClick={() => { void hapticTap(); track("plan_preview_view", { source: "hero" }); }} className={`${pillLine} sm:min-w-[152px]`}><Play className="h-4 w-4 fill-current" />Ver demo</Link>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-foreground/85">
          {["Gratis para siempre", "Sin tarjeta", "Sin compromiso"].map((t) => <li key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" strokeWidth={2.4} />{t}</li>)}
        </ul>
      </div>
      <ul className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {pillars.map(({ icon: I, t, s }) => <li key={t} className="flex items-center gap-4"><I className="h-7 w-7 shrink-0 text-primary" strokeWidth={1.5} /><div className="text-[14px] leading-[19px]"><p className="font-semibold">{t}</p><p className="text-foreground/80">{s}</p></div></li>)}
      </ul>
    </div>
  </section>;
}

function StoreButton({ to, small, big, children }: { to: string; small: string; big: string; children: React.ReactNode }) {
  return <Link to={to} className="inline-flex h-12 items-center gap-2.5 rounded-xl border border-foreground/40 px-3.5 transition-colors hover:bg-foreground/5">
    {children}<span className="text-left leading-none"><span className="block text-[9px]">{small}</span><span className="mt-0.5 block text-[17px] font-semibold">{big}</span></span>
  </Link>;
}

/** Portátil + iPhone con datos de ejemplo: ilustra la app, no lee ninguna cuenta. */
function DevicesMockup() {
  const rows = [["Press banca", "4 × 8–10"], ["Press militar", "3 × 8–10"], ["Fondos", "3 × 10–12"]];
  const side = [[House, "Hoy"], [Dumbbell, "Entrenamiento"], [Apple, "Nutrición"], [LineChart, "Progreso"], [BookOpen, "Academia"]] as const;
  return <div aria-hidden="true" className="relative mx-auto h-[300px] w-full max-w-[480px] sm:h-[330px]">
    <div className="absolute bottom-6 left-0 w-[78%]">
      <div className="rounded-t-[14px] border-[6px] border-b-0 border-secondary bg-card p-3 shadow-2xl">
        <div className="flex h-[170px] gap-3 sm:h-[190px]">
          <div className="w-[30%] space-y-2.5 text-[8px] text-muted-foreground"><p className="mb-3 flex items-center gap-1 text-[9px] font-bold text-foreground"><span className="text-primary">▲</span> AUTOPILOT</p>{side.map(([I, l]) => <p key={l} className="flex items-center gap-1.5"><I className="h-2.5 w-2.5" />{l}</p>)}</div>
          <div className="flex-1"><p className="text-[13px] font-semibold">Progreso</p>
            <svg viewBox="0 0 200 90" className="mt-3 h-[110px] w-full"><defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="hsl(var(--primary))" stopOpacity=".35" /><stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" /></linearGradient></defs>
              {[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="200" y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth=".5" />)}
              <path d="M0 82 L25 76 L45 79 L70 66 L90 68 L115 52 L135 55 L160 36 L180 30 L200 12 L200 90 L0 90Z" fill="url(#lg)" />
              <path d="M0 82 L25 76 L45 79 L70 66 L90 68 L115 52 L135 55 L160 36 L180 30 L200 12" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.6" /></svg></div>
        </div>
      </div>
      <div className="h-3 rounded-b-[10px] bg-gradient-to-b from-accent to-card" />
    </div>
    <div className="absolute bottom-0 right-0 w-[40%] max-w-[190px] rounded-[30px] border-[5px] border-secondary bg-background p-3 shadow-2xl">
      <div className="flex justify-between text-[8px] font-semibold"><span>9:41</span><span>●●●</span></div>
      <div className="mt-3 flex items-start justify-between"><div><p className="text-[16px] font-bold italic">Hoy</p><p className="text-[10px] text-muted-foreground">Push A</p></div><span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"><Play className="h-3 w-3 fill-current" /></span></div>
      <ul className="mt-3 space-y-3">{rows.map(([n, s]) => <li key={n} className="flex items-center gap-2"><span className="h-7 w-9 rounded-md bg-secondary" /><span className="flex-1 leading-tight"><span className="block text-[9px] font-semibold">{n}</span><span className="text-[8px] text-muted-foreground">{s}</span></span><Circle className="h-3 w-3 text-muted-foreground" /></li>)}</ul>
    </div>
  </div>;
}

export function LandingExperience() {
  return <section aria-labelledby="exp-t" className="px-5 pb-0 pt-8 sm:px-8">
    <div className="mx-auto grid max-w-6xl items-end gap-10 lg:grid-cols-[1fr_1fr]">
      <div className="pb-6">
        <Kicker>La experiencia</Kicker>
        <h2 id="exp-t" className="mt-3 text-[30px] font-bold leading-[1.15] tracking-[-0.015em] sm:text-[36px]">Todo tu progreso,<br />en todos tus dispositivos.</h2>
        <p className="mt-4 max-w-[400px] text-[16px] leading-[22px] text-foreground/85">Entrena, planifica tu nutrición y sigue tu evolución donde quieras. Una experiencia fluida, sincronizada y pensada para ti.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <StoreButton to="/app" small="Descargar en" big="App Store"><Apple className="h-6 w-6 fill-current" /></StoreButton>
          <StoreButton to="/app" small="DISPONIBLE EN" big="Google Play"><Play className="h-5 w-5 fill-primary text-primary" /></StoreButton>
          <StoreButton to="/app" small="Disponible en" big="Mac"><Monitor className="h-6 w-6" /></StoreButton>
        </div>
        <p className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-foreground/85"><Smartphone className="h-4 w-4" />iPhone · <Smartphone className="h-4 w-4" />Android · <Monitor className="h-4 w-4" />Mac</p>
      </div>
      <DevicesMockup />
    </div>
  </section>;
}

export function LandingProblem() {
  return <section aria-label="El problema y la solución" className="relative overflow-hidden">
    <img src={problemSunset} alt="" aria-hidden="true" loading="lazy" width={1600} height={640} className="absolute inset-0 h-full w-full object-cover object-[35%_center]" />
    <div aria-hidden="true" className="absolute inset-0 bg-background/40" />
    <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto_1fr] md:py-14">
      <div><Kicker>El problema</Kicker><h2 className="mt-3 text-[26px] font-bold leading-[1.15] sm:text-[28px]">Entrenas, comes bien,<br />te esfuerzas…<br />pero no ves progreso.</h2></div>
      <ArrowRight aria-hidden="true" className="hidden h-6 w-6 text-foreground/80 md:block md:mx-24" strokeWidth={1.4} />
      <div><Kicker>La solución</Kicker><p className="mt-3 text-[32px] font-bold tracking-[0.01em]">AUTOPILOT.</p><p className="mt-1 max-w-[290px] text-[16px] leading-[20px] text-foreground/90">Un sistema que une entrenamiento, nutrición y seguimiento para que tu esfuerzo se convierta en resultados.</p></div>
    </div>
  </section>;
}

export function LandingWhy() {
  const items = [
    { icon: Target, t: "Plan a tu medida", s: "Según tu nivel, objetivo y tiempo." },
    { icon: Layers, t: "Todo conectado", s: "Entrenamiento, nutrición y progreso en un solo lugar." },
    { icon: TrendingUp, t: "Decisiones con datos", s: "Sigue tu evolución y sabe qué hacer en cada momento." },
    { icon: InfinityIcon, t: "Sostenible", s: "Sin extremismos. Hábitos que puedes mantener." },
  ];
  const trust = [
    { icon: Gift, t: "Free para siempre", s: "Sin tarjeta y sin caducidad" },
    { icon: UserRound, t: "Hecho por una persona", s: "Nicolás construye y responde" },
    { icon: ShieldCheck, t: "Tus datos, siempre privados", s: "Cumplimos con la normativa RGPD." },
  ];
  return <section aria-labelledby="why-t" className="border-t border-border px-5 pt-6 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <h2 id="why-t"><Kicker>Por qué funciona</Kicker></h2>
      <ul className="mt-4 grid gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
        {items.map(({ icon: I, t, s }) => <li key={t} className="lg:px-6 lg:first:pl-0"><I className="h-6 w-6 text-primary" strokeWidth={1.6} /><p className="mt-2.5 text-[17px] font-semibold">{t}</p><p className="mt-1 max-w-[220px] text-[14px] leading-[18px] text-foreground/80">{s}</p></li>)}
      </ul>
      <ul className="mt-6 grid gap-5 border-y border-border py-5 sm:grid-cols-3 sm:divide-x sm:divide-border">
        {trust.map(({ icon: I, t, s }) => <li key={t} className="flex items-center gap-3 sm:justify-center sm:px-4"><I className="h-7 w-7 shrink-0 text-primary" strokeWidth={1.5} /><div className="leading-tight"><p className="text-[14px] font-semibold">{t}</p><p className="text-[12px] text-foreground/80">{s}</p></div></li>)}
      </ul>
    </div>
  </section>;
}

const price = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");

export function LandingPlans({ onSelect, innerRef }: { onSelect: (plan: PlanKey) => void; innerRef: React.Ref<HTMLElement> }) {
  const a = usePlanAvailability();
  const free = a.plans.find((p) => p.key === "free");
  const plus = a.plus ? a.plans.find((p) => p.key === "training") : undefined;
  return <section id="precios" ref={innerRef} aria-labelledby="precios-titulo" className="scroll-mt-20 px-5 py-8 sm:px-8">
    <div className="mx-auto grid max-w-6xl items-center gap-6 lg:grid-cols-[0.95fr_1fr_1fr]">
      <div className="lg:pr-6">
        <Kicker>Planes</Kicker>
        <h2 id="precios-titulo" className="mt-3 text-[30px] font-bold leading-[1.15] tracking-[-0.015em] sm:text-[34px]">Empieza gratis<br />y decide después.</h2>
        <p className="mt-4 text-[16px] leading-[22px] text-foreground/90">Sin compromiso. Mejora tu rutina, tu alimentación y tu progreso.</p>
        <p className="mt-4"><Link to="/planes" className="text-[14px] font-medium text-primary active:opacity-60">Ver la comparativa completa</Link></p>
      </div>
      {free && <div className="flex h-full flex-col rounded-[14px] border border-border bg-card p-5">
        <p className="text-[20px] font-bold">{free.name} — {price(free.price)} €</p>
        <ul className="mt-3 flex-1 space-y-1.5">{free.features.slice(0, 5).map((f) => <li key={f} className="flex gap-3 text-[14px]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>
        <button type="button" onClick={() => onSelect("free")} className={`${pillLine} mt-5 h-11 w-full text-[15px]`}>Crear cuenta gratis</button>
      </div>}
      {plus && <div className="flex h-full flex-col rounded-[14px] border-2 border-primary bg-card p-5">
        <div className="flex items-start justify-between gap-2"><p className="text-[20px] font-bold">{plus.name} — {price(plus.price)} € <span className="text-[13px] font-medium">/mes</span></p><span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">Más completo</span></div>
        <ul className="mt-3 flex-1 space-y-1.5">{plus.features.slice(0, 5).map((f) => <li key={f} className="flex gap-3 text-[14px]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>
        <button type="button" onClick={() => onSelect("training")} className={`${pillGold} mt-5 h-11 w-full text-[15px]`}>Elegir {plus.name} <ArrowRight className="h-4 w-4" /></button>
      </div>}
    </div>
  </section>;
}

export function LandingFinal({ innerRef }: { innerRef: React.Ref<HTMLDivElement> }) {
  return <section aria-labelledby="final-t" className="relative overflow-hidden">
    <img src={finalHorizon} alt="" aria-hidden="true" loading="lazy" width={1600} height={640} className="absolute inset-0 h-full w-full object-cover object-bottom" />
    <div ref={innerRef} className="relative mx-auto max-w-3xl px-5 py-14 text-center sm:py-16">
      <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-foreground/90">Autopilot</p>
      <h2 id="final-t" className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.015em] sm:text-[40px]">No es un reto. Es un sistema.<br />Empieza hoy.</h2>
      <p className="mt-3 text-[16px] text-foreground/90">Únete gratis y da el primer paso hacia tu mejor versión.</p>
      <Link to="/onboarding" onClick={cta("final")} className={`${pillGold} mt-6 px-9`}>Empezar gratis <ArrowRight className="h-4 w-4" /></Link>
    </div>
  </section>;
}
