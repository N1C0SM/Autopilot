import {
  MessageCircle,
  ShieldCheck,
  Star,
  Image as ImageIcon,
  Send,
  User,
  Check,
  ArrowRight,
  ScanLine,
  Brain,
  Wrench,
  Repeat,
} from "lucide-react";
import { Menu, BookOpen, Sparkles, Newspaper, ExternalLink, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ScrollReveal from "@/components/ScrollReveal";
import { Award, Dumbbell, MessageSquare, Target } from "lucide-react";
import { track } from "@/lib/analytics";
import AppStoreBadges from "@/components/AppStoreBadges";

// Bajo el fold → lazy. No bloquea el render inicial de la landing.
const AIScanSection = lazy(() => import("@/components/AIScanSection"));
const PostScanFlow = lazy(() => import("@/components/PostScanFlow"));
const ComparisonTable = lazy(() => import("@/components/ComparisonTable"));
const PricingTiers = lazy(() => import("@/components/PricingTiers"));
const PremiumTransformation = lazy(() => import("@/components/PremiumTransformation"));
const TrainersSection = lazy(() => import("@/components/TrainersSection"));

const SectionFallback = () => <div className="min-h-[200px]" aria-hidden />;
import type { PlanKey } from "@/config/tiers";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const whyWorks = [
  { icon: Brain, title: "Diagnóstico claro", desc: "La IA te muestra qué deberías mejorar primero, sin generalidades." },
  { icon: Wrench, title: "Plan humano", desc: "Un entrenador real convierte ese diagnóstico en entrenamiento y nutrición." },
  { icon: Repeat, title: "Ajustes continuos", desc: "El plan cambia contigo según tus resultados, horarios y sensaciones." },
];

const faqs = [
  { q: "¿El diagnóstico es gratis?", a: "Sí. El AI Physique Scan es 100% gratis, sin tarjeta y sin necesidad de crear cuenta primero." },
  { q: "¿Necesito tarjeta para hacer el scan?", a: "No. Solo necesitas una foto. El resultado lo recibes en 60 segundos." },
  { q: "¿Qué pasa después del scan?", a: "Recibes un diagnóstico visual con tus prioridades. Si te interesa, eliges plan (Entrenamiento o Completo) y un entrenador real te construye un plan adaptado." },
  { q: "¿Puedo elegir solo entrenamiento?", a: "Sí. El plan Entrenamiento (29€/mes) es para quien solo quiere entrenar mejor, sin nutrición personalizada." },
  { q: "¿El plan Completo incluye nutrición?", a: "Sí. El Completo (49€/mes) incluye entrenamiento y plan de nutrición adaptados, además de chat y ajustes semanales." },
  { q: "¿Es IA o una persona?", a: "Ambas. La IA hace el diagnóstico inicial. Después es un entrenador humano quien diseña tu plan y responde a tus mensajes." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí. Sin permanencia. Cancelas en un clic desde tu cuenta cuando quieras." },
  { q: "¿La Transformación 12 semanas tiene prueba gratis?", a: "No tiene prueba gratis, pero incluye diagnóstico + llamada gratis con un asesor antes de empezar." },
  { q: "¿Y si entreno en casa?", a: "Sin problema. Indicas tu equipamiento exacto y se construye sobre eso. Calistenia, mancuernas en casa o cero material." },
  { q: "¿Y si nunca he entrenado?", a: "Mejor. El plan se construye desde tu nivel real y vamos paso a paso, sin saltar fases." },
  { q: "¿En qué se diferencia esto de ChatGPT o de una rutina de YouTube?", a: "ChatGPT te da un texto, YouTube te da una rutina genérica. Aquí hay una persona real que conoce tu nivel, tu equipamiento y tu semana, y ajusta el plan contigo cada vez que algo cambia." },
  { q: "¿Y si me voy de viaje o pierdo una semana?", a: "Lo avisas por chat y reorganizamos. El plan se adapta a viajes, lesiones o semanas malas sin que pierdas progreso." },
  { q: "¿Y si veo que no es para mí?", a: "Cancelas antes del día 7 desde tu cuenta y no se cobra nada. Sin llamadas, sin formularios, sin preguntas." },
];

const Index = () => {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState([
    { name: "María G.", result: "−7 kg en 4 meses", text: "Lo que más valoro no es el plan, es saber que puedo escribir cuando algo no encaja y al día siguiente está ajustado.", photo_url: null as string | null, photo_before_url: null as string | null, photo_after_url: null as string | null },
    { name: "Carlos R.", result: "+6 kg de músculo", text: "Antes empezaba algo nuevo cada mes. Ahora sigo el mismo camino y lo afinamos juntos.", photo_url: null, photo_before_url: null, photo_after_url: null },
    { name: "Laura M.", result: "Sin lesiones · 8 meses", text: "Tuve molestia en la rodilla y al día siguiente ya tenía el plan reajustado. Eso vale el precio solo.", photo_url: null, photo_before_url: null, photo_after_url: null },
  ]);
  const [trainer, setTrainer] = useState({ trainer_name: "Nicolás", trainer_photo_url: "", trainer_bio: "" });
  const [heroVideo, setHeroVideo] = useState<{ url: string; poster: string }>({ url: "", poster: "" });
  const [stats, setStats] = useState<{ paid: number; activePct: number | null }>({ paid: 0, activePct: null });
  const [contactEmail, setContactEmail] = useState("hola@autopilotplan.com");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sections, setSections] = useState({ show_blog: true, show_ebooks: false, show_recommendations: false });
  const [ebooks, setEbooks] = useState<Array<{ id?: string; title: string; description: string; cover_url: string; url: string; price: string }>>([]);
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
        setTrainer({
          trainer_name: s.trainer_name || "Nicolás",
          trainer_photo_url: s.trainer_photo_url || "",
          trainer_bio: s.trainer_bio || "",
        });
        if ((s as any).contact_email) setContactEmail((s as any).contact_email);
        setHeroVideo({
          url: (s as any).hero_video_url || "",
          poster: (s as any).hero_video_poster_url || "",
        });
        setSections({
          show_blog: (s as any).show_blog ?? true,
          show_ebooks: (s as any).show_ebooks ?? false,
          show_recommendations: (s as any).show_recommendations ?? false,
        });
        setEbooks(Array.isArray((s as any).ebooks) ? (s as any).ebooks : []);
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

  const goScan = (source: string) => {
    track("cta_click", { cta: "scan", source });
    navigate("/scan");
  };

  const goToPricing = () => {
    track("pricing_view", { source: "nav" });
    const el = document.getElementById("pricing");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectPlan = (plan: PlanKey) => {
    track("plan_select", { plan, source: "landing_pricing" });
    navigate(`/signup?plan=${plan}`);
  };

  const featured = testimonials[0];
  const rest = testimonials.slice(1, 3);

  return (
    <div className="min-h-screen bg-background relative">
      <Helmet>
        <title>Autopilot — Diagnóstico físico + coaching real</title>
        <meta name="description" content="Diagnóstico físico con IA en 60s. Un entrenador real lo convierte en tu plan de entrenamiento y nutrición. Primera semana gratis." />
        <link rel="canonical" href="https://autopilotplan.com/" />
        <meta property="og:title" content="Autopilot — Diagnóstico físico gratis + coaching real online" />
        <meta property="og:description" content="Diagnóstico con IA en 60s y un entrenador humano que lo convierte en plan. Primera semana gratis en planes mensuales." />
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
            { "@type": "Offer", name: "Transformación 12 semanas", price: "299", priceCurrency: "EUR" },
          ],
        })}</script>
      </Helmet>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <span className="font-display text-xl font-bold text-gradient">Autopilot</span>

          {/* Desktop nav */}
          <div className="hidden sm:flex gap-3 items-center">
            <button onClick={goToPricing} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
              Planes
            </button>
            <Link to="/guia-entrenamiento-casa" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
              Guía en casa
            </Link>
            <Link to="/recomendaciones" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
              Recomendaciones
            </Link>
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Iniciar sesión
            </Button>
            <Button variant="default" size="sm" onClick={() => goScan("landing")}>
              Diagnóstico gratis
            </Button>
          </div>

          {/* Mobile nav */}
          <div className="flex sm:hidden items-center gap-2">
            <Button variant="default" size="sm" onClick={() => goScan("landing")} className="text-xs px-3">
              Diagnóstico
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
                  onClick={() => { setMobileMenuOpen(false); setTimeout(goToPricing, 50); }}
                  className="text-left py-3 px-3 rounded-md text-base font-medium hover:bg-muted/60 transition-colors"
                >
                  Planes
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate("/guia-entrenamiento-casa"); }}
                  className="text-left py-3 px-3 rounded-md text-base font-medium hover:bg-muted/60 transition-colors"
                >
                  Guía en casa
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate("/recomendaciones"); }}
                  className="text-left py-3 px-3 rounded-md text-base font-medium hover:bg-muted/60 transition-colors"
                >
                  Recomendaciones
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
                  onClick={() => { setMobileMenuOpen(false); goScan("landing"); }}
                >
                  Diagnóstico gratis
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      <main>
        {/* HERO */}
        <section className="relative pt-28 sm:pt-32 pb-14 sm:pb-16 px-4 overflow-hidden">
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-primary/[0.07] blur-[160px]" />
          </div>

          <div className="container mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/[0.08] mb-7 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                Diagnóstico con IA + Entrenador real
              </span>
            </div>

            <h1
              style={{ animationDelay: "0.1s" }}
              className="text-[2.4rem] sm:text-5xl lg:text-6xl font-bold font-display leading-[1.05] mb-6 tracking-tight animate-fade-in"
            >
              De cero a un físico visible.{" "}
              <span className="text-gradient">Sin perderte entre apps.</span>
            </h1>

            <p
              style={{ animationDelay: "0.2s" }}
              className="text-base sm:text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed animate-fade-in"
            >
              Para hombres de 25 a 40 años que quieren ganar músculo de verdad. Un entrenador real diseña tu entrenamiento y nutrición, y los ajusta cada semana contigo por chat.
            </p>

            <div
              style={{ animationDelay: "0.3s" }}
              className="flex flex-col items-center animate-fade-in"
            >
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button
                  variant="hero"
                  size="xl"
                  onClick={() => goScan("landing")}
                  className="hover-scale shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] text-base px-8 group"
                >
                  <ScanLine className="w-4 h-4" />
                  Hacer mi diagnóstico gratis
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  variant="outline"
                  size="xl"
                  onClick={() => navigate("/onboarding")}
                  className="text-base px-8"
                >
                  Crear mi plan en 60s
                </Button>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Gratis</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Sin tarjeta</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> 60 segundos</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> 100% privado</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-success" />
                <span>Garantía 30 días · sin permanencia · cancelas en 1 clic</span>
              </div>

              <AppStoreBadges
                size="compact"
                label="También en tu móvil"
                className="mt-6 animate-fade-in"
              />
            </div>

            {/* Hero video (admin-managed) */}
            {heroVideo.url && (
              <div
                style={{ animationDelay: "0.4s" }}
                className="mt-12 mx-auto max-w-2xl animate-fade-in"
              >
                <div className="relative rounded-2xl overflow-hidden border border-border bg-black premium-shadow ring-1 ring-primary/20">
                  <video
                    key={heroVideo.url}
                    src={heroVideo.url}
                    poster={heroVideo.poster || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls
                    preload="metadata"
                    className="w-full aspect-video object-cover bg-black"
                  />
                </div>
              </div>
            )}

            {/* Trust strip */}
            <div
              style={{ animationDelay: "0.5s" }}
              className="mt-10 flex flex-col items-center gap-5 animate-fade-in"
            >
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {trainer.trainer_photo_url ? (
                  <img
                    src={trainer.trainer_photo_url}
                    alt={`${trainer.trainer_name}, fundador de Autopilot`}
                    loading="eager"
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/30"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center ring-2 ring-primary/30">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className="text-left">
                  <div className="font-semibold text-foreground text-xs">{trainer.trainer_name} · Fundador</div>
                  <div className="text-[11px] text-muted-foreground">Detrás de cada plan y cada mensaje</div>
                </div>
              </div>

              {stats.paid >= 20 && (
                <div className={`grid ${stats.activePct && stats.activePct > 0 ? "grid-cols-2" : "grid-cols-1"} gap-6 sm:gap-12 max-w-sm w-full`}>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold font-display text-gradient">{stats.paid}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">alumnos de pago</div>
                  </div>
                  {stats.activePct !== null && stats.activePct > 0 && (
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold font-display text-gradient">{stats.activePct}%</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">siguen activos</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* AI SCAN */}
        <Suspense fallback={<SectionFallback />}>
          <AIScanSection />
        </Suspense>

        {/* POST-SCAN FLOW */}
        <Suspense fallback={<SectionFallback />}>
          <PostScanFlow />
        </Suspense>

        {/* QUIÉN HAY DETRÁS */}
        <section className="py-14 px-4 border-t border-border">
          <div className="container mx-auto max-w-5xl">
            <ScrollReveal>
              <div className="grid md:grid-cols-[280px_1fr] gap-10 items-center">
                <div className="flex justify-center md:justify-start">
                  {trainer.trainer_photo_url ? (
                    <img
                      src={trainer.trainer_photo_url}
                      alt={`${trainer.trainer_name}, fundador y entrenador de Autopilot`}
                      loading="lazy"
                      className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl object-cover ring-2 ring-primary/30 premium-shadow"
                    />
                  ) : (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl bg-primary/15 flex items-center justify-center ring-2 ring-primary/30">
                      <User className="w-20 h-20 text-primary" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Quién hay detrás</p>
                  <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight mb-5">
                    Una persona real diseña{" "}
                    <span className="text-gradient">cada plan.</span>
                  </h2>
                  {trainer.trainer_bio ? (
                    <p className="text-base text-muted-foreground leading-relaxed mb-6 whitespace-pre-line">
                      {trainer.trainer_bio}
                    </p>
                  ) : (
                    <p className="text-base text-muted-foreground leading-relaxed mb-6">
                      Soy {trainer.trainer_name}. Llevo años entrenando a hombres que quieren empezar a ganar músculo en serio sin volverse adictos a una app o a un canal de YouTube. Aquí no hay rutinas genéricas: hay un método, hay seguimiento y hay alguien que responde cuando algo no encaja.
                    </p>
                  )}
                  <ul className="grid sm:grid-cols-2 gap-3 text-sm">
                    {[
                      { icon: Award, label: "Entrenador titulado, no influencer" },
                      { icon: Dumbbell, label: "Método claro para ganar músculo" },
                      { icon: MessageSquare, label: "Te responde la misma persona" },
                      { icon: Target, label: "Nicho: hombres 25–40 que empiezan" },
                    ].map((it) => (
                      <li key={it.label} className="flex items-center gap-3 text-foreground/90">
                        <span className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                          <it.icon className="w-4 h-4 text-primary" />
                        </span>
                        {it.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>

            {/* Por qué funciona — integrado para evitar una sección redundante */}
            <div className="mt-12 grid md:grid-cols-3 gap-4">
              {whyWorks.map((p, i) => (
                <ScrollReveal key={p.title} delay={i * 0.06}>
                  <div className="bg-card/50 border border-border rounded-2xl p-5 h-full hover:border-primary/30 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-3">
                      <p.icon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold text-sm mb-1.5">{p.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

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
                  Elige cómo quieres empezar
                </h2>
                <p className="text-sm text-muted-foreground">
                  Después del diagnóstico, te recomendaremos el plan que mejor encaja contigo.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <Suspense fallback={<SectionFallback />}>
                <PricingTiers onSelect={selectPlan} recommended="full" />
              </Suspense>
            </ScrollReveal>

            {/* GARANTÍA — línea única (antes 3 tarjetas de "7 días gratis") */}
            <ScrollReveal delay={0.15}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-success" /> Cancelas en 1 clic antes del día 7</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-success" /> Sin permanencia ni renovaciones sorpresa</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-success" /> Pago seguro con Stripe</span>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* PREMIUM TRANSFORMATION */}
        <Suspense fallback={<SectionFallback />}>
          <PremiumTransformation contactEmail={contactEmail} />
        </Suspense>

        {/* CHAT DEMO */}
        <section className="py-12 px-4 bg-card/30 border-y border-border">
          <div className="container mx-auto max-w-3xl">
            <ScrollReveal>
              <div className="text-center mb-7">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">El día a día</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4 leading-tight">
                  Hablas con una persona.{" "}
                  <span className="text-gradient">No con un ticket.</span>
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto text-sm">
                  La IA prepara el plan; tu entrenador lo revisa y te responde. Mensajes reales que ajustan tu semana.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <div className="bg-card rounded-2xl border border-border premium-shadow flex flex-col overflow-hidden max-w-xl mx-auto">
                <div className="flex items-center gap-2 p-3 border-b border-border">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary">
                    <MessageCircle className="w-4 h-4" /> Chat con tu entrenador
                  </div>
                  <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Respuesta &lt;12h
                  </span>
                </div>
                <div className="flex-1 overflow-hidden p-4 space-y-3 bg-background/20">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2 text-sm">
                      Esta semana solo puedo entrenar lunes, miércoles y viernes.
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-secondary text-foreground rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                      Perfecto. Te reorganizo el volumen en 3 días para que no pierdas progreso.
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2 text-sm">
                      Me molesta el hombro en press banca.
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-secondary text-foreground rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                      Cambiamos a press inclinado con mancuernas y bajamos carga esta semana. Luego revisamos sensaciones.
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2 items-center">
                    <button type="button" aria-label="Adjuntar imagen" className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:bg-secondary transition-colors">
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <div className="flex-1 h-9 px-3 flex items-center rounded-md border border-input bg-background text-sm text-muted-foreground">
                      Escribe un mensaje...
                    </div>
                    <button type="button" aria-label="Enviar" className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md bg-primary text-primary-foreground">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ENTRENADORES */}
        <Suspense fallback={<SectionFallback />}>
          <TrainersSection />
        </Suspense>

        {/* TESTIMONIOS */}
        <section className="py-16 px-4 bg-card/30 border-y border-border">
          <div className="container mx-auto max-w-3xl">
            <ScrollReveal>
              <div className="text-center mb-10">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
                  Resultados reales
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display">
                  No te vendemos esfuerzo.{" "}
                  <span className="text-gradient">Vendemos resultado.</span>
                </h2>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <blockquote className="text-center max-w-2xl mx-auto mb-16">
                <div className="flex justify-center gap-0.5 mb-5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                {featured.photo_before_url && featured.photo_after_url && (
                  <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center max-w-md mx-auto mb-8">
                    <div className="text-center">
                      <img src={featured.photo_before_url} alt={`${featured.name} antes`} loading="lazy" className="w-full aspect-[3/4] object-cover rounded-xl border border-border" />
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">Antes</div>
                    </div>
                    <div className="text-[11px] uppercase tracking-widest text-primary font-semibold">→</div>
                    <div className="text-center">
                      <img src={featured.photo_after_url} alt={`${featured.name} después`} loading="lazy" className="w-full aspect-[3/4] object-cover rounded-xl border border-primary/40 glow-shadow" />
                      <div className="text-[10px] uppercase tracking-wider text-primary mt-1.5">Después</div>
                    </div>
                  </div>
                )}
                <p className="text-2xl sm:text-3xl font-display font-medium leading-snug mb-8">
                  "{featured.text}"
                </p>
                <footer className="flex items-center justify-center gap-3 text-sm">
                  {featured.photo_url ? (
                    <img src={featured.photo_url} alt={`${featured.name}, alumna de Autopilot`} loading="lazy" width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {featured.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="font-semibold">{featured.name}</div>
                    <div className="text-xs text-primary">{featured.result}</div>
                  </div>
                </footer>
              </blockquote>
            </ScrollReveal>

            <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {rest.map((t, i) => (
                <ScrollReveal key={t.name + i} delay={i * 0.1}>
                  <div className="bg-card border border-border rounded-2xl p-5 h-full">
                    {t.photo_before_url && t.photo_after_url && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div>
                          <img src={t.photo_before_url} alt="" loading="lazy" className="w-full aspect-[3/4] object-cover rounded-lg" />
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1 text-center">Antes</div>
                        </div>
                        <div>
                          <img src={t.photo_after_url} alt="" loading="lazy" className="w-full aspect-[3/4] object-cover rounded-lg border border-primary/40" />
                          <div className="text-[9px] uppercase tracking-wider text-primary mt-1 text-center">Después</div>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className="w-3.5 h-3.5 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">"{t.text}"</p>
                    <div className="text-xs">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-primary"> · {t.result}</span>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* RECURSOS */}
        <section className="py-14 px-4 border-t border-border">
          <div className="container mx-auto max-w-5xl">
            <ScrollReveal>
              <div className="text-center mb-12 max-w-xl mx-auto">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Recursos</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
                  Complementa tu plan <span className="text-gradient">con lo que sí funciona.</span>
                </h2>
              </div>
            </ScrollReveal>
            <div className="grid gap-5 md:grid-cols-2">
              <ScrollReveal>
                <Link
                  to="/guia-entrenamiento-casa"
                  className="group block bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors h-full"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-xl mb-1.5 group-hover:text-primary transition-colors">
                    Guía de Entrenamiento en Casa
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Ebook con 6 módulos por zona corporal y progresión de 4 semanas. Sin material.
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Ver guía <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </ScrollReveal>
              <ScrollReveal delay={0.08}>
                <Link
                  to="/recomendaciones"
                  className="group block bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors h-full"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4">
                    <ShoppingBag className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-xl mb-1.5 group-hover:text-primary transition-colors">
                    Recomendaciones
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Material, suplementos, seguimiento y ropa técnica. Selección honesta, sin humo.
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Ver recomendaciones <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </ScrollReveal>
            </div>
          </div>
        </section>

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
                {(showAllFaqs ? faqs : faqs.slice(0, 7)).map((faq, i) => (
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
                Empieza por entender{" "}
                <span className="text-gradient">qué te falta.</span>
              </h2>
              <p className="text-base text-muted-foreground mb-10 max-w-md mx-auto">
                Diagnóstico físico gratis con IA. Después decides si quieres que un entrenador real lo convierta en plan.
              </p>
              <Button
                variant="hero"
                size="xl"
                onClick={() => goScan("landing")}
                className="hover-scale shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] text-base px-8 group"
              >
                <ScanLine className="w-4 h-4" />
                Hacer mi diagnóstico gratis
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Gratis</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Sin tarjeta</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> 60 segundos</span>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl flex flex-col gap-8 text-muted-foreground text-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span><span className="font-display font-bold text-gradient">Autopilot</span> &copy; {new Date().getFullYear()}</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center">
            <Link to="/login" className="hover:text-foreground transition-colors">Iniciar sesión</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Registro</Link>
            <Link to="/connect" className="hover:text-foreground transition-colors">Conectar con IA</Link>
            <Link to="/guia-entrenamiento-casa" className="hover:text-foreground transition-colors">Guía en casa</Link>
            <Link to="/recomendaciones" className="hover:text-foreground transition-colors">Recomendaciones</Link>
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
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-md border-t border-border z-50 md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="hero" size="lg" className="w-full" onClick={() => goScan("landing")}>
          <ScanLine className="w-4 h-4" /> Diagnóstico gratis
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
            <div className="text-sm font-semibold">Diagnóstico físico gratis en 60s</div>
            <div className="text-[11px] text-muted-foreground">Sin tarjeta · sin registro previo · 100% privado</div>
          </div>
          <Button variant="hero" size="lg" onClick={() => goScan("landing")} className="group whitespace-nowrap">
            <ScanLine className="w-4 h-4" />
            Empezar gratis
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
