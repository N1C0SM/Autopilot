import { ShieldCheck, User, Check, ArrowRight } from "lucide-react";
import { Menu, BookOpen, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ScrollReveal from "@/components/ScrollReveal";
import { track } from "@/lib/analytics";
import { rememberBookPurchase, withBookRef } from "@/lib/buyLink";
import BookCover from "@/components/BookCover";
import BookPreviewModal, { type PreviewBook } from "@/components/BookPreviewModal";
import TrainersSection from "@/components/TrainersSection";
import ProductPreview from "@/components/ProductPreview";
import { TIERS } from "@/config/tiers";

// Bajo el fold → lazy. No bloquea el render inicial de la landing.
const ComparisonTable = lazy(() => import("@/components/ComparisonTable"));
const PricingTiers = lazy(() => import("@/components/PricingTiers"));
import LandingConversionBento from "@/components/LandingConversionBento";

const SectionFallback = () => <div className="min-h-[200px]" aria-hidden />;
import type { PlanKey } from "@/config/tiers";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "¿Qué diferencia hay entre Gratis y tener entrenador?", a: "Gratis incluye una rutina inicial y el registro de tus entrenamientos y progreso, sin tarjeta. Con Entrenamiento, una persona prepara tu plan, lo revisa cada 2 semanas y responde por chat en 48h. Completo añade nutrición personalizada, revisión semanal y respuesta en 24h." },
  { q: "¿La demo me crea una cuenta o me cobra?", a: "No. La demo es un ejemplo interactivo con datos ficticios. Puedes explorarla sin registrarte. Para guardar tus propios entrenamientos, crea una cuenta Gratis." },
  { q: "¿Qué ocurre al terminar los 7 días de prueba?", a: "En los planes de pago, la suscripción se renueva automáticamente por 29€/mes o 49€/mes según el plan. Cancela antes de terminar la prueba para evitar el primer cobro, desde Ajustes → Suscripción. El plan Gratis no tiene una prueba que cancelar." },
  { q: "¿El análisis inicial es gratis?", a: "Sí. El AI Physique Scan es un análisis inicial 100% gratis, sin tarjeta y sin necesidad de crear una cuenta." },
  { q: "¿Necesito tarjeta para hacer el análisis?", a: "No. Solo necesitas una foto. El tiempo del análisis puede variar; el plan y el seguimiento empiezan cuando eliges un plan con entrenador." },
  { q: "¿Qué pasa después del scan?", a: "Recibes un análisis visual inicial. Si eliges un plan, un entrenador real estudia tu caso, habla contigo y prepara tu entrenamiento; la nutrición personalizada se incluye en Completo." },
  { q: "¿Puedo elegir solo entrenamiento?", a: "Sí. El plan Entrenamiento (29€/mes) es para quien solo quiere entrenar mejor, sin nutrición personalizada." },
  { q: "¿El plan Completo incluye nutrición?", a: "Sí. El Completo (49€/mes) incluye entrenamiento y plan de nutrición adaptados, además de chat y ajustes semanales." },
  { q: "¿Quién prepara y ajusta mi plan?", a: "Un entrenador real. La IA solo sirve como herramienta de apoyo para el análisis inicial; no diseña tu plan, no lo reorganiza y no responde a tus mensajes." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Los planes mensuales se renuevan automáticamente hasta que cancelas desde Ajustes → Suscripción." },
  { q: "¿Y si entreno en casa?", a: "Sin problema. Indicas tu equipamiento exacto y tu entrenador prepara el plan sobre esa base: calistenia, mancuernas en casa o cero material." },
  { q: "¿Y si nunca he entrenado?", a: "Tu entrenador parte de tu nivel real y te guía paso a paso, sin saltar fases." },
  { q: "¿En qué se diferencia esto de ChatGPT o de una rutina de YouTube?", a: "ChatGPT te da un texto, YouTube te da una rutina genérica. Aquí hay una persona real que conoce tu nivel, tu equipamiento y tu semana, y ajusta el plan contigo cada vez que algo cambia." },
  { q: "¿Y si me voy de viaje o pierdo una semana?", a: "Lo avisas por chat y reorganizamos. Tu entrenador puede ajustar el plan a tu disponibilidad. Si hay una lesión, consulta con un profesional sanitario antes de continuar." },
  { q: "¿Y si veo que no es para mí?", a: "Empieza con el plan Gratis sin tarjeta. Si quieres seguimiento, prueba un plan de pago durante 7 días y cancela antes del primer cobro." },
];

