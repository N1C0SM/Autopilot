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
import { LandingHero, LandingExperience, LandingProblem, LandingWhy, LandingFinal } from "@/web/components/LandingSections";
import FreePlanSection from "@/web/components/FreePlanSection";
import { hapticTap } from "@/shared/lib/native";

const ProductPreview = lazy(() => import("@/web/components/ProductPreview"));
const PricingTiers = lazy(() => import("@/web/components/PricingTiers"));

const legacySections: Record<string, string> = {
  "#pricing": "/planes", "#planes": "/planes", "#ver-app": "/como-funciona#demo",
  "#como-funciona": "/como-funciona", "#equipo": "/equipo", "#faq": "/preguntas-frecuentes",
};

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
    <LandingHero ctaRef={heroCtaRef} />
    <LandingExperience />
    <LandingProblem />
    <LandingWhy />

    {/* 6b · Demo interactiva */}
    <section id="demo" aria-label="Demo interactiva" className="scroll-mt-20 py-14 sm:py-20">
      <Suspense fallback={<div className="h-[560px]" aria-hidden="true" />}>
        <ProductPreview onPlans={() => document.getElementById("precios")?.scrollIntoView({ behavior: "smooth" })} onFree={() => { track("cta_click", { cta: "free_signup", source: "demo" }); navigate("/onboarding"); }} />
      </Suspense>
    </section>

    {/* 7 · Plan gratuito y resto de planes */}
    <section id="precios" ref={pricingRef} aria-labelledby="precios-titulo" className="scroll-mt-20 px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-primary">Planes</p>
        <h2 id="precios-titulo" className="mx-auto mt-3 max-w-4xl text-center text-[32px] font-bold tracking-[-0.02em] sm:text-[44px]">Empieza gratis y decide después.</h2>
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
    <section aria-labelledby="fundador-titulo" className="px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <h2 id="fundador-titulo" className="type-display-sm">Quién está detrás</h2>
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
    </section>
    <LandingFinal innerRef={finalCtaRef} />

    {/* CTA fija en móvil cuando el quiz del hero ya no se ve */}
    {showSticky && !finalVisible && !ownCtaInView && <div className="fixed inset-x-0 bottom-0 z-40 bg-background/90 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur sm:hidden animate-in slide-in-from-bottom-full duration-300">
      <Button variant="hero" size="lg" asChild className="w-full"><Link to="/onboarding" onClick={() => { void hapticTap(); track("cta_click", { cta: "free_signup", source: "sticky" }); }}>Empezar gratis</Link></Button>
    </div>}
  </PublicLayout>;
}
