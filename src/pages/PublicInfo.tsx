import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ClipboardList, LineChart, Target } from "lucide-react";
import { Helmet } from "react-helmet-async";
import PublicLayout from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { publicFaqs, publicPageMeta } from "@/lib/publicCopy";
import { usePlanAvailability } from "@/lib/planCatalog";
import { track } from "@/lib/analytics";
import { hapticTap } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";
import type { PlanKey } from "@/config/tiers";

const PricingTiers = lazy(() => import("@/components/PricingTiers"));
const ComparisonTable = lazy(() => import("@/components/ComparisonTable"));
const ProductPreview = lazy(() => import("@/components/ProductPreview"));
const PlanDifferences = lazy(() => import("@/components/PlanDifferences"));
const TrainersSection = lazy(() => import("@/components/TrainersSection"));
type Page = keyof ReturnType<typeof publicPageMeta>;

function TeamTestimonials() {
  const [items, setItems] = useState<Array<{ name: string; result: string; text: string }>>([]);
  useEffect(() => {
    let active = true;
    void supabase.from("site_testimonials").select("name, result, text").eq("visible", true).order("sort_order").limit(3)
      .then(({ data }) => { if (active) setItems(data || []); });
    return () => { active = false; };
  }, []);
  if (!items.length) return null;
  return <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8"><div className="max-w-3xl"><h2 className="mb-3 type-title2">Experiencias de nuestros alumnos</h2>
    {items.map((item, index) => <blockquote key={`${item.name}-${index}`} className="sep-t py-5"><p className="type-body">“{item.text}”</p><footer className="mt-2 type-footnote text-muted-foreground">{item.name} · {item.result}</footer></blockquote>)}
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
  return <div className="mx-auto max-w-6xl px-5 pb-8 sm:px-8"><video src={video.url} poster={video.poster || undefined} controls playsInline preload="metadata" aria-label="Presentación de Autopilot" className="aspect-video w-full max-w-4xl rounded-2xl bg-card" /></div>;
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
    <div className="mx-auto max-w-6xl px-5 pb-8 pt-10 sm:px-8 sm:pt-16">
      <h1 className="type-large-title sm:text-[48px] sm:leading-[52px]">{info.title}</h1>
      <p className="mt-4 max-w-2xl type-body text-muted-foreground">{info.description}</p>
    </div>
    <Suspense fallback={<div className="flex justify-center py-16"><Spinner size="lg" /></div>}>
      {page === "plans" && <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8" aria-label="Elige tu plan">
        <PricingTiers onSelect={selectPlan} />
        <Suspense fallback={<div className="h-32" aria-hidden="true" />}>
          <PlanDifferences />
        </Suspense>
        {plans.coach && <details className="group mt-8 rounded-2xl bg-card px-4"><summary className="flex min-h-12 list-none items-center justify-between gap-3 py-3 type-body transition-opacity active:opacity-60 [&::-webkit-details-marker]:hidden">¿Qué tipo de ayuda necesito?<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ease-ios group-open:rotate-180" aria-hidden="true" /></summary><ComparisonTable /></details>}
        <p className="mt-6 type-footnote text-muted-foreground">Los planes mensuales se renuevan automáticamente. Gestiona la cancelación desde Ajustes → Suscripción. <Link to="/preguntas-frecuentes" className="text-primary">Resolver dudas</Link></p>
      </section>}
      {page === "how" && <>
        <ol className="mx-auto grid max-w-6xl gap-6 px-5 pb-10 sm:px-8 md:grid-cols-3 md:gap-10">
          {[
            [Target, "Cuéntanos tu objetivo", "Indica tu nivel, el material y los días que puedes entrenar."],
            [ClipboardList, "Crea tu rutina", `Empieza gratis.${plans.plus ? ` Si quieres nutrición y progresión de cargas automática, elige ${plans.plusName}.` : ""}${plans.coach ? ` ${plans.coachName} añade a Nicolás revisando tu plan.` : ""}`],
            [LineChart, "Registra y progresa", "Guarda tus series y compara tus entrenamientos para ver cómo avanzas."],
          ].map(([Icon, title, text]) => { const I = Icon as typeof Target; return <li key={title as string} className="flex items-start gap-4">
            <span className="flex w-10 shrink-0 justify-center pt-0.5"><I className="h-7 w-7 text-primary" strokeWidth={1.75} aria-hidden="true" /></span>
            <div className="min-w-0"><h2 className="type-headline">{title as string}</h2><p className="mt-1 type-subhead text-muted-foreground">{text as string}</p></div>
          </li>; })}
        </ol>
        <ExplainerVideo />
        <div id="demo" className="scroll-mt-20"><Suspense fallback={<div className="h-[560px]" aria-hidden="true" />}><ProductPreview onPlans={() => navigate("/planes")} onFree={() => navigate("/onboarding")} /></Suspense></div>
        <p className="mx-auto max-w-6xl px-5 pb-8 type-subhead text-muted-foreground sm:px-8">También puedes <Link to="/scan" className="text-primary">hacer el análisis inicial con IA</Link>.</p>
      </>}
      {page === "team" && <><TrainersSection /><TeamTestimonials /></>}
      {page === "faq" && <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8" aria-label="Respuestas">
        <Helmet><script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(faq => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) })}</script></Helmet>
        <Accordion type="single" collapsible className="max-w-3xl rounded-2xl bg-card px-4 [&>:last-child]:border-b-0">{faqs.map((faq, index) => <AccordionItem key={faq.q} value={`faq-${index}`}><AccordionTrigger className="min-h-11 text-left">{faq.q}</AccordionTrigger><AccordionContent>{faq.a}</AccordionContent></AccordionItem>)}</Accordion>
      </section>}
    </Suspense>
    <div className="px-5 py-14 text-center"><Button variant={page === "plans" ? "tinted" : "hero"} size="lg" asChild className="w-full max-w-sm sm:w-auto sm:px-10"><Link to="/onboarding" onClick={() => void hapticTap()}>Crear mi rutina gratis</Link></Button></div>
  </PublicLayout>;
}