const Index = () => {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState<Array<{
    name: string; result: string; text: string; photo_url: string | null;
    photo_before_url: string | null; photo_after_url: string | null;
  }>>([]);
  const [trainer] = useState({ trainer_name: "Tu entrenador", trainer_photo_url: "", trainer_bio: "" });
  const [heroVideo, setHeroVideo] = useState<{ url: string; poster: string }>({ url: "", poster: "" });
  const [stats, setStats] = useState<{ paid: number; activePct: number | null }>({ paid: 0, activePct: null });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sections, setSections] = useState({ show_blog: true, show_ebooks: false, show_recommendations: false });
  const [ebooks, setEbooks] = useState<PreviewBook[]>([]);
  const [previewBook, setPreviewBook] = useState<PreviewBook | null>(null);
  const [recommendations, setRecommendations] = useState<Array<{ id?: string; title: string; description: string; image_url: string; url: string; badge: string }>>([]);
  const [latestPosts, setLatestPosts] = useState<Array<{ slug: string; title: string; excerpt: string | null; cover_url: string | null; published_at: string | null }>>([]);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowStickyCta(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const run = async () => {
      const [{ data: t }, settingsRes, statsRes] = await Promise.all([
        supabase.from("site_testimonials").select("name, result, text, photo_url, photo_before_url, photo_after_url").eq("visible", true).order("sort_order"),
        (supabase.rpc as any)("get_public_settings"),
        (supabase.rpc as any)("get_public_stats"),
      ]);
      const s = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;
      if (t && t.length > 0) setTestimonials(t as any);
      if (s) {

        setHeroVideo({
          url: (s as any).hero_video_url || "",
          poster: (s as any).hero_video_poster_url || "",
        });
        setSections({
          show_blog: (s as any).show_blog ?? true,
          show_ebooks: (s as any).show_ebooks ?? false,
          show_recommendations: (s as any).show_recommendations ?? false,
        });
        Promise.all([
          (supabase.rpc as any)("get_payment_mode"),
          (supabase as any)
            .from("library_books")
            .select("id, title, description, price, cover_path, buy_url, buy_url_test, buy_url_live, is_pack")
            .eq("published", true)
            .eq("is_folder", false)
            .order("sort_order", { ascending: true }),
        ]).then(([modeRes, { data }]: any) => {
          const live = modeRes?.data === "live";
          setEbooks(
            (data || []).map((b: any) => ({
              id: b.id,
              title: b.title,
              description: b.description || "",
              cover_url: b.cover_path?.startsWith("http") ? b.cover_path : "",
              url: (live ? b.buy_url_live : b.buy_url_test) ? withBookRef(live ? b.buy_url_live : b.buy_url_test, b.id) : "",
              price: b.price || "",
              is_pack: !!b.is_pack,
            })),
          );
        });
        setRecommendations(Array.isArray((s as any).recommendations) ? (s as any).recommendations : []);
        if ((s as any).show_blog ?? true) {
          supabase
            .from("blog_posts")
            .select("slug, title, excerpt, cover_url, published_at")
            .eq("published", true)
            .order("published_at", { ascending: false })
            .limit(3)
            .then(({ data }) => { if (data) setLatestPosts(data as any); });
        }
      }
      const row = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
      const paid = Number(row?.paid_count ?? 0);
      const active = Number(row?.active_count ?? 0);
      setStats({
        paid,
        activePct: paid > 0 ? Math.round((active / paid) * 100) : null,
      });
    };
    // Deferimos a idle: no compite con el primer paint.
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => { run(); }, { timeout: 2000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 300);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    track("landing_view");
  }, []);

  useEffect(() => {
    const pricing = document.getElementById("pricing");
    if (!pricing || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        track("pricing_view", { source: "landing_section" });
        observer.disconnect();
      }
    });
    observer.observe(pricing);
    return () => observer.disconnect();
  }, []);

  const goScan = (source: string) => {
    track("cta_click", { cta: "scan", source });
    navigate("/scan");
  };

  const goFree = (source: string) => {
    track("cta_click", { cta: "free_signup", source });
    navigate("/onboarding");
  };

  const goToPricing = (source = "landing") => {
    track("cta_click", { cta: "view_plans", source });
    const el = document.getElementById("pricing");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectPlan = (plan: PlanKey) => {
    track("plan_select", { plan, source: "landing_pricing" });
    navigate(`/signup?plan=${plan}`);
  };

  return (
    <div className="min-h-screen bg-background relative">
      <Helmet>
        <title>Autopilot — Entrenamiento con entrenador real</title>
        <meta name="description" content="Un entrenador real prepara y ajusta tu entrenamiento. Chat directo y nutrición personalizada según el plan. Análisis inicial gratis con IA." />
        <link rel="canonical" href="https://autopilotplan.com/" />
        <meta property="og:title" content="Autopilot — Tu entrenamiento, en manos de un entrenador real" />
        <meta property="og:description" content="Tu entrenador prepara y ajusta tu plan contigo. La IA solo apoya el análisis inicial gratuito." />
        <meta property="og:url" content="https://autopilotplan.com/" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Coaching fitness online con entrenador humano",
          provider: { "@type": "Organization", name: "Autopilot", url: "https://autopilotplan.com/" },
          areaServed: "ES",
          offers: [
            { "@type": "Offer", name: "Entrenamiento", price: "29", priceCurrency: "EUR" },
            { "@type": "Offer", name: "Completo", price: "49", priceCurrency: "EUR" },
            { "@type": "Offer", name: "Gratis", price: "0", priceCurrency: "EUR" },
          ],
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Autopilot",
          url: "https://autopilotplan.com/",
          description: "Entrenamiento y nutrición personalizados con seguimiento de un entrenador real, para toda España.",
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

      </Helmet>

      {/* Nav */}
      <nav className="app-chrome fixed top-0 w-full z-50 border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <span className="font-display text-xl font-bold text-gradient">Autopilot</span>

          {/* Desktop nav */}
          <div className="hidden sm:flex gap-3 items-center">
            <button onClick={() => goToPricing("landing_button")} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
              Planes
            </button>
            <Link to="/recursos" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
              Recursos
            </Link>
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Iniciar sesión
            </Button>
            <Button variant="default" size="sm" onClick={() => goFree("header")}>
              Empezar gratis
            </Button>
          </div>

          {/* Mobile nav */}
          <div className="flex sm:hidden items-center gap-2">
            <Button variant="default" size="sm" onClick={() => goFree("header_mobile")} className="text-xs px-3">
              Empezar gratis
            </Button>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  aria-label="Abrir menú"
                  className="w-10 h-10 inline-flex items-center justify-center rounded-md border border-border bg-card/50 hover:bg-card transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[78vw] max-w-xs p-6 flex flex-col gap-2">
                <span className="font-display text-xl font-bold text-gradient mb-6">Autopilot</span>
                <button
                  onClick={() => { setMobileMenuOpen(false); setTimeout(() => goToPricing("mobile_menu"), 50); }}
                  className="text-left py-3 px-3 rounded-md text-base font-medium hover:bg-muted/60 transition-colors"
                >
                  Planes
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate("/recursos"); }}
                  className="text-left py-3 px-3 rounded-md text-base font-medium hover:bg-muted/60 transition-colors"
                >
                  Recursos
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate("/login"); }}
                  className="text-left py-3 px-3 rounded-md text-base font-medium hover:bg-muted/60 transition-colors"
                >
                  Iniciar sesión
                </button>
                <Button
                  variant="default"
                  size="lg"
                  className="mt-4 w-full"
                  onClick={() => { setMobileMenuOpen(false); goFree("menu"); }}
                >
                  Empezar gratis
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      <main>
        {/* HERO */}
        <section className="relative px-4 pb-12 pt-28 sm:pb-14 sm:pt-32">
          <div className="container mx-auto max-w-5xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.08] px-3 py-1.5 animate-fade-in">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                  Tu rutina · tus entrenamientos · tu progreso
                </span>
              </div>

              <h1 className="font-display text-[2.5rem] font-bold leading-[1.05] sm:text-5xl lg:text-6xl animate-fade-in">
                Empieza a entrenar gratis. <span className="text-gradient">Hazlo tuyo.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg animate-fade-in">
                Crea tu cuenta, empieza con una rutina y guarda tus entrenamientos. Cuando necesites seguimiento, podrás contratar a tu entrenador desde la app.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-in">
                <Button variant="hero" size="xl" onClick={() => goFree("hero")} className="w-full sm:w-auto">
                  Ver planes con entrenador <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="xl" asChild className="w-full sm:w-auto">
                  <a href="#ver-app" onClick={() => track("plan_preview_view", { source: "hero" })}>Probar la demo sin registro</a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Sin tarjeta · Sin prueba que cancelar · Entrenador opcional de pago</p>
              <button type="button" onClick={() => goScan("hero_secondary")} className="mt-3 min-h-11 text-xs text-primary underline underline-offset-4">
                También puedes hacer el análisis inicial con IA gratis
              </button>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-[1.35fr_0.65fr]">
              {heroVideo.url ? (
                <div className="overflow-hidden rounded-lg border border-border bg-card premium-shadow">
                  <video key={heroVideo.url} src={heroVideo.url} poster={heroVideo.poster || undefined} autoPlay muted loop playsInline controls preload="none" className="aspect-video w-full object-cover" />
                </div>
              ) : (
                <div className="grid min-h-[220px] place-items-center rounded-lg border border-border bg-card p-7 text-center">
                  <div>
                    <p className="font-display text-2xl font-bold">Entrena con una dirección clara.</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Sabrás qué hacer hoy, por qué lo haces y a quién escribir si algo no encaja.</p>
                  </div>
                </div>
              )}

              <aside className="flex flex-col justify-between rounded-lg border border-primary/30 bg-secondary p-6 text-left">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Quién te acompaña</p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15"><User className="h-5 w-5 text-primary" /></span>
                    <div>
                      <p className="font-display font-bold">El equipo de Autopilot</p>
                      <p className="text-xs text-muted-foreground">Entrenamiento y seguimiento personal</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Nicolás dirige Autopilot. Tu entrenador prepara el plan y te acompaña en el seguimiento.</p>
                  <a href="#equipo" className="mt-4 inline-block text-sm text-primary underline underline-offset-4">Conocer al equipo</a>
                </div>
                {stats.paid >= 20 && (
                  <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                    <strong className="text-foreground">{stats.paid} alumnos</strong>{stats.activePct ? ` · ${stats.activePct}% siguen activos` : ""}
                  </p>
                )}
              </aside>
            </div>
          </div>
        </section>

        <ProductPreview onPlans={() => goToPricing("demo")} onFree={() => goFree("demo")} />

        <LandingConversionBento
          trainer={trainer}
          testimonials={testimonials}
          onStart={() => goFree("coaching_example")}
        />

        <TrainersSection />

        {/* COMPARISON — antes de precios para contextualizar el valor */}
        <Suspense fallback={<SectionFallback />}>
          <ComparisonTable />
        </Suspense>

        {/* PRICING */}
        <section id="pricing" className="py-16 px-4 bg-card/30 border-y border-border scroll-mt-20">
          <div className="container mx-auto">
            <ScrollReveal>
              <div className="text-center mb-12 max-w-xl mx-auto">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
                  Planes
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3 leading-tight">
                  Empieza gratis. Añade seguimiento cuando lo necesites.
                </h2>
                <p className="text-sm text-muted-foreground">
                  Entrena por tu cuenta gratis o prueba 7 días con un entrenador que prepare y revise tu plan.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <Suspense fallback={<SectionFallback />}>
                <PricingTiers onSelect={selectPlan} recommended="training" />
              </Suspense>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <div className="mx-auto mt-8 max-w-2xl border-t border-border pt-6 text-center">
                <p className="text-sm font-semibold">¿Quieres probar la app antes de hablar de planes?</p>
                <p className="mt-1 text-xs text-muted-foreground">Crea una cuenta gratis, completa tu perfil y prueba una sesión desde el móvil.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/onboarding")}>
                  Crear cuenta gratis <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </ScrollReveal>

            {/* GARANTÍA — línea única (antes 3 tarjetas de "7 días gratis") */}
            <ScrollReveal delay={0.15}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-success" /> Gestiona la cancelación desde Ajustes → Suscripción</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-success" /> Planes mensuales con renovación automática</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-success" /> Pago seguro con Stripe</span>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* RECURSOS — guías y recomendaciones reales del administrador */}
        {((sections.show_ebooks && ebooks.length > 0) || (sections.show_recommendations && recommendations.length > 0)) && (
          <section className="py-14 px-4 border-t border-border">
            <div className="container mx-auto max-w-5xl">
              <ScrollReveal>
                <div className="text-center mb-10 max-w-xl mx-auto">
                  <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Recursos</p>
                  <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
                    Complementa tu plan <span className="text-gradient">con lo que sí funciona.</span>
                  </h2>
                </div>
              </ScrollReveal>

              {sections.show_ebooks && ebooks.length > 0 && (
                <div className="mb-12">
                  <div className="flex items-end justify-between gap-4 mb-5">
                    <h3 className="font-display font-bold text-xl flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" /> Guías
                    </h3>
                    <Link to="/recursos" className="text-sm text-primary font-semibold hover:underline inline-flex items-center gap-1 shrink-0">
                      Ver todas <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {ebooks.slice(0, 3).map((e, i) => (
                      <ScrollReveal key={e.id || i} delay={i * 0.05}>
                        <button
                          type="button"
                          onClick={() => { setPreviewBook(e); track("book_preview_open", { book: e.title, source: "home" }); }}
                          className="group flex flex-col h-full w-full text-left bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors"
                        >

                          <div className="px-5 pt-5">
                            <BookCover title={e.title || "Guía de Autopilot"} src={e.cover_url} />
                          </div>
                          <div className="p-5 flex-1 flex flex-col">
                            <h4 className="font-display font-bold leading-snug group-hover:text-primary transition-colors">{e.title}</h4>
                            {e.description && (
                              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed flex-1">{e.description}</p>
                            )}
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                              <span className="text-sm font-semibold text-primary">{e.price || "Gratis"}</span>
                              <span className="text-xs text-muted-foreground inline-flex items-center gap-1 group-hover:text-primary transition-colors">
                                Ver guía <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                              </span>
                            </div>
                          </div>
                        </button>
                      </ScrollReveal>
                    ))}
                  </div>
                  <BookPreviewModal
                    book={previewBook}
                    pack={ebooks.find((b) => b.is_pack && b.url) || null}
                    onClose={() => setPreviewBook(null)}
                  />
                </div>
              )}

              {sections.show_recommendations && recommendations.length > 0 && (
                <div>
                  <div className="flex items-end justify-between gap-4 mb-5">
                    <h3 className="font-display font-bold text-xl flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-primary" /> Recomendaciones
                    </h3>
                    <Link to="/recursos" className="text-sm text-primary font-semibold hover:underline inline-flex items-center gap-1 shrink-0">
                      Ver todas <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {recommendations.slice(0, 3).map((r, i) => (
                      <ScrollReveal key={r.id || i} delay={i * 0.05}>
                        <a
                          href={r.url || "/recursos"}
                          target={r.url ? "_blank" : undefined}
                          rel={r.url ? "noreferrer sponsored" : undefined}
                          className="group flex items-start gap-3 h-full bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors"
                        >
                          {r.image_url ? (
                            <img
                              src={r.image_url}
                              alt={r.title || "Producto recomendado"}
                              loading="lazy"
                              className="w-16 h-16 rounded-xl object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-secondary shrink-0 flex items-center justify-center">
                              <ShoppingBag className="w-5 h-5 text-primary/60" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            {r.badge && (
                              <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1">
                                {r.badge}
                              </span>
                            )}
                            <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">{r.title}</h4>
                            {r.description && (
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">{r.description}</p>
                            )}
                          </div>
                        </a>
                      </ScrollReveal>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}


        {/* FAQ */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-2xl">
            <ScrollReveal>
              <div className="text-center mb-10">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Antes de empezar</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display">
                  Lo que la gente nos pregunta
                </h2>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <Accordion type="single" collapsible className="space-y-1">
                {(showAllFaqs ? faqs : faqs.slice(0, 5)).map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-b border-border last:border-b-0">
                    <AccordionTrigger className="text-base font-medium hover:no-underline py-5 text-left">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground pb-5 leading-relaxed">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {!showAllFaqs && (
                <div className="text-center mt-6">
                  <Button variant="outline" size="sm" onClick={() => setShowAllFaqs(true)}>
                    Ver todas las preguntas ({faqs.length})
                  </Button>
                </div>
              )}
            </ScrollReveal>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="relative py-20 px-4 overflow-hidden bg-card/30 border-t border-border">
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.08] blur-[160px]" />
          </div>
          <div className="container mx-auto max-w-2xl text-center">
            <ScrollReveal>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display mb-6 leading-[1.05] tracking-tight">
                Tu primer paso:{" "}
                <span className="text-gradient">crear tu cuenta gratis.</span>
              </h2>
              <p className="text-base text-muted-foreground mb-10 max-w-md mx-auto">
                Empieza con tu rutina y registra tu progreso. Si después quieres que un entrenador te acompañe, elige el seguimiento que necesites.
              </p>
              <Button
                variant="hero"
                size="xl"
                onClick={() => goFree("footer")}
                className="hover-scale shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] text-base px-8 group"
              >
                Crear mi cuenta gratis
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Cuenta gratis</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Sin tarjeta</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Entrenador opcional</span>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="pt-10 pb-28 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl flex flex-col gap-8 text-muted-foreground text-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span><span className="font-display font-bold text-gradient">Autopilot</span> &copy; {new Date().getFullYear()}</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center">
            <Link to="/login" className="hover:text-foreground transition-colors">Iniciar sesión</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Registro</Link>
            <Link to="/connect" className="hover:text-foreground transition-colors">Conectar con IA</Link>
            <Link to="/recursos" className="hover:text-foreground transition-colors">Recursos</Link>
            <Link to="/legal/aviso-legal" className="hover:text-foreground transition-colors">Aviso legal</Link>
            <Link to="/legal/terminos" className="hover:text-foreground transition-colors">Términos</Link>
            <Link to="/legal/privacidad" className="hover:text-foreground transition-colors">Privacidad</Link>
            <Link to="/legal/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
            <Link to="/legal/disclaimer-medico" className="hover:text-foreground transition-colors">Disclaimer médico</Link>
          </div>
          </div>
        </div>
      </footer>

      {/* Floating CTA mobile */}
      <div className={`fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-md border-t border-border z-50 md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-all duration-300 ${
        showStickyCta ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}>
        <Button variant="hero" size="lg" className="w-full" onClick={() => goFree("sticky_mobile")}>
          Crear mi cuenta gratis
        </Button>
      </div>

      {/* Sticky CTA desktop — aparece al pasar el hero */}
      <div
        className={`hidden md:block fixed bottom-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          showStickyCta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl px-5 py-3 premium-shadow">
          <div className="text-left">
            <div className="text-sm font-semibold">Empieza a entrenar gratis</div>
            <div className="text-[11px] text-muted-foreground">Guarda tu progreso · Sin tarjeta</div>
          </div>
          <Button variant="hero" size="lg" onClick={() => goFree("sticky_desktop")} className="group whitespace-nowrap">
            Crear cuenta gratis
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
