import type { ReactNode, Ref } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Check, Dumbbell, Flame, Layers, Play, Target, Utensils, Zap } from "lucide-react";
import { AppLink } from "@/shared/ui/AppLink";
import { BrandMark } from "@/shared/components/ui/brand-mark";
import AppStoreBadges from "@/web/components/AppStoreBadges";
import { track } from "@/shared/lib/analytics";
import { hapticTap } from "@/shared/lib/native";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import type { PlanKey } from "@/shared/config/tiers";
import { pillGold, pillLine } from "@/web/components/LandingSections";

const cta = (source: string) => () => { void hapticTap(); track("cta_click", { cta: "free_signup", source }); };
const Kicker = ({ children }: { children: ReactNode }) => <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary">{children}</p>;
const price = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");

/** Marco de iPhone con datos ilustrativos (nunca datos de clientes). */
function Phone({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div aria-hidden="true" className={`rounded-[44px] bg-gradient-to-b from-foreground/25 to-foreground/5 p-[3px] shadow-2xl ${className}`}>
    <div className="relative h-full overflow-hidden rounded-[41px] bg-background px-4 pb-4 pt-9">
      <div className="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-foreground/10" />
      {children}
    </div>
  </div>;
}

const DAYS = [["L", 16], ["M", 17], ["X", 18], ["J", 19], ["V", 20], ["S", 21], ["D", 22]] as const;

function TodayScreen() {
  return <div className="flex h-full flex-col text-left">
    <div className="flex items-center gap-2"><BrandMark size={18} /><span className="text-[12px] font-bold tracking-wide">AUTOPILOT</span></div>
    <p className="mt-4 text-[11px] text-muted-foreground">Hoy</p>
    <p className="text-[22px] font-bold leading-tight">Tu sesión</p>
    <p className="text-[11px] text-muted-foreground">La constancia crea el cambio.</p>
    <div className="mt-3 grid grid-cols-7 gap-1 text-center">
      {DAYS.map(([d, n]) => <div key={d} className={`rounded-full py-1 text-[9px] ${n === 20 ? "ring-1 ring-primary text-primary" : "text-muted-foreground"}`}>{d}<br /><span className="text-[11px] font-semibold">{n}</span></div>)}
    </div>
    <div className="mt-3 rounded-[22px] bg-card p-4">
      <p className="text-[10px] text-muted-foreground">Entrenamiento</p>
      <p className="text-[17px] font-bold">Día D</p>
      <p className="text-[11px] text-muted-foreground">Pecho, tríceps y core</p>
      <div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-muted-foreground">60 min · 7 ejercicios</span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"><Play className="h-3.5 w-3.5 fill-current" /></span></div>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
      {[[Flame, "3.200", "kcal"], [Utensils, "120", "g proteína"], [Target, "0/1", "sesiones"]].map(([I, v, l]) => { const Icon = I as typeof Flame; return <div key={l as string} className="rounded-[18px] bg-card py-3"><Icon className="mx-auto h-4 w-4 text-primary" /><p className="mt-1 text-[14px] font-bold">{v as string}</p><p className="text-[9px] text-muted-foreground">{l as string}</p></div>; })}
    </div>
    <div className="mt-auto flex justify-around border-t border-border pt-3 text-[9px] text-muted-foreground">
      <span className="text-primary">Hoy</span><span>Plan</span><span>Nutrición</span><span>Progreso</span>
    </div>
  </div>;
}

function TrainingScreen() {
  return <div className="text-left">
    <p className="text-[15px] font-bold">Entrenamiento</p>
    <p className="mt-3 text-[10px] text-muted-foreground">Rutina</p><p className="text-[14px] font-bold">Día D</p>
    {[["Press inclinado", "4 series · 8–10 reps"], ["Aperturas en máquina", "3 series · 12 reps"], ["Fondos en paralelas", "3 series · al fallo"]].map(([n, s]) =>
      <div key={n} className="mt-2 flex items-center gap-2 rounded-[16px] bg-card p-2.5"><Dumbbell className="h-4 w-4 text-primary" /><div><p className="text-[11px] font-semibold">{n}</p><p className="text-[9px] text-muted-foreground">{s}</p></div></div>)}
  </div>;
}

function NutritionScreen() {
  return <div className="text-left">
    <p className="text-[15px] font-bold">Nutrición</p>
    <div className="relative mx-auto mt-4 grid h-28 w-28 place-items-center rounded-full border-[6px] border-primary/80 border-r-card">
      <div className="text-center"><p className="text-[20px] font-bold">2.340</p><p className="text-[9px] text-muted-foreground">/ 2.700 kcal</p></div>
    </div>
    {[["Proteína", "120 / 160 g", 75], ["Hidratos", "280 / 300 g", 93], ["Grasas", "70 / 90 g", 78]].map(([n, v, p]) =>
      <div key={n as string} className="mt-3"><div className="flex justify-between text-[10px]"><span>{n}</span><span className="text-muted-foreground">{v}</span></div>
        <div className="mt-1 h-1 rounded-full bg-card"><div className="h-1 rounded-full bg-primary" style={{ width: `${p}%` }} /></div></div>)}
  </div>;
}

function ProgressScreen() {
  return <div className="text-left">
    <p className="text-[15px] font-bold">Progreso</p>
    <div className="mt-3 flex gap-1 text-[9px]">{["1S", "1M", "3M", "1A"].map((r) => <span key={r} className={`rounded-full px-2 py-1 ${r === "3M" ? "bg-foreground text-background" : "bg-card text-muted-foreground"}`}>{r}</span>)}</div>
    <svg viewBox="0 0 200 90" className="mt-4 w-full text-primary"><path d="M0 80 C40 75 60 60 90 55 S150 30 200 10" fill="none" stroke="currentColor" strokeWidth="3" /></svg>
    {[["Peso", "Ejemplo"], ["Fuerza", "Ejemplo"]].map(([n, v]) => <div key={n} className="mt-2 flex justify-between rounded-[14px] bg-card p-2.5 text-[11px]"><span>{n}</span><span className="text-muted-foreground">{v}</span></div>)}
  </div>;
}

export function RefHero({ ctaRef }: { ctaRef: Ref<HTMLDivElement> }) {
  return <section aria-labelledby="hero-t" className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pt-16">
    <div className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
    <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Kicker>Entrenamiento · Nutrición · Progreso</Kicker>
        <h1 id="hero-t" className="mt-4 text-[40px] font-bold leading-[1.05] tracking-[-0.025em] sm:text-[56px]">Tu entrenamiento, nutrición y progreso en un solo lugar.</h1>
        <p className="mt-5 max-w-[480px] text-[17px] leading-[25px] text-foreground/80">Una rutina híbrida de gimnasio y calistenia, tu alimentación y tu evolución, en una sola app.</p>
        <div ref={ctaRef} className="mt-8 flex flex-wrap items-center gap-3">
          <AppLink to="/onboarding" onClick={cta("hero")} className={`${pillGold} h-14 px-9`}>Empezar gratis <ArrowRight className="h-4 w-4" /></AppLink>
          <AppStoreBadges size="compact" />
        </div>
        <ul className="mt-10 grid max-w-[520px] grid-cols-3 gap-4 text-[13px] text-foreground/80">
          {[[Dumbbell, "Planifica tu entrenamiento"], [Utensils, "Controla tu nutrición"], [BarChart3, "Sigue tu progreso"]].map(([I, t]) => { const Icon = I as typeof Dumbbell; return <li key={t as string} className="flex items-center gap-2"><Icon className="h-5 w-5 shrink-0 text-foreground" />{t as string}</li>; })}
        </ul>
      </div>
      <Phone className="mx-auto h-[600px] w-[300px] rotate-[4deg] animate-in fade-in zoom-in-95 duration-1000"><TodayScreen /></Phone>
    </div>
  </section>;
}

export function RefMethod() {
  const items = [[Zap, "Planificación inteligente", "Rutinas adaptadas a tu nivel, tu material y tu objetivo."], [Layers, "Nutrición con IA", "Calorías y macronutrientes calculados para ti."], [BarChart3, "Progreso real", "Visualiza tu evolución y mantén la constancia."]] as const;
  return <section id="metodo" aria-labelledby="metodo-t" className="scroll-mt-20 px-5 py-14 sm:px-8">
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_repeat(3,1fr)]">
      <div><Kicker>Un método completo</Kicker><h2 id="metodo-t" className="mt-3 text-[32px] font-bold tracking-[-0.02em]">Más que entrenar.</h2>
        <p className="mt-3 text-[15px] text-foreground/75">Planificación, nutrición y análisis para avanzar de forma sostenible.</p></div>
      {items.map(([Icon, t, d]) => <div key={t} className="lg:border-l lg:border-border lg:pl-8"><Icon className="h-7 w-7 text-foreground" /><p className="mt-4 text-[17px] font-semibold">{t}</p><p className="mt-1 text-[14px] text-foreground/70">{d}</p></div>)}
    </div>
  </section>;
}

