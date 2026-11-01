import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/shared/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/components/ui/accordion";
import PublicLayout from "@/web/components/PublicLayout";
import { track } from "@/shared/lib/analytics";
import { COACH_CONTACT_CHANNEL, type PlanKey } from "@/shared/config/tiers";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import { LANDING_META, landingDescription, landingFaqs } from "@/shared/lib/publicCopy";
import { PublicTrainingScreen, PublicProgressScreen } from "@/web/components/PublicAppScreen";
import PublicHeroPhone from "@/web/components/PublicHeroPhone";
import FreePlanSection from "@/web/components/FreePlanSection";
import ScrollWords from "@/web/components/ScrollWords";
import BookShowcase from "@/web/components/BookShowcase";
import StickySteps from "@/web/components/StickySteps";
import { Dumbbell, LineChart, SlidersHorizontal } from "lucide-react";
import Benefits from "@/web/components/Benefits";
import AppStoreBadges from "@/web/components/AppStoreBadges";
import HeroPhoneMotion from "@/web/components/HeroPhoneMotion";
import { hapticTap } from "@/shared/lib/native";

const ProductPreview = lazy(() => import("@/web/components/ProductPreview"));
const PricingTiers = lazy(() => import("@/web/components/PricingTiers"));

const legacySections: Record<string, string> = {
  "#pricing": "/planes", "#planes": "/planes", "#ver-app": "/como-funciona#demo",
  "#como-funciona": "/como-funciona", "#equipo": "/equipo", "#faq": "/preguntas-frecuentes",
};

/** Panel de ejemplo para cada acto de «Cómo funciona»: imita la interfaz, no la sustituye. */
function StepPanel({ children }: { children: React.ReactNode }) {
  return <div aria-hidden="true" className="rounded-[28px] bg-card p-6 text-left shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] ring-1 ring-white/5">{children}</div>;
}

export default function Index() {
  const { hash, search } = useLocation();
  const navigate = useNavigate();
  const pricingRef = useRef<HTMLElement>(null);
  const plans = usePlanAvailability();
  const faqs = landingFaqs(plans);
  const destination = legacySections[hash];
  useEffect(() => { if (!destination) track("landing_view"); }, [destination]);
  useEffect(() => {
    const el = pricingRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { track("pricing_view", { source: "landing" }); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [destination]);
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const [finalVisible, setFinalVisible] = useState(false);
  // Secciones que ya tienen su propio botón principal: con la barra fija encima,
  // tapaba la pantalla de la demo y el botón de las guías.
  const [ownCtaInView, setOwnCtaInView] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = ["demo", "guias"].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!targets.length) return;
    const visible = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setOwnCtaInView(visible.size > 0);
    }, { rootMargin: "-15% 0px -15% 0px" });
    targets.forEach((target) => io.observe(target));
    return () => io.disconnect();
  }, [destination]);
  useEffect(() => {
    const el = finalCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setFinalVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [destination]);
  useEffect(() => {
    const el = heroCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [destination]);
  const selectPlan = (plan: PlanKey) => {
    track("plan_select", { plan, source: "landing" });
    navigate(plan === "free" ? "/onboarding" : `/signup?plan=${plan}`);
  };
  if (destination) {
    const [pathname, anchor] = destination.split("#");
    return <Navigate replace to={{ pathname, search, hash: anchor ? `#${anchor}` : "" }} />;
  }
  return <PublicLayout title={LANDING_META.title} description={landingDescription(plans)}>

    <Helmet>
<script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Autopilot",
          serviceType: plans.coach
            ? "Entrenamiento y nutrición online personalizados, con atención personal del fundador en el plan Coach"
            : "Entrenamiento y nutrición online personalizados",
          provider: { "@type": "Organization", name: "Autopilot", url: "https://autopilotplan.com/" },
          areaServed: { "@type": "Country", name: "España" },
          offers: plans.plans.map((p) => ({ "@type": "Offer", name: p.name, price: String(p.price), priceCurrency: "EUR", url: "https://autopilotplan.com/planes" })),
        })}</script>
