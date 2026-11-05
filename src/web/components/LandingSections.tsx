import { Link } from "react-router-dom";
import { ArrowRight, Check, Play, Zap, Utensils, BarChart3, Layers, Target, TrendingUp, Infinity as InfinityIcon, ShieldCheck, Smartphone, Laptop, UserRound, Gift } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import PublicHeroPhone from "@/web/components/PublicHeroPhone";
import AppStoreBadges from "@/web/components/AppStoreBadges";
import { track } from "@/shared/lib/analytics";
import { hapticTap } from "@/shared/lib/native";
import heroAthlete from "@/shared/assets/landing/hero-athlete.jpg";
import problemSunset from "@/shared/assets/landing/problem-sunset.jpg";
import finalHorizon from "@/shared/assets/landing/final-horizon.jpg";

const Kicker = ({ children, center }: { children: React.ReactNode; center?: boolean }) =>
  <p className={`text-[12px] font-semibold uppercase tracking-[0.18em] text-primary ${center ? "text-center" : ""}`}>{children}</p>;

const cta = (source: string) => () => { void hapticTap(); track("cta_click", { cta: "free_signup", source }); };

export function LandingHero({ ctaRef }: { ctaRef: React.Ref<HTMLDivElement> }) {
  const pillars = [
    { icon: Zap, t: "Plan personalizado", s: "según tu objetivo" },
    { icon: Utensils, t: "Nutrición", s: "adaptada a ti" },
    { icon: BarChart3, t: "Progreso", s: "real y medible" },
    { icon: Layers, t: "Academia", s: "para aprender más" },
  ];
  return <section className="relative overflow-hidden">
    <img src={heroAthlete} alt="" aria-hidden="true" width={1600} height={1008} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[70%_center] opacity-60 sm:opacity-90" />
    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-14 sm:px-8 sm:pt-24">
      <div className="max-w-xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Entrenamiento · Nutrición · Progreso</p>
        <h1 className="mt-4 text-[42px] font-bold leading-[1.04] tracking-[-0.03em] sm:text-[60px]">Convierte la disciplina <span className="block">en <span className="text-primary">resultados.</span></span></h1>
        <p className="mt-5 max-w-md text-[17px] leading-[26px] text-foreground/85 sm:text-[19px] sm:leading-[28px]">Tu sistema de entrenamiento, nutrición y progreso. Simple, personal y basado en datos.</p>
        <div ref={ctaRef} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button variant="hero" size="lg" asChild className="sm:px-8"><Link to="/onboarding" onClick={cta("hero")}>Empezar gratis <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          <Button variant="outline" size="lg" asChild className="rounded-full border-foreground/30 bg-transparent sm:px-8"><a href="#demo" onClick={() => { void hapticTap(); track("plan_preview_view", { source: "hero" }); }}><Play className="mr-1 h-4 w-4 fill-current" />Ver demo</a></Button>
        </div>
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-foreground/80">
          {["Gratis para siempre", "Sin tarjeta", "Sin compromiso"].map((t) => <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4" />{t}</li>)}
        </ul>
      </div>
      <ul className="mt-14 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {pillars.map(({ icon: I, t, s }) => <li key={t} className="flex items-start gap-3"><I className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.6} /><div><p className="text-[15px] font-semibold">{t}</p><p className="text-[14px] text-muted-foreground">{s}</p></div></li>)}
      </ul>
    </div>
  </section>;
}

export function LandingExperience() {
  return <section aria-labelledby="exp-t" className="px-5 py-16 sm:px-8 sm:py-24">
    <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
      <div>
        <Kicker>La experiencia</Kicker>
        <h2 id="exp-t" className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">Todo tu progreso, en todos tus dispositivos.</h2>
        <p className="mt-4 max-w-md text-[17px] leading-[26px] text-muted-foreground">Entrena, planifica tu nutrición y sigue tu evolución donde quieras. Una experiencia fluida, sincronizada y pensada para ti.</p>
        <AppStoreBadges size="compact" className="mt-7 items-start [&_.justify-center]:justify-start" align="center" />
        <p className="mt-5 flex items-center gap-3 text-[14px] text-muted-foreground"><Smartphone className="h-4 w-4" />iPhone · Android · <Laptop className="h-4 w-4" />Mac y web</p>
      </div>
      <div className="flex justify-center"><PublicHeroPhone /></div>
    </div>
  </section>;
}

export function LandingProblem() {
  return <section aria-label="El problema y la solución" className="relative overflow-hidden">
    <img src={problemSunset} alt="" aria-hidden="true" loading="lazy" width={1600} height={640} className="absolute inset-0 h-full w-full object-cover" />
    <div aria-hidden="true" className="absolute inset-0 bg-background/55" />
    <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 md:grid-cols-2 md:gap-24">
      <div><Kicker>El problema</Kicker><h2 className="mt-3 text-[28px] font-bold leading-[1.15] sm:text-[36px]">Entrenas, comes bien, te esfuerzas… pero no ves progreso.</h2></div>
      <div className="md:self-end"><Kicker>La solución</Kicker><p className="mt-3 text-[32px] font-bold tracking-[-0.01em] sm:text-[40px]">AUTOPILOT.</p><p className="mt-2 max-w-md text-[17px] leading-[26px] text-foreground/85">Un sistema que une entrenamiento, nutrición y seguimiento para que tu esfuerzo se convierta en resultados.</p></div>
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
    { icon: ShieldCheck, t: "Tus datos, siempre privados", s: "Cumplimos con la normativa RGPD" },
  ];
  return <section aria-labelledby="why-t" className="px-5 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-6xl">
      <Kicker>Por qué funciona</Kicker><h2 id="why-t" className="sr-only">Por qué funciona</h2>
      <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
        {items.map(({ icon: I, t, s }) => <li key={t} className="lg:px-6 lg:first:pl-0"><I className="h-6 w-6 text-primary" strokeWidth={1.6} /><p className="mt-3 text-[18px] font-semibold">{t}</p><p className="mt-1 text-[15px] leading-[22px] text-muted-foreground">{s}</p></li>)}
      </ul>
      <ul className="mt-14 grid gap-6 border-y border-border py-6 sm:grid-cols-3 sm:divide-x sm:divide-border">
        {trust.map(({ icon: I, t, s }) => <li key={t} className="flex items-center gap-3 sm:justify-center sm:px-4"><I className="h-6 w-6 shrink-0 text-primary" strokeWidth={1.6} /><div><p className="text-[15px] font-semibold">{t}</p><p className="text-[13px] text-muted-foreground">{s}</p></div></li>)}
      </ul>
    </div>
  </section>;
}

export function LandingFinal({ innerRef }: { innerRef: React.Ref<HTMLDivElement> }) {
  return <section aria-labelledby="final-t" className="relative overflow-hidden">
    <img src={finalHorizon} alt="" aria-hidden="true" loading="lazy" width={1600} height={640} className="absolute inset-0 h-full w-full object-cover object-bottom" />
    <div ref={innerRef} className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
      <Kicker center>Autopilot</Kicker>
      <h2 id="final-t" className="mt-3 text-[34px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[48px]">No es un reto. Es un sistema. Empieza hoy.</h2>
      <p className="mt-4 text-[17px] text-foreground/85">Únete gratis y da el primer paso hacia tu mejor versión.</p>
      <Button variant="hero" size="lg" asChild className="mt-8 sm:px-10"><Link to="/onboarding" onClick={cta("final")}>Empezar gratis <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
    </div>
  </section>;
}
