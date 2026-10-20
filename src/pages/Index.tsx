import { Dumbbell, LineChart, SlidersHorizontal } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import PublicLayout from "@/components/PublicLayout";
import { track } from "@/lib/analytics";
import { COACH_CONTACT_CHANNEL, type PlanKey } from "@/config/tiers";
import { usePlanAvailability } from "@/lib/planCatalog";
import { LANDING_META, landingDescription, landingFaqs } from "@/lib/publicCopy";
import PublicHeroPhone from "@/components/PublicHeroPhone";
import { hapticTap } from "@/lib/native";

const ProductPreview = lazy(() => import("@/components/ProductPreview"));
const PricingTiers = lazy(() => import("@/components/PricingTiers"));
const PlanDifferences = lazy(() => import("@/components/PlanDifferences"));

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
    <section className="px-5 pt-10 sm:px-8 sm:pt-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="type-large-title sm:text-[48px] sm:leading-[52px] md:text-[64px] md:leading-[68px]"><span className="block">Tu entrenamiento.</span> <span className="block">Tu nutrición.</span> <span className="block text-primary">Tu progreso.</span></h1>
        <p className="mx-auto mt-5 max-w-md type-body text-muted-foreground md:max-w-xl md:text-[21px] md:leading-[28px]">Crea tu rutina según tu objetivo, tus días y tu material. Registra cada serie y mira cómo avanzas, en el gimnasio o en casa.</p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col items-stretch gap-1 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-3">
          <Button variant="hero" size="lg" asChild className="sm:px-10"><Link to="/onboarding" onClick={() => { void hapticTap(); track("cta_click", { cta: "free_signup", source: "hero" }); }}>Crear mi rutina gratis</Link></Button>
          <Button variant="plain" size="lg" asChild><a href="#demo" onClick={() => { void hapticTap(); track("plan_preview_view", { source: "hero" }); }}>Probar la demo</a></Button>
        </div>
        <p className="mt-4 type-footnote text-muted-foreground">Free sin tarjeta y sin caducidad · Web y móvil</p>
      </div>
      <div className="mt-12 sm:mt-14"><PublicHeroPhone /></div>
    </section>

    {/* 2 · Demo */}
    <section id="demo" aria-label="Demo interactiva" className="scroll-mt-20 pt-14 sm:pt-20">
      <Suspense fallback={<div className="h-[560px]" aria-hidden="true" />}>
        <ProductPreview onPlans={() => document.getElementById("precios")?.scrollIntoView({ behavior: "smooth" })} onFree={() => { track("cta_click", { cta: "free_signup", source: "demo" }); navigate("/onboarding"); }} />
      </Suspense>
    </section>

    {/* 3 · Precios */}
    <section id="precios" ref={pricingRef} aria-labelledby="precios-titulo" className="scroll-mt-20 px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <h2 id="precios-titulo" className="type-title1 sm:text-[40px] sm:leading-[44px]">{plans.campaign ? "Empieza gratis, sin tarjeta." : "Empieza gratis. Paga solo si te aporta."}</h2>
        <p className="mt-3 max-w-2xl type-body text-muted-foreground">Gratis: crea tu rutina, registra tus entrenamientos y sigue tu progreso. {plans.plus && <>{plans.plusName} te dice qué comer y cuánto peso subir. </>}{plans.coach && <>{plans.coachName} añade a Nicolás revisando tu plan.</>}</p>
        <div className="mt-8">
          <Suspense fallback={<div className="h-[520px]" aria-hidden="true" />}>
            <PricingTiers onSelect={selectPlan} />
          </Suspense>
        </div>
        <p className="mt-6 text-center"><Link to="/planes" className="inline-flex min-h-11 items-center type-body text-primary transition-opacity active:opacity-60">Ver la comparativa completa</Link></p>
      </div>
    </section>

    {/* 3b · Diferencias entre planes (nuevo, más visible) */}
    <PlanDifferences />

    {/* 4 · Cómo funciona */}
    <section aria-labelledby="como-titulo" className="px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <h2 id="como-titulo" className="type-title1 sm:text-[40px] sm:leading-[44px]">Cómo funciona</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3 md:gap-10">
          {[
            [SlidersHorizontal, "Personaliza", "Objetivo, nivel, días, lesiones y material: gimnasio, casa o calistenia."],
            [Dumbbell, "Entrena", "Sigue tu sesión y apunta kg y repeticiones de cada serie."],
            [LineChart, "Progresa", plans.campaign ? "Consulta récords, volumen y peso. La siguiente carga se calcula con tus registros." : `Consulta récords, volumen y peso.${plans.plus ? ` En ${plans.plusName}, la carga siguiente se calcula con tus registros.` : ""}`],
          ].map(([Icon, title, text]) => { const I = Icon as typeof Dumbbell; return <li key={title as string} className="flex items-start gap-4">
            <span className="flex w-10 shrink-0 justify-center pt-0.5"><I className="h-7 w-7 text-primary" strokeWidth={1.75} aria-hidden="true" /></span>
            <div className="min-w-0">
              <h3 className="type-headline">{title as string}</h3>
              <p className="mt-1 type-subhead text-muted-foreground">{text as string}</p>
            </div>
          </li>; })}
        </ol>
        <p className="mt-8 max-w-2xl type-footnote text-muted-foreground">La rutina y la progresión usan reglas de entrenamiento fijas y comprobables. La IA se usa donde aporta: en el análisis corporal por foto.</p>
      </div>
    </section>

    {/* 5 · Fundador + FAQ + CTA */}
    <section aria-labelledby="fundador-titulo" className="px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <h2 id="fundador-titulo" className="type-title1 sm:text-[40px] sm:leading-[44px]">Quién está detrás</h2>
          <p className="mt-4 type-body text-muted-foreground">Soy Nicolás San Marcos, fundador y desarrollador de Autopilot. Lo construyo yo{plans.coach ? <>, y en el plan {plans.coachName} también soy yo quien revisa tu plan y te responde {COACH_CONTACT_CHANNEL}</> : null}. Quería una app que te diga qué hacer hoy sin complicarte.</p>
          <p className="mt-3 type-footnote text-muted-foreground">Es un proyecto de una persona{plans.coach ? ". Por eso las respuestas no son inmediatas ni 24/7." : ": cada mejora sale de lo que me cuentan quienes entrenan con Autopilot."}</p>
        </div>
        <div>
          <h2 className="type-title2">Dudas frecuentes</h2>
          <Accordion type="single" collapsible className="mt-4 rounded-2xl bg-card px-4 [&>:last-child]:border-b-0">
            {faqs.map((f, i) => <AccordionItem key={f.q} value={`f${i}`}><AccordionTrigger className="min-h-12 text-left">{f.q}</AccordionTrigger><AccordionContent>{f.a}</AccordionContent></AccordionItem>)}
          </Accordion>
          <Link to="/preguntas-frecuentes" className="mt-2 inline-flex min-h-11 items-center type-body text-primary transition-opacity active:opacity-60">Ver todas las dudas</Link>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-md text-center sm:mt-24">
        <h2 className="type-title1 sm:text-[40px] sm:leading-[44px]">Empieza a entrenar con Autopilot</h2>
        <p className="mt-2 type-body text-muted-foreground">Gratis y sin tarjeta.</p>
        <Button variant="hero" size="lg" asChild className="mt-6 w-full sm:w-auto sm:px-10"><Link to="/onboarding" onClick={() => { void hapticTap(); track("cta_click", { cta: "free_signup", source: "final" }); }}>Crear mi rutina gratis</Link></Button>
      </div>
    </section>
  </PublicLayout>;
}
