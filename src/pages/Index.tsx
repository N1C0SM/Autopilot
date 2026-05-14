import {
  MessageCircle,
  ShieldCheck,
  Star,
  Image as ImageIcon,
  Send,
  User,
  Users,
  Clock,
  Trophy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import ScrollReveal from "@/components/ScrollReveal";
import PricingTiers from "@/components/PricingTiers";
import AIScanSection from "@/components/AIScanSection";
import TrainersSection from "@/components/TrainersSection";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const howItWorks = [
  { step: "01", title: "Diagnóstico real", desc: "Cuestionario corto + AI Scan opcional. Vemos exactamente desde dónde partes." },
  { step: "02", title: "Plan diseñado para ti", desc: "Entrenamiento y nutrición construidos a mano sobre tu nivel, equipo y horarios. Sin plantillas." },
  { step: "03", title: "Empiezas esta semana", desc: "Sabes qué hacer cada día. Sincronizado con tu Google Calendar." },
  { step: "04", title: "Ajustes continuos por chat", desc: "Hablamos cada semana. El plan evoluciona con tus resultados, no al revés." },
];

const trustStats = [
  { icon: Users, value: "+200", label: "alumnos activos" },
  { icon: Clock, value: "+8 años", label: "entrenando" },
  { icon: Trophy, value: "97%", label: "renueva al mes 2" },
];

const pillars = [
  {
    title: "No es una app automática",
    desc: "Cada mensaje lo lee una persona. Sin bots, sin respuestas genéricas.",
  },
  {
    title: "Plan vivo",
    desc: "Si esta semana solo entrenas 3 días, lo reorganizamos sin perder progreso.",
  },
  {
    title: "Transformación visible",
    desc: "Métricas, fotos y PRs. No celebramos el esfuerzo, celebramos el resultado.",
  },
];

const faqs = [
  { q: "¿Y si nunca he entrenado?", a: "Mejor. El plan se construye desde tu nivel real y vamos paso a paso, sin saltar fases." },
  { q: "¿Y si entreno en casa o sin material?", a: "Sin problema. Indicas tu equipamiento exacto y se construye sobre eso. Calistenia, gimnasio, mancuernas en casa o cero material." },
  { q: "¿Es IA o una persona?", a: "Una persona. Yo leo tus mensajes, ajusto el plan y respondo. La IA solo se usa para el diagnóstico inicial." },
  { q: "¿Y si tengo lesiones?", a: "Cada ejercicio se elige respetando lo que tu cuerpo permite. Tienes molestia, lo cambio al día siguiente." },
  { q: "¿Cuánto tardo en ver resultados?", a: "Cambios visibles en composición a las 6-8 semanas si hay adherencia. Cambios en fuerza y energía la primera semana." },
  { q: "¿Y si no me convence?", a: "7 días gratis y 30 días de garantía. Cancelas en un clic, sin permanencia ni preguntas." },
  { q: "¿Cuánto tiempo necesito a la semana?", a: "Desde 3 horas. Tú marcas la disponibilidad real, yo construyo sobre eso." },
];

const Index = () => {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState([
    { name: "María G.", result: "−7 kg en 4 meses", text: "Lo que más valoro no es el plan, es saber que puedo escribir cuando algo no encaja y al día siguiente está ajustado.", photo_url: null as string | null },
    { name: "Carlos R.", result: "+6 kg de músculo", text: "Antes empezaba algo nuevo cada mes. Ahora sigo el mismo camino y lo afinamos juntos.", photo_url: null },
    { name: "Laura M.", result: "Sin lesiones · 8 meses", text: "Tuve molestia en la rodilla y al día siguiente ya tenía el plan reajustado. Eso vale el precio solo.", photo_url: null },
  ]);
  const [trainer, setTrainer] = useState({ trainer_name: "Nicolás", trainer_photo_url: "", trainer_bio: "" });

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: s }] = await Promise.all([
        supabase.from("site_testimonials").select("name, result, text, photo_url").eq("visible", true).order("sort_order"),
        supabase.from("settings").select("trainer_name, trainer_photo_url, trainer_bio").limit(1).maybeSingle(),
      ]);
      if (t && t.length > 0) setTestimonials(t as any);
      if (s) setTrainer({
        trainer_name: s.trainer_name || "Nicolás",
        trainer_photo_url: s.trainer_photo_url || "",
        trainer_bio: s.trainer_bio || "",
      });
    })();
  }, []);

  const featured = testimonials[0];
  const rest = testimonials.slice(1, 3);

  return (
    <div className="min-h-screen bg-background relative">
      <Helmet>
        <title>Autopilot — Entrenador personal online con seguimiento humano real</title>
        <meta name="description" content="Plan de entrenamiento y nutrición diseñado por un entrenador real, no por una app. Chat directo, ajustes semanales y resultados visibles. 7 días gratis, sin permanencia." />
        <link rel="canonical" href="https://autopilotplan.com/" />
        <meta property="og:title" content="Autopilot — Entrenador personal online con seguimiento humano real" />
        <meta property="og:description" content="Plan de entrenamiento y nutrición diseñado por un entrenador real. Chat directo, ajustes semanales, resultados visibles. 7 días gratis." />
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
          serviceType: "Entrenador personal online",
          provider: { "@type": "Organization", name: "Autopilot", url: "https://autopilotplan.com/" },
          areaServed: "ES",
          offers: { "@type": "Offer", price: "19", priceCurrency: "EUR" },
        })}</script>
      </Helmet>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <span className="font-display text-xl font-bold text-gradient">Autopilot</span>
          <div className="flex gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Iniciar sesión
            </Button>
            <Button variant="default" size="sm" onClick={() => navigate("/signup")}>
              7 días gratis
            </Button>
          </div>
        </div>
      </nav>

      <main>
        {/* HERO */}
        <section className="relative pt-36 sm:pt-44 pb-28 sm:pb-36 px-4 overflow-hidden">
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
                Plazas limitadas · Coaching 1 a 1
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[2.4rem] sm:text-5xl lg:text-6xl font-bold font-display leading-[1.05] mb-6 tracking-tight"
            >
              El cuerpo que quieres.{" "}
              <span className="text-gradient">Sin perder más años</span>{" "}
              probando rutinas que no funcionan.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed"
            >
              Plan de entrenamiento y nutrición diseñado por un entrenador real, ajustado contigo cada semana por chat. No es una app. Es un copiloto.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col items-center"
            >
              <Button
                variant="hero"
                size="xl"
                onClick={() => navigate("/signup")}
                className="hover-scale shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] text-base px-8"
              >
                Empezar mis 7 días gratis
              </Button>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> 7 días gratis</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Sin permanencia</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Cancelas en 1 clic</span>
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
                    alt={`${trainer.trainer_name}, entrenador personal en Autopilot`}
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
                  <div className="font-semibold text-foreground text-xs">{trainer.trainer_name} · Entrenador personal</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="w-2.5 h-2.5 fill-primary text-primary" />
                      ))}
                    </div>
                    <span>4.9/5 · +200 reseñas</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-8 max-w-md w-full">
                {trustStats.map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="text-xl sm:text-2xl font-bold font-display text-gradient">{s.value}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* AI SCAN */}
        <AIScanSection />

        {/* PILLARS */}
        <section className="py-24 px-4">
          <div className="container mx-auto max-w-5xl">
            <ScrollReveal>
              <div className="text-center mb-14">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Por qué funciona</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight max-w-xl mx-auto">
                  Tres cosas que ninguna app te va a dar
                </h2>
              </div>
            </ScrollReveal>
            <div className="grid md:grid-cols-3 gap-5">
              {pillars.map((p, i) => (
                <ScrollReveal key={p.title} delay={i * 0.08}>
                  <div className="bg-card/50 border border-border rounded-2xl p-6 h-full hover:border-primary/30 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center mb-4 text-primary font-bold text-sm">
                      0{i + 1}
                    </div>
                    <h3 className="font-display font-semibold text-base mb-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section className="py-28 px-4 bg-card/30 border-y border-border">
          <div className="container mx-auto max-w-3xl">
            <ScrollReveal>
              <div className="text-center mb-16">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">El proceso</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display">
                  De cero a entrenando, en 24 horas
                </h2>
              </div>
            </ScrollReveal>
            <div className="space-y-12">
              {howItWorks.map((item, i) => (
                <ScrollReveal key={item.step} delay={i * 0.06}>
                  <div className="flex gap-6 sm:gap-10 items-start">
                    <span className="text-3xl sm:text-4xl font-bold font-display text-gradient leading-none shrink-0 w-14">
                      {item.step}
                    </span>
                    <div className="pt-1 border-l border-border/40 pl-5">
                      <h3 className="text-lg font-semibold font-display mb-2">{item.title}</h3>
                      <p className="text-muted-foreground text-base max-w-md leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* CHAT DEMO */}
        <section className="py-24 px-4">
          <div className="container mx-auto max-w-3xl">
            <ScrollReveal>
              <div className="text-center mb-12">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">El día a día</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4 leading-tight">
                  Hablas conmigo.{" "}
                  <span className="text-gradient">Yo respondo.</span>
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto text-sm">
                  Sin bots. Sin tickets. Sin esperar 5 días por una respuesta automática.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <div className="bg-card rounded-2xl border border-border premium-shadow flex flex-col h-[400px] overflow-hidden max-w-xl mx-auto">
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
                      Hoy me dolía el hombro al hacer press banca
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-secondary text-foreground rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                      Te cambio por press inclinado con mancuernas y bajamos a 3 series. ¿Cómo va el resto?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2 text-sm">
                      Esta semana solo puedo L, M y V
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-secondary text-foreground rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                      Hecho. Reorganizado en 3 días sin perder volumen. Te llega al calendario en 2 min.
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

        {/* PRICING */}
        <section className="py-24 px-4">
          <div className="container mx-auto max-w-5xl">
            <ScrollReveal>
              <div className="text-center mb-12">
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Precio</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3">
                  Menos que un café al día
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Un entrenador personal presencial cuesta entre 200 y 500€/mes. Aquí pagas lo que vale el resultado, no la sala.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <PricingTiers onSelect={() => navigate("/signup")} />
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <p className="text-center text-sm text-muted-foreground mt-12 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-success" />
                Garantía 30 días · Sin permanencia · Cancelas cuando quieras
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-28 px-4 bg-card/30 border-y border-border">
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
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="border-b border-border last:border-b-0"
                  >
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
        <section className="relative py-32 px-4 overflow-hidden">
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.08] blur-[160px]" />
          </div>
          <div className="container mx-auto max-w-2xl text-center">
            <ScrollReveal>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display mb-6 leading-[1.05] tracking-tight">
                Deja de improvisar.{" "}
                <span className="text-gradient">Empieza con dirección.</span>
              </h2>
              <p className="text-base text-muted-foreground mb-10 max-w-md mx-auto">
                7 días gratis. Si no es para ti, te vas. Si lo es, ya tienes el plan que llevas años buscando.
              </p>
              <Button
                variant="hero"
                size="xl"
                onClick={() => navigate("/signup")}
                className="hover-scale shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] text-base px-8"
              >
                Empezar mis 7 días gratis
              </Button>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> 7 días gratis</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Sin tarjeta</span>
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-success" /> Cancela cuando quieras</span>
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
        <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/signup")}>
          Empezar 7 días gratis
        </Button>
      </div>
    </div>
  );
};

export default Index;
