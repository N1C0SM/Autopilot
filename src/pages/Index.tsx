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
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ScrollReveal from "@/components/ScrollReveal";
import PricingTiers from "@/components/PricingTiers";
import AIScanSection from "@/components/AIScanSection";
import TrainersSection from "@/components/TrainersSection";
import PostScanFlow from "@/components/PostScanFlow";
import PremiumTransformation from "@/components/PremiumTransformation";
import ComparisonTable from "@/components/ComparisonTable";
import { Award, Dumbbell, Calendar, MessageSquare, Target } from "lucide-react";
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
    { name: "María G.", result: "−7 kg en 4 meses", text: "Lo que más valoro no es el plan, es saber que puedo escribir cuando algo no encaja y al día siguiente está ajustado.", photo_url: null as string | null },
    { name: "Carlos R.", result: "+6 kg de músculo", text: "Antes empezaba algo nuevo cada mes. Ahora sigo el mismo camino y lo afinamos juntos.", photo_url: null },
    { name: "Laura M.", result: "Sin lesiones · 8 meses", text: "Tuve molestia en la rodilla y al día siguiente ya tenía el plan reajustado. Eso vale el precio solo.", photo_url: null },
  ]);
  const [trainer, setTrainer] = useState({ trainer_name: "Nicolás", trainer_photo_url: "", trainer_bio: "" });
  const [stats, setStats] = useState<{ paid: number; activePct: number | null }>({ paid: 0, activePct: null });
  const [contactEmail, setContactEmail] = useState("hola@autopilotplan.com");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: t }, settingsRes, statsRes] = await Promise.all([
        supabase.from("site_testimonials").select("name, result, text, photo_url").eq("visible", true).order("sort_order"),
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
      }
      const row = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
      const paid = Number(row?.paid_count ?? 0);
      const active = Number(row?.active_count ?? 0);
      setStats({
        paid,
        activePct: paid > 0 ? Math.round((active / paid) * 100) : null,
      });
    })();
  }, []);

  const goToPricing = () => {
    const el = document.getElementById("pricing");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectPlan = (plan: PlanKey) => {
    navigate(`/signup?plan=${plan}`);
  };

  const featured = testimonials[0];
  const rest = testimonials.slice(1, 3);

  return (
    <div className="min-h-screen bg-background relative">
      <Helmet>
        <title>Autopilot — Diagnóstico físico gratis + coaching real online</title>
        <meta name="description" content="Haz tu diagnóstico físico con IA en 60 segundos. Un entrenador real lo convierte en un plan de entrenamiento y nutrición a tu medida. Sin tarjeta. Primera semana gratis." />
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
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Iniciar sesión
            </Button>
            <Button variant="default" size="sm" onClick={() => navigate("/scan")}>
              Diagnóstico gratis
            </Button>
          </div>

          {/* Mobile nav */}
          <div className="flex sm:hidden items-center gap-2">
            <Button variant="default" size="sm" onClick={() => navigate("/scan")} className="text-xs px-3">
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
                  onClick={() => { setMobileMenuOpen(false); navigate("/login"); }}
                  className="text-left py-3 px-3 rounded-md text-base font-medium hover:bg-muted/60 transition-colors"
                >
                  Iniciar sesión
                </button>
                <Button
                  variant="default"
                  size="lg"
                  className="mt-4 w-full"
                  onClick={() => { setMobileMenuOpen(false); navigate("/scan"); }}
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
        <section className="relative pt-36 sm:pt-44 pb-24 sm:pb-32 px-4 overflow-hidden">
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-primary/[0.07] blur-[160px]" />
          </div>

          <div className="container mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/[0.08] mb-7"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                Diagnóstico con IA + Entrenador real
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[2.4rem] sm:text-5xl lg:text-6xl font-bold font-display leading-[1.05] mb-6 tracking-tight"
            >
              De cero a un físico visible.{" "}
              <span className="text-gradient">Sin perderte entre apps.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed"
            >
              Para hombres de 25 a 40 años que quieren ganar músculo de verdad. Un entrenador real diseña tu entrenamiento y nutrición, y los ajusta cada semana contigo por chat.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col items-center"
            >
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button
                  variant="hero"
                  size="xl"
                  onClick={() => navigate("/scan")}
                  className="hover-scale shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] text-base px-8 group"
                >
                  <ScanLine className="w-4 h-4" />
                  Hacer mi diagnóstico gratis
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  variant="outline"
                  size="xl"
                  onClick={goToPricing}
                  className="text-base px-8"
                >
                  Ver planes
                </Button>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Gratis</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Sin tarjeta</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> 60 segundos</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> 100% privado</span>
              </div>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-16 flex flex-col items-center gap-5"
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
            </motion.div>
          </div>
        </section>

        {/* AI SCAN */}
        <AIScanSection />

        {/* POST-SCAN FLOW */}
        <PostScanFlow />

        {/* QUIÉN HAY DETRÁS */}
        <section className="py-24 px-4 border-t border-border">
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
          </div>
        </section>

        {/* WHY IT WORKS */}
        <section className="py-24 px-4">
          <div className="container mx-auto max-w-5xl">
            <ScrollReveal>
              <div className="text-center mb-14 max-w-xl mx-auto">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Por qué funciona</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
                  No es una app.{" "}
                  <span className="text-gradient">Es seguimiento real.</span>
                </h2>
              </div>
            </ScrollReveal>
            <div className="grid md:grid-cols-3 gap-5">
              {whyWorks.map((p, i) => (
                <ScrollReveal key={p.title} delay={i * 0.08}>
                  <div className="bg-card/50 border border-border rounded-2xl p-6 h-full hover:border-primary/30 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4">
                      <p.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold text-base mb-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-24 px-4 bg-card/30 border-y border-border scroll-mt-20">
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
              <PricingTiers onSelect={selectPlan} recommended="full" />
            </ScrollReveal>

            {/* 7 DÍAS GRATIS — SISTEMA */}
            <ScrollReveal delay={0.15}>
              <div className="mt-16 max-w-4xl mx-auto">
                <div className="text-center mb-8">
                  <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Tus 7 días gratis</p>
                  <h3 className="text-2xl sm:text-3xl font-bold font-display leading-tight">
                    No es una prueba olvidada.{" "}
                    <span className="text-gradient">Es una semana acompañada.</span>
                  </h3>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { day: "Día 1", title: "Tu plan en marcha", desc: "Recibes el primer plan adaptado a tu nivel, equipamiento y horario real. Te explicamos por dónde empezar." },
                    { day: "Día 4", title: "Primer ajuste", desc: "Te escribimos para ver cómo van las primeras sesiones. Ajustamos cargas, ejercicios o nutrición si hace falta." },
                    { day: "Día 7", title: "Decides con datos", desc: "Revisamos juntos lo que funcionó y lo que no. Sigues solo si lo ves claro, sin renovaciones sorpresa." },
                  ].map((s, i) => (
                    <div key={s.day} className="bg-card border border-border rounded-2xl p-5 relative">
                      <div className="absolute -top-3 left-5 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tracking-wider">
                        {s.day.toUpperCase()}
                      </div>
                      <div className="flex items-center gap-2 mt-2 mb-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <h4 className="font-display font-semibold text-base">{s.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-muted-foreground mt-6">
                  Sin permanencia. Cancelas en un clic antes del día 7 y no se cobra nada.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* PREMIUM TRANSFORMATION */}
        <PremiumTransformation contactEmail={contactEmail} />

        {/* COMPARISON */}
        <ComparisonTable />

        {/* GARANTÍA / MID CTA */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-4xl">
            <ScrollReveal>
              <div className="relative rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-card/60 to-card/60 p-8 sm:p-12 overflow-hidden">
                <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center relative">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/[0.08] mb-4">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                        Garantía sin letra pequeña
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold font-display leading-tight mb-4">
                      Si en 7 días no ves que el plan encaja con tu vida,{" "}
                      <span className="text-gradient">no pagas nada.</span>
                    </h2>
                    <ul className="space-y-2 text-sm text-foreground/90">
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success shrink-0" /> Cancelas en 1 clic desde tu cuenta</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success shrink-0" /> Sin permanencia, sin renovaciones sorpresa</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success shrink-0" /> Pago seguro con Stripe</li>
                    </ul>
                  </div>
                  <div className="flex md:flex-col gap-3">
                    <Button
                      variant="hero"
                      size="xl"
                      onClick={() => navigate("/scan")}
                      className="hover-scale group whitespace-nowrap"
                    >
                      <ScanLine className="w-4 h-4" />
                      Empezar gratis
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                    <Button variant="outline" size="xl" onClick={goToPricing} className="whitespace-nowrap">
                      Ver planes
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* CHAT DEMO */}
        <section className="py-24 px-4 bg-card/30 border-y border-border">
          <div className="container mx-auto max-w-3xl">
            <ScrollReveal>
              <div className="text-center mb-12">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">El día a día</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4 leading-tight">
                  Hablas con una persona.{" "}
                  <span className="text-gradient">No con un bot.</span>
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto text-sm">
                  Sin tickets. Sin respuestas automáticas. Mensajes reales que ajustan tu plan.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <div className="bg-card rounded-2xl border border-border premium-shadow flex flex-col h-[440px] overflow-hidden max-w-xl mx-auto">
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
        <TrainersSection />

        {/* TESTIMONIOS */}
        <section className="py-28 px-4 bg-card/30 border-y border-border">
          <div className="container mx-auto max-w-3xl">
            <ScrollReveal>
              <div className="text-center mb-14">
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

        {/* FAQ */}
        <section className="py-28 px-4">
          <div className="container mx-auto max-w-2xl">
            <ScrollReveal>
              <div className="text-center mb-14">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Antes de empezar</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display">
                  Lo que la gente nos pregunta
                </h2>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <Accordion type="single" collapsible className="space-y-1">
                {faqs.map((faq, i) => (
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
            </ScrollReveal>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="relative py-28 px-4 overflow-hidden bg-card/30 border-t border-border">
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
                onClick={() => navigate("/scan")}
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
        <div className="container mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 text-muted-foreground text-sm">
          <span><span className="font-display font-bold text-gradient">Autopilot</span> &copy; {new Date().getFullYear()}</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center">
            <Link to="/login" className="hover:text-foreground transition-colors">Iniciar sesión</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Registro</Link>
            <Link to="/legal/terminos" className="hover:text-foreground transition-colors">Términos</Link>
            <Link to="/legal/privacidad" className="hover:text-foreground transition-colors">Privacidad</Link>
          </div>
        </div>
      </footer>

      {/* Floating CTA mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-md border-t border-border z-50 md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/scan")}>
          <ScanLine className="w-4 h-4" /> Diagnóstico gratis
        </Button>
      </div>
    </div>
  );
};

export default Index;
