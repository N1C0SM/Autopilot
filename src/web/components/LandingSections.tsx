import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, Check, Play, Zap, Utensils, BarChart3, Layers, Target, TrendingUp, Infinity as InfinityIcon, ShieldCheck, Smartphone, Monitor, Gift, UserRound, House, Dumbbell, Flame, LogOut, PanelLeft, Settings } from "lucide-react";
import { BrandMark } from "@/shared/components/ui/brand-mark";
import { PhoneAppBar, PhoneFrame, PhoneHome, PhoneTabBar } from "@/web/components/PublicPhone";
import { cn } from "@/shared/lib/utils";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import type { PlanKey } from "@/shared/config/tiers";
import { track } from "@/shared/lib/analytics";
import { hapticTap } from "@/shared/lib/native";
import { supabase } from "@/shared/integrations/supabase/client";
import { AppleLogo, GooglePlayLogo } from "@/web/components/StoreLogos";
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

function StoreButton({ href, small, big, children }: { href: string; small: string; big: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${small} ${big}`} onClick={() => void hapticTap()} className="inline-flex h-12 items-center gap-2.5 rounded-xl border border-foreground/40 px-3.5 transition-colors hover:bg-foreground/5">
    {children}<span className="text-left leading-none"><span className="block text-[9px]">{small}</span><span className="mt-0.5 block text-[17px] font-semibold">{big}</span></span>
  </a>;
}

/** Lienzo a tamaño real reducido al ancho de su caja: el portátil y el móvil son la app tal cual, en pequeño. */
function Scaled({ width, height, className, children }: { width: number; height: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const fit = () => setScale(box.clientWidth / width);
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [width]);
  return <div ref={ref} className={cn("relative overflow-hidden", className)} style={{ aspectRatio: `${width} / ${height}` }}>
    <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `scale(${scale})`, visibility: scale ? undefined : "hidden" }}>{children}</div>
  </div>;
}

const DEMO_NAME = "Alex";
const PHONE_TABS = [{ key: "home", label: "Hoy", icon: House }, { key: "training", label: "Entrenar", icon: Dumbbell }, { key: "nutrition", label: "Nutrición", icon: Flame }, { key: "progress", label: "Progreso", icon: TrendingUp }] as const;
// Menú de la app de Mac (`UserSidebar`, sin el chat, que aún no está publicado).
const MAC_MENU = [[House, "Inicio"], [Dumbbell, "Entrenamiento"], [Flame, "Nutrición"], [TrendingUp, "Mi progreso"], [Settings, "Ajustes"]] as const;

/** La app de Mac en «Inicio»: barra lateral, barra superior y el Hoy ancho, con datos de ejemplo. */
function MacHome() {
  const plans = usePlanAvailability();
  return <div className="flex h-full bg-background text-foreground">
    <aside className="flex w-[250px] shrink-0 flex-col border-r-[0.5px] border-border bg-sidebar px-2 pb-4 pt-4">
      <p className="flex items-center gap-2 px-2"><BrandMark size={24} /><span className="text-[18px] font-bold tracking-[0.01em]">AUTOPILOT</span></p>
      <ul className="mt-3 space-y-1">{MAC_MENU.map(([Icon, label], index) => <li key={label} className={cn("flex h-11 items-center gap-2 rounded-md px-2 text-[15px]", index === 0 && "font-semibold text-primary")}><Icon className="h-5 w-5" strokeWidth={1.5} />{label}</li>)}</ul>
      <div className="mt-auto flex items-center gap-3 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 type-subhead font-bold text-primary ring-1 ring-primary/25">{DEMO_NAME[0]}</span>
        <span className="type-footnote text-muted-foreground">{DEMO_NAME}</span>
      </div>
      <p className="mt-3 flex h-9 items-center gap-2 px-2 text-[15px] text-destructive"><LogOut className="h-4 w-4" />Cerrar sesión</p>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b-[0.5px] border-border px-6">
        <PanelLeft className="h-4 w-4" />
        <span className="min-w-0 flex-1"><span className="block type-headline text-[18px]">Inicio</span><span className="block text-[13px] text-muted-foreground">Tu entreno de hoy y lo que toca comer</span></span>
        <Bell className="h-[17px] w-[17px]" strokeWidth={1.5} />
      </header>
      <div className="min-h-0 flex-1 overflow-hidden p-10 pt-8"><PhoneHome plans={plans} name={DEMO_NAME} wide /></div>
    </div>
  </div>;
}

/** Portátil + iPhone con la app tal cual (Hoy de Mac y de iPhone) y datos de ejemplo: no lee ninguna cuenta. */
function DevicesMockup() {
  const plans = usePlanAvailability();
  return <div aria-hidden="true" className="pointer-events-none relative mx-auto aspect-[16/9] w-full max-w-[480px] select-none">
    <div className="absolute bottom-[6%] left-0 w-[74%]">
      <div className="rounded-t-[14px] border-[6px] border-b-0 border-secondary bg-secondary shadow-2xl">
        <Scaled width={1200} height={750} className="rounded-[4px]"><MacHome /></Scaled>
      </div>
      <div className="h-3 rounded-b-[10px] bg-gradient-to-b from-accent to-card" />
    </div>
    <div className="absolute bottom-0 right-0 w-[27%] drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]">
      <Scaled width={352} height={710}>
        <PhoneFrame screenClassName="h-[44rem]">
          <PhoneAppBar avatar={DEMO_NAME[0]} />
          <div className="flex-1 overflow-hidden px-4 pb-24 pt-3"><PhoneHome plans={plans} name={DEMO_NAME} /></div>
          <PhoneTabBar tabs={PHONE_TABS} active="home" onSelect={() => undefined} />
        </PhoneFrame>
      </Scaled>
    </div>
  </div>;
}

type StoreLinks = { appStore: string; macStore: string; playStore: string };

/**
 * Enlaces de Admin → Landing (App Store, Mac App Store, Google Play) y su interruptor
 * «Insignias de tiendas en la portada». null mientras no hay ninguno que enseñar.
 */
function useStoreLinks() {
  const [links, setLinks] = useState<StoreLinks | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.rpc("get_public_settings").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (!alive || !row || row.show_store_badges === false) return;
      const found = { appStore: (row.app_store_url || "").trim(), macStore: (row.mac_store_url || "").trim(), playStore: (row.play_store_url || "").trim() };
      if (found.appStore || found.macStore || found.playStore) setLinks(found);
    }, () => undefined);
    return () => { alive = false; };
  }, []);
  return links;
}

/** «Todo tu progreso, en todos tus dispositivos»: solo con algún enlace de tienda; cada botón, el suyo. */
export function LandingExperience() {
  const links = useStoreLinks();
  if (!links) return null;
  return <section aria-labelledby="exp-t" className="px-5 pb-0 pt-8 sm:px-8">
    <div className="mx-auto grid max-w-6xl items-end gap-10 lg:grid-cols-[1fr_1fr]">
      <div className="pb-6">
        <Kicker>La experiencia</Kicker>
        <h2 id="exp-t" className="mt-3 text-[30px] font-bold leading-[1.15] tracking-[-0.015em] sm:text-[36px]">Todo tu progreso,<br />en todos tus dispositivos.</h2>
        <p className="mt-4 max-w-[400px] text-[16px] leading-[22px] text-foreground/85">Entrena, planifica tu nutrición y sigue tu evolución donde quieras. Una experiencia fluida, sincronizada y pensada para ti.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {links.appStore && <StoreButton href={links.appStore} small="Descargar en" big="App Store"><AppleLogo className="h-6 w-6 shrink-0" /></StoreButton>}
          {links.macStore && <StoreButton href={links.macStore} small="Descargar en" big="Mac App Store"><AppleLogo className="h-6 w-6 shrink-0" /></StoreButton>}
          {links.playStore && <StoreButton href={links.playStore} small="DISPONIBLE EN" big="Google Play"><GooglePlayLogo className="h-6 w-6 shrink-0" /></StoreButton>}
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