<script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Autopilot",
          url: "https://autopilotplan.com/",
          description: plans.coach
            ? "App de entrenamiento y nutrición que se adapta a tu progreso, con análisis corporal por IA y atención personal del fundador en el plan Coach, para toda España."
            : "App de entrenamiento y nutrición que se adapta a tu progreso, con análisis corporal por IA, para toda España.",
          founder: { "@type": "Person", name: "Nicolás San Marcos" },
          logo: "https://autopilotplan.com/pwa-512.png",
          areaServed: { "@type": "Country", name: "España" },
          address: { "@type": "PostalAddress", addressCountry: "ES" },
          availableLanguage: ["es"],
          contactPoint: [{ "@type": "ContactPoint", contactType: "Atención al cliente", availableLanguage: ["es"], areaServed: "ES" }],
        })}</script>
<script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Autopilot",
          url: "https://autopilotplan.com/",
          inLanguage: "es-ES",
        })}</script>
<script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        })}</script>
    </Helmet>
    {/* 1 · Hero */}
    <section className="relative flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden px-5 pb-10 pt-10 sm:px-8 sm:pt-16 lg:pt-8">
      {/* Halo dorado muy tenue detrás del teléfono: da profundidad sin competir con el producto. */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[38%] h-[44rem] w-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.16),transparent)] lg:left-[72%]" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div className="text-center animate-in fade-in duration-700 motion-reduce:animate-none lg:text-left">
          <h1 className="font-rounded text-[40px] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[60px] lg:text-[64px] xl:text-[76px]"><span className="block">Entrena con plan.</span> <span className="block">Registra cada serie.</span> <span className="block text-primary">Mira cómo progresas.</span></h1>
          <p className="mx-auto mt-6 max-w-md type-body text-muted-foreground md:text-[21px] md:leading-[29px] lg:mx-0">Tu rutina según tu objetivo, tus días y tu material. En el gimnasio o en casa.</p>
          <div ref={heroCtaRef} className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Button variant="hero" size="lg" asChild className="w-full sm:w-auto sm:px-9"><Link to="/onboarding" onClick={() => { void hapticTap(); track("cta_click", { cta: "free_signup", source: "hero" }); }}>Crear mi rutina gratis</Link></Button>
            <Button variant="plain" size="lg" asChild><a href="#demo" onClick={() => { void hapticTap(); track("plan_preview_view", { source: "hero" }); }}>Probar la demo</a></Button>
          </div>
          <p className="mt-4 type-footnote text-muted-foreground">Free sin tarjeta y sin caducidad · Web y móvil</p>
          <AppStoreBadges size="compact" className="mt-6 lg:items-start lg:[&_.justify-center]:justify-start" align="center" />
        </div>
        <HeroPhoneMotion><div className="origin-top sm:scale-110 lg:scale-[1.18]"><PublicHeroPhone /></div></HeroPhoneMotion>
      </div>
    </section>

    {/* 3 · Ventajas reales, en bloques editoriales */}
    <Benefits />

    {/* 4 · Guías en PDF: de pila a abanico, con precios reales */}
    <BookShowcase />

    {/* 6 · Cómo funciona, en tres actos */}
    <StickySteps eyebrow="Cómo funciona" steps={[
      { icon: SlidersHorizontal, title: "Personaliza.", text: "Tu objetivo, nivel, días y material.", visual: <StepPanel>{[["Objetivo", "Ganar músculo"], ["Nivel", "Intermedio"], ["Días", "4 por semana"], ["Material", "Gimnasio"]].map(([k, v]) => <div key={k} className="flex items-center justify-between py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border/50"><span className="type-subhead text-muted-foreground">{k}</span><span className="type-headline">{v}</span></div>)}</StepPanel> },
      { icon: Dumbbell, title: "Entrena.", text: "Consulta tu rutina y registra las series de cada sesión.", visual: <div aria-hidden="true" className="h-[42rem] overflow-hidden rounded-[28px] bg-background"><PublicTrainingScreen active /></div> },
      { icon: LineChart, title: "Progresa.", text: "Revisa tu historial, récords y volumen.", visual: <div aria-hidden="true" className="h-[34rem] overflow-hidden rounded-[28px] bg-background"><PublicProgressScreen /></div> },
    ]} />

    {/* 6b · Demo interactiva */}
    <section id="demo" aria-label="Demo interactiva" className="scroll-mt-20 pt-10 sm:pt-16">
      <Suspense fallback={<div className="h-[560px]" aria-hidden="true" />}>
        <ProductPreview onPlans={() => document.getElementById("precios")?.scrollIntoView({ behavior: "smooth" })} onFree={() => { track("cta_click", { cta: "free_signup", source: "demo" }); navigate("/onboarding"); }} />
      </Suspense>
    </section>

    {/* 7 · Plan gratuito y resto de planes */}
    <section id="precios" ref={pricingRef} aria-labelledby="precios-titulo" className="scroll-mt-20 px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <h2 id="precios-titulo" className="mx-auto max-w-4xl text-center type-display"><ScrollWords text="Empieza gratis." accent="Sin tarjeta." /></h2>
        <p className="mx-auto mt-5 max-w-2xl text-center type-body text-muted-foreground md:text-[21px] md:leading-[28px]">Crea tu rutina, registra tus entrenamientos y sigue tu progreso. {plans.plus && <>{plans.plusName} te dice qué comer y cuánto peso subir. </>}{plans.coach && <>{plans.coachName} añade a Nicolás revisando tu plan.</>}</p>
        <div className="mt-12"><FreePlanSection /></div>
        {(plans.plus || plans.coach) && <h3 className="mt-20 text-center type-title1">¿Quieres que la app haga más por ti?</h3>}
        <div className="mt-8">
          <Suspense fallback={<div className="h-[520px]" aria-hidden="true" />}>
            <PricingTiers onSelect={selectPlan} hideFree />
          </Suspense>
        </div>
        <p className="mt-6 text-center"><Link to="/planes" className="inline-flex min-h-11 items-center type-body text-primary transition-opacity active:opacity-60">Ver la comparativa completa</Link></p>
      </div>
    </section>


    {/* 8 · Confianza: fundador, dudas y CTA final */}
    <section aria-labelledby="fundador-titulo" className="px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <h2 id="fundador-titulo" className="type-display-sm"><ScrollWords text="Quién está detrás" /></h2>
          <p className="mt-4 type-body text-muted-foreground">Soy Nicolás San Marcos, fundador y desarrollador de Autopilot. Lo construyo yo{plans.coach ? <>, y en el plan {plans.coachName} también soy yo quien revisa tu plan y te responde {COACH_CONTACT_CHANNEL}</> : null}. Quería una app que te diga qué hacer hoy sin complicarte.</p>
          <p className="mt-3 type-footnote text-muted-foreground">Es un proyecto de una persona{plans.coach ? ". Por eso las respuestas no son inmediatas ni 24/7." : ": cada mejora sale de lo que me cuentan quienes entrenan con Autopilot."}</p>
        </div>
        <div>
          <h2 className="type-title2">Dudas frecuentes</h2>
          <Accordion type="single" collapsible className="mt-4 rounded-media bg-card px-4 [&>:last-child]:border-b-0">
            {faqs.map((f, i) => <AccordionItem key={f.q} value={`f${i}`}><AccordionTrigger className="min-h-12 text-left">{f.q}</AccordionTrigger><AccordionContent>{f.a}</AccordionContent></AccordionItem>)}
          </Accordion>
          <Link to="/preguntas-frecuentes" className="mt-2 inline-flex min-h-11 items-center type-body text-primary transition-opacity active:opacity-60">Ver todas las dudas</Link>
        </div>
      </div>
      <div ref={finalCtaRef} className="mx-auto mt-28 max-w-4xl text-center sm:mt-40">
        <h2 className="type-display"><ScrollWords text="Empieza a entrenar con" accent="Autopilot" /></h2>
        <p className="mt-4 type-body text-muted-foreground md:text-[21px]">Gratis y sin tarjeta.</p>
        <Button variant="hero" size="lg" asChild className="mt-8 w-full sm:w-auto sm:px-12"><Link to="/onboarding" onClick={() => { void hapticTap(); track("cta_click", { cta: "free_signup", source: "final" }); }}>Crear mi rutina gratis</Link></Button>
        <AppStoreBadges className="mt-8" label="También en tu móvil" />
      </div>
    </section>

    {/* CTA fija en móvil cuando el quiz del hero ya no se ve */}
    {showSticky && !finalVisible && !ownCtaInView && <div className="fixed inset-x-0 bottom-0 z-40 bg-background/90 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur sm:hidden animate-in slide-in-from-bottom-full duration-300">
      <Button variant="hero" size="lg" asChild className="w-full"><Link to="/onboarding" onClick={() => { void hapticTap(); track("cta_click", { cta: "free_signup", source: "sticky" }); }}>Crear mi rutina gratis</Link></Button>
    </div>}
  </PublicLayout>;
}