export function RefApp() {
  return <section id="funciones" aria-labelledby="app-t" className="scroll-mt-20 px-5 py-14 sm:px-8">
    <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="flex justify-center -space-x-6 overflow-hidden pb-2">
        <Phone className="h-[380px] w-[200px] -rotate-3"><TrainingScreen /></Phone>
        <Phone className="z-10 h-[400px] w-[200px] -translate-y-3"><NutritionScreen /></Phone>
        <Phone className="h-[380px] w-[200px] rotate-3"><ProgressScreen /></Phone>
      </div>
      <div><Kicker>La aplicación</Kicker><h2 id="app-t" className="mt-3 text-[34px] font-bold leading-[1.1] tracking-[-0.02em]">Diseñada para mantener la constancia.</h2>
        <p className="mt-4 text-[16px] text-foreground/75">Simple, clara y enfocada en lo que importa: que avances.</p>
        <ul className="mt-6 space-y-3">{["Planes personalizados según tu objetivo", "Registro y control de tu nutrición", "Análisis real de tu progreso"].map((t) => <li key={t} className="flex gap-3 text-[15px]"><Check className="h-5 w-5 text-primary" />{t}</li>)}</ul>
        <p className="mt-4 text-[12px] text-muted-foreground">Pantallas con datos de ejemplo.</p>
      </div>
    </div>
  </section>;
}

