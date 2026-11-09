import ScrollWords from "@/web/components/ScrollWords";
import PageHero from "@/web/components/PageHero";
import FinalCta from "@/web/components/FinalCta";
import StickySteps from "@/web/components/StickySteps";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ClipboardList, LineChart, Target } from "lucide-react";
import { Helmet } from "react-helmet-async";
import PublicLayout from "@/web/components/PublicLayout";
import { Spinner } from "@/shared/components/ui/spinner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/components/ui/accordion";
import { publicFaqs, publicPageMeta } from "@/shared/lib/publicCopy";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import { track } from "@/shared/lib/analytics";
import { supabase } from "@/shared/integrations/supabase/client";
import type { PlanKey } from "@/shared/config/tiers";
import heroAthlete from "@/shared/assets/landing/hero-athlete.jpg";
import problemSunset from "@/shared/assets/landing/problem-sunset.jpg";
import finalHorizon from "@/shared/assets/landing/final-horizon.jpg";

const PricingTiers = lazy(() => import("@/web/components/PricingTiers"));
const ComparisonTable = lazy(() => import("@/web/components/ComparisonTable"));
const ProductPreview = lazy(() => import("@/web/components/ProductPreview"));
const PlanDifferences = lazy(() => import("@/web/components/PlanDifferences"));
const TrainersSection = lazy(() => import("@/web/components/TrainersSection"));
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
  return <div className="mx-auto max-w-5xl px-5 pb-16 sm:px-8"><video src={video.url} poster={video.poster || undefined} controls playsInline preload="metadata" aria-label="Presentación de Autopilot" className="aspect-video w-full rounded-2xl border border-border bg-card" /></div>;
}

const kicker = "text-[11px] font-bold uppercase tracking-[0.2em] text-primary";

function Engines({ plusName, plus }: { plusName: string; plus: boolean }) {
  const items = [
    { n: "01", img: heroAthlete, t: "Tracker híbrido real", s: "Barra, mancuernas, máquinas, anillas y dominadas en la misma sesión. Series, repeticiones, kilos y notas sin tener que elegir bando." },
    { n: "02", img: problemSunset, t: "Sobrecarga progresiva", s: `${plus ? `Con ${plusName}, ` : ""}el sistema mira lo que levantaste la última vez y te dice qué peso o repeticiones tocan hoy. Sin hacer cuentas.` },
    { n: "03", img: finalHorizon, t: "Nutrición y Scan", s: "Calorías y macros calculados para tu objetivo, y un análisis corporal por foto para que tu evolución sea medible." },
  ];
  return <section aria-label="Los tres motores" className="mx-auto max-w-6xl px-5 pb-14 sm:px-8">
    <p className={kicker}>Los tres motores</p>
    <div className="mt-6 grid gap-5 md:grid-cols-3">
      {items.map((i) => <article key={i.n} className="overflow-hidden rounded-[22px] bg-card">
        <img src={i.img} alt="" aria-hidden="true" loading="lazy" className="h-44 w-full object-cover opacity-80" />
        <div className="p-6"><p className="text-[13px] font-semibold tabular-nums text-foreground/50">{i.n}</p><h2 className="mt-1 text-[20px] font-bold">{i.t}</h2><p className="mt-2 text-[15px] leading-[22px] text-foreground/80">{i.s}</p></div>
      </article>)}
    </div>
  </section>;
}

function PlansTruth({ plusName, plus }: { plusName: string; plus: boolean }) {
  return <div className="mx-auto mb-10 grid max-w-4xl gap-4 sm:grid-cols-2">
    <div className="rounded-[22px] bg-card p-6"><p className={kicker}>Free</p><p className="mt-2 text-[17px] font-semibold">Si solo quieres registrar, no pagues un céntimo.</p><p className="mt-2 text-[14px] leading-[21px] text-foreground/75">Rutina híbrida según objetivo, material y días, y tu cuaderno con series, kilos, récords y peso. Sin tarjeta.</p></div>
    {plus && <div className="rounded-[22px] bg-card p-6"><p className={kicker}>{plusName}</p><p className="mt-2 text-[17px] font-semibold">Si quieres dejar de pensar.</p><p className="mt-2 text-[14px] leading-[21px] text-foreground/75">Te calcula el peso y las repeticiones de hoy con lo que hiciste la última vez, tus calorías y macros, y el scan corporal completo.</p></div>}
  </div>;
}

const FAQ_GROUPS: Array<{ t: string; test: RegExp }> = [
  { t: "Cuenta y suscripción", test: /prueba|cancelar|tarjeta|diferencia|incluye|plan |cobra|demo/i },
  { t: "Nutrición y Scan", test: /análisis|nutrici|scan|foto/i },
];

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
        <PlansTruth plus={plans.plus} plusName={plans.plusName} />
        <PricingTiers onSelect={selectPlan} />
        <Suspense fallback={<div className="h-32" aria-hidden="true" />}>
          <PlanDifferences />
        </Suspense>
        {plans.coach && <details className="group mt-8 rounded-media bg-card px-4"><summary className="flex min-h-12 list-none items-center justify-between gap-3 py-3 type-body transition-opacity active:opacity-60 [&::-webkit-details-marker]:hidden">¿Qué tipo de ayuda necesito?<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ease-ios group-open:rotate-180" aria-hidden="true" /></summary><ComparisonTable /></details>}
        <p className="mx-auto mt-8 max-w-2xl text-center type-footnote text-muted-foreground">Los planes mensuales se renuevan automáticamente. Gestiona la cancelación desde Ajustes → Suscripción. <Link to="/preguntas-frecuentes" className="text-primary">Resolver dudas</Link></p>
      </section>}
      {page === "how" && <>
        <Engines plus={plans.plus} plusName={plans.plusName} />
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
        <div className="mx-auto max-w-3xl space-y-10">{[...FAQ_GROUPS.map((g) => g.t), "Entrenamiento híbrido"].map((title) => {
          const group = faqs.filter((f) => (FAQ_GROUPS.find((g) => g.test.test(f.q))?.t ?? "Entrenamiento híbrido") === title);
          if (!group.length) return null;
          return <div key={title}><h2 className={kicker}>{title}</h2>
            <Accordion type="single" collapsible className="mt-3 rounded-[22px] bg-card px-5 sm:px-8 [&>:last-child]:border-b-0">{group.map((faq) => <AccordionItem key={faq.q} value={faq.q}><AccordionTrigger className="min-h-14 text-left type-headline">{faq.q}</AccordionTrigger><AccordionContent>{faq.a}</AccordionContent></AccordionItem>)}</Accordion></div>;
        })}
          <p className="text-center text-[14px] text-foreground/75">¿No está tu duda? Te responde directamente quien programa la app y entrena con ella.</p>
        </div>
      </section>}
    </Suspense>
    <FinalCta source={`page_${page}`} />
  </PublicLayout>;
}
