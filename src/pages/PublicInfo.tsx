import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import PublicLayout from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { publicFaqs, publicPageMeta } from "@/lib/publicCopy";
import { usePlanAvailability } from "@/lib/planCatalog";
import { track } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import type { PlanKey } from "@/config/tiers";

const PricingTiers = lazy(() => import("@/components/PricingTiers"));
const ComparisonTable = lazy(() => import("@/components/ComparisonTable"));
const ProductPreview = lazy(() => import("@/components/ProductPreview"));
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
  return <section className="mx-auto max-w-4xl px-5 pb-10"><h2 className="mb-5 font-display text-2xl font-bold">Experiencias de nuestros alumnos</h2>
    {items.map((item, index) => <blockquote key={`${item.name}-${index}`} className="border-t border-border py-5"><p className="leading-relaxed">“{item.text}”</p><footer className="mt-3 text-sm text-muted-foreground">{item.name} · {item.result}</footer></blockquote>)}
  </section>;
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
  return <div className="mx-auto max-w-4xl px-5 pb-8"><video src={video.url} poster={video.poster || undefined} controls playsInline preload="metadata" aria-label="Presentación de Autopilot" className="aspect-video w-full rounded-lg bg-card" /></div>;
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
    <div className="mx-auto max-w-6xl px-5 pb-8 pt-10 sm:pt-14">
      <Link to="/" className="mb-5 inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground active:opacity-70">← Inicio</Link>
      <h1 className="font-display text-3xl font-bold sm:text-5xl">{info.title}</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">{info.description}</p>
    </div>
    <Suspense fallback={<p role="status" className="px-5 py-10 text-center text-muted-foreground">Cargando…</p>}>
      {page === "plans" && <section className="mx-auto max-w-6xl px-5 pb-10" aria-label="Elige tu plan">
        <PricingTiers onSelect={selectPlan} />
        {plans.coach && <details className="mt-8 border-y border-border"><summary className="min-h-11 cursor-pointer py-4 font-medium">¿Qué tipo de ayuda necesito?</summary><ComparisonTable /></details>}
        <p className="mt-6 text-sm text-muted-foreground">Los planes mensuales se renuevan automáticamente. Gestiona la cancelación desde Ajustes → Suscripción. <Link to="/preguntas-frecuentes" className="text-primary underline">Resolver dudas</Link></p>
      </section>}
      {page === "how" && <>
        <ol className="mx-auto grid max-w-6xl gap-6 px-5 pb-10 md:grid-cols-3">
          {[
            ["Cuéntanos tu objetivo", "Indica tu nivel, el material y los días que puedes entrenar."],
            ["Crea tu rutina", `Empieza gratis.${plans.plus ? ` Si quieres nutrición y progresión de cargas automática, elige ${plans.plusName}.` : ""}${plans.coach ? ` ${plans.coachName} añade a Nicolás revisando tu plan.` : ""}`],
            ["Registra y progresa", "Guarda tus series y compara tus entrenamientos para ver cómo avanzas."],
          ].map(([title, text], index) => <li key={title} className="border-t border-border pt-4"><span className="text-sm text-primary">0{index + 1}</span><h2 className="mt-2 font-display text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></li>)}
        </ol>
        <ExplainerVideo />
        <div id="demo" className="scroll-mt-20"><ProductPreview onPlans={() => navigate("/planes")} onFree={() => navigate("/onboarding")} /></div>
        <p className="mx-auto max-w-6xl px-5 pb-8 text-sm text-muted-foreground">También puedes <Link to="/scan" className="text-primary underline">hacer el análisis inicial con IA</Link>.</p>
      </>}
      {page === "team" && <><TrainersSection /><TeamTestimonials /></>}
      {page === "faq" && <section className="mx-auto max-w-3xl px-5 pb-10" aria-label="Respuestas">
        <Helmet><script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(faq => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) })}</script></Helmet>
        <Accordion type="single" collapsible>{faqs.map((faq, index) => <AccordionItem key={faq.q} value={`faq-${index}`}><AccordionTrigger className="min-h-11 text-left">{faq.q}</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">{faq.a}</AccordionContent></AccordionItem>)}</Accordion>
      </section>}
    </Suspense>
    <div className="border-t border-border px-5 py-8 text-center"><Button variant="hero" size="lg" asChild><Link to="/onboarding">Crear mi rutina gratis</Link></Button></div>
  </PublicLayout>;
}