export function RefPlans({ onSelect, innerRef }: { onSelect: (plan: PlanKey) => void; innerRef: Ref<HTMLElement> }) {
  const a = usePlanAvailability();
  const free = a.plans.find((p) => p.key === "free");
  const plus = a.plus ? a.plans.find((p) => p.key === "training") : undefined;
  return <section id="precios" ref={innerRef} aria-labelledby="precios-t" className="scroll-mt-20 px-5 py-14 text-center sm:px-8">
    <Kicker>Planes</Kicker>
    <h2 id="precios-t" className="mt-3 text-[34px] font-bold tracking-[-0.02em]">Elige tu nivel de compromiso.</h2>
    <p className="mt-2 text-[16px] text-foreground/75">Empieza gratis y da el salto cuando estés listo.</p>
    <div className="mx-auto mt-10 grid max-w-3xl gap-5 text-left sm:grid-cols-2">
      {free && <div className="flex flex-col rounded-[28px] bg-card p-7">
        <p className="text-[18px] font-semibold">{free.name}</p><p className="text-[34px] font-bold">{price(free.price)} €</p>
        <ul className="mt-4 flex-1 space-y-2">{free.features.slice(0, 4).map((f) => <li key={f} className="flex gap-3 text-[14px]"><Check className="h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>
        <button type="button" onClick={() => onSelect("free")} className={`${pillLine} mt-6 w-full`}>Empezar gratis</button>
      </div>}
      {plus && <div className="relative flex flex-col rounded-[28px] bg-card p-7 ring-1 ring-primary">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">Más completo</span>
        <p className="text-[18px] font-semibold">{plus.name}</p><p className="text-[34px] font-bold">{price(plus.price)} € <span className="text-[15px] font-medium">/mes</span></p>
        <ul className="mt-4 flex-1 space-y-2">{plus.features.slice(0, 4).map((f) => <li key={f} className="flex gap-3 text-[14px]"><Check className="h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>
        <button type="button" onClick={() => onSelect("training")} className={`${pillGold} mt-6 w-full`}>Probar {plus.name} <ArrowRight className="h-4 w-4" /></button>
      </div>}
    </div>
    <p className="mt-6"><Link to="/planes" className="text-[14px] font-medium text-primary">Ver la comparativa completa</Link></p>
  </section>;
}

export function RefFounder() {
  return <section id="historia" aria-labelledby="historia-t" className="scroll-mt-20 px-5 py-8 sm:px-8">
    <div className="mx-auto grid max-w-5xl items-center gap-6 rounded-[28px] bg-card p-7 sm:grid-cols-[auto_1fr] sm:gap-10">
      <div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-[18px] font-bold text-primary-foreground">NS</span>
        <div><p className="font-semibold">Nicolás San Marcos</p><p className="text-[13px] text-muted-foreground">Fundador de Autopilot</p></div></div>
      <div className="sm:border-l sm:border-border sm:pl-10"><h2 id="historia-t" className="text-[20px] font-bold">Un proyecto real, con una sola persona detrás.</h2>
        <p className="mt-2 text-[14px] text-foreground/75">Empecé con calistenia en casa, llegué al gimnasio a los 14 y aprendí a programar para unir ambos mundos sin tener que elegir. Autopilot es la herramienta que yo necesitaba.</p></div>
    </div>
  </section>;
}

export function RefFinal({ innerRef }: { innerRef: Ref<HTMLDivElement> }) {
  return <section aria-labelledby="final-t" className="px-5 py-14 sm:px-8">
    <div ref={innerRef} className="mx-auto max-w-5xl rounded-[28px] bg-card px-6 py-14 text-center">
      <BrandMark size={40} className="mx-auto" />
      <h2 id="final-t" className="mt-4 text-[34px] font-bold tracking-[-0.02em]">Deja de improvisar.</h2>
      <p className="mt-2 text-[17px] text-foreground/75">Pon tu progreso en piloto automático.</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <AppLink to="/onboarding" onClick={cta("final")} className={`${pillGold} px-9`}>Empezar gratis <ArrowRight className="h-4 w-4" /></AppLink>
        <AppStoreBadges size="compact" align="center" />
      </div>
    </div>
  </section>;
}
