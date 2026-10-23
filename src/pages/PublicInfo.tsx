import ScrollWords from "@/components/ScrollWords";
import PageHero from "@/components/PageHero";
import FinalCta from "@/components/FinalCta";
import StickySteps from "@/components/StickySteps";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ClipboardList, LineChart, Target } from "lucide-react";
import { Helmet } from "react-helmet-async";
import PublicLayout from "@/components/PublicLayout";
import { Spinner } from "@/components/ui/spinner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { publicFaqs, publicPageMeta } from "@/lib/publicCopy";
import { usePlanAvailability } from "@/lib/planCatalog";
import { track } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import type { PlanKey } from "@/config/tiers";

const PricingTiers = lazy(() => import("@/components/PricingTiers"));
const ComparisonTable = lazy(() => import("@/components/ComparisonTable"));
const ProductPreview = lazy(() => import("@/components/ProductPreview"));
const PlanDifferences = lazy(() => import("@/components/PlanDifferences"));
const TrainersSection = lazy(() => import("@/components/TrainersSection"));
type Page = keyof ReturnType<typeof publicPageMeta>;
const EYEBROW: Record<Page, string> = { plans: "Planes", how: "Cómo funciona", team: "Equipo", faq: "Preguntas frecuentes" };

function TeamTestimonials() {
  const [items, setItems] = useState<Array<{ name: string; result: string; text: string }>>([]);
  useEffect(() => {
    let active = true;
    void supabase.from("site_testimonials").select("name, result, text").eq("visible", true).order("sort_order").limit(3)
      .then(({ data }) => { if (active) setItems(data || []); });
    return () => { active = false; };
  }, []);
  if (!items.length) return null;
  return <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8"><div className="mx-auto max-w-3xl"><h2 className="mb-6 text-center type-display-sm"><ScrollWords text="Experiencias de nuestros alumnos" /></h2>
    {items.map((item, index) => <blockquote key={`${item.name}-${index}`} className="sep-t py-5"><p className="type-title3 font-medium">“{item.text}”</p><footer className="mt-2 type-footnote text-muted-foreground">{item.name} · {item.result}</footer></blockquote>)}
  </div></section>;
}

function ExplainerVideo() {
  const [video, setVideo] = useState({ url: "", poster: "" });
  useEffect(() => {
    let active = true;
    void supabase.rpc("get_public_settings").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (active && row) setVideo({ url: row.hero_video_url || "", poster: row.hero_video_poster_url || "" });
    });
    return () => { active = false; };
  }, []);
  if (!video.url) return null;
  return <div className="mx-auto max-w-5xl px-5 pb-16 sm:px-8"><video src={video.url} poster={video.poster || undefined} controls playsInline preload="metadata" aria-label="Presentación de Autopilot" className="aspect-video w-full rounded-[28px] bg-card shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)]" /></div>;
}

export default function PublicInfo({ page }: { page: Page }) {
  const navigate = useNavigate();
  const plans = usePlanAvailability();
  const info = publicPageMeta(plans)[page];
  const faqs = page === "faq" ? publicFaqs(plans) : [];
  useEffect(() => { if (page === "plans") track("pricing_view", { source: "plans_page" }); }, [page]);
  const selectPlan = (plan: PlanKey) => {
    track("plan_select", { plan, source: "plans_page" });
    navigate(plan === "free" ? "/onboarding" : `/signup?plan=${plan}`);
  };
  return <PublicLayout title={info.title} description={info.description}>
    <PageHero eyebrow={EYEBROW[page]} title={info.title}>{info.description}</PageHero>
    <Suspense fallback={<div className="flex justify-center py-16"><Spinner size="lg" /></div>}>
      {page === "plans" && <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8" aria-label="Elige tu plan">
        <PricingTiers onSelect={selectPlan} />
        <Suspense fallback={<div className="h-32" aria-hidden="true" />}>
          <PlanDifferences />
        </Suspense>
        {plans.coach && <details className="group mt-8 rounded-2xl bg-card px-4"><summary className="flex min-h-12 list-none items-center justify-between gap-3 py-3 type-body transition-opacity active:opacity-60 [&::-webkit-details-marker]:hidden">¿Qué tipo de ayuda necesito?<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ease-ios group-open:rotate-180" aria-hidden="true" /></summary><ComparisonTable /></details>}
        <p className="mx-auto mt-8 max-w-2xl text-center type-footnote text-muted-foreground">Los planes mensuales se renuevan automáticamente. Gestiona la cancelación desde Ajustes → Suscripción. <Link to="/preguntas-frecuentes" className="text-primary">Resolver dudas</Link></p>
      </section>}
      {page === "how" && <>
        <StickySteps eyebrow="Tres pasos" steps={[
          { icon: Target, title: "Cuéntanos tu objetivo.", text: "Indica tu nivel, el material y los días que puedes entrenar." },
          { icon: ClipboardList, title: "Crea tu rutina.", text: `Empieza gratis.${plans.plus ? ` Si quieres nutrición y progresión de cargas automática, elige ${plans.plusName}.` : ""}${plans.coach ? ` ${plans.coachName} añade a Nicolás revisando tu plan.` : ""}` },
          { icon: LineChart, title: "Registra y progresa.", text: "Guarda tus series y compara tus entrenamientos para ver cómo avanzas." },
        ]} />
        <ExplainerVideo />
        <div id="demo" className="scroll-mt-20"><Suspense fallback={<div className="h-[560px]" aria-hidden="true" />}><ProductPreview onPlans={() => navigate("/planes")} onFree={() => navigate("/onboarding")} /></Suspense></div>
        <p className="mx-auto max-w-6xl px-5 pb-8 pt-10 text-center type-subhead text-muted-foreground sm:px-8">También puedes <Link to="/scan" className="text-primary">hacer el análisis inicial con IA</Link>.</p>
      </>}
      {page === "team" && <><TrainersSection /><TeamTestimonials /></>}
      {page === "faq" && <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8" aria-label="Respuestas">
        <Helmet><script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(faq => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) })}</script></Helmet>
        <Accordion type="single" collapsible className="mx-auto max-w-3xl rounded-[28px] bg-card px-5 sm:px-8 [&>:last-child]:border-b-0">{faqs.map((faq, index) => <AccordionItem key={faq.q} value={`faq-${index}`}><AccordionTrigger className="min-h-14 text-left type-headline">{faq.q}</AccordionTrigger><AccordionContent>{faq.a}</AccordionContent></AccordionItem>)}</Accordion>
      </section>}
    </Suspense>
    <FinalCta source={`page_${page}`} />
  </PublicLayout>;
}
