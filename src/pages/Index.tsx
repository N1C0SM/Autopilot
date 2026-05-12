import {
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
  Star,
  Dumbbell,
  Apple,
  X,
  Clock,
  HeartHandshake,
  Image as ImageIcon,
  Send,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import ScrollReveal from "@/components/ScrollReveal";
import PricingTiers from "@/components/PricingTiers";
import AIScanSection from "@/components/AIScanSection";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const heroBullets = [
  "Plan adaptado a tu vida",
  "Hablas conmigo, no con un bot",
  "Sin dietas extremas",
  "7 días gratis",
];

const howItWorks = [
  { step: "01", title: "Me cuentas tu situación", desc: "Cuestionario corto: objetivo, nivel, equipamiento, horarios.", time: "2 min" },
  { step: "02", title: "Creo tu plan personalizado", desc: "Entrenamiento + nutrición pensados para ti.", time: "< 48 h" },
  { step: "03", title: "Empiezas esta semana", desc: "Sabes qué hacer cada día, sin dudas.", time: "Hoy" },
  { step: "04", title: "Lo ajustamos por chat", desc: "Plan vivo que evoluciona contigo.", time: "Continuo", highlight: true },
];

const faqs = [
  { q: "¿Y si nunca he entrenado?", a: "Mejor. El plan se construye desde tu nivel real y vamos paso a paso. Por chat puedes preguntar cualquier cosa." },
  { q: "¿Y si entreno en casa o sin material?", a: "Sin problema. En el cuestionario indicas tu equipamiento (gym, casa, calistenia, lo que tengas) y se construye sobre eso." },
  { q: "¿Es IA o una persona?", a: "Una persona. Soy yo quien lee tus mensajes y ajusta el plan. Sin bots, sin respuestas automáticas." },
  { q: "¿Y si tengo lesiones?", a: "Es lo primero que pregunto. Cada ejercicio se elige respetando lo que tu cuerpo permite." },
  { q: "¿Y si no me convence?", a: "Tienes 7 días gratis y 30 días de garantía. Sin permanencia. Cancelas cuando quieras." },
];

const Index = () => {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState([
    { name: "María G.", result: "Llevo 6 meses constante", text: "Lo que más valoro no es el plan, es saber que puedo escribir cuando algo no encaja y al día siguiente está ajustado.", photo_url: null as string | null },
    { name: "Carlos R.", result: "Por fin he dejado de cambiar de rutina", text: "Antes empezaba algo nuevo cada mes. Ahora sigo el mismo camino y lo vamos afinando juntos.", photo_url: null },
    { name: "Laura M.", result: "Entreno sin miedo a lesionarme", text: "Tuve una molestia en la rodilla y al día siguiente ya tenía el plan reajustado. Eso no te lo da ninguna app.", photo_url: null },
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

  const microcopy = (
    <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1.5 flex-wrap">
      <ShieldCheck className="w-3 h-3" />
      Sin permanencia · Cancelas cuando quieras · Soporte humano real
    </p>
  );

  return (
    <div className="min-h-screen bg-background relative">
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

      {/* HERO */}
      <section className="pt-32 sm:pt-40 pb-20 px-4 overflow-hidden">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-3 mb-10"
          >
            {trainer.trainer_photo_url ? (
              <img
                src={trainer.trainer_photo_url}
                alt={trainer.trainer_name}
                loading="lazy"
                className="w-10 h-10 rounded-full object-cover border border-primary/40"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className="text-left text-xs sm:text-sm">
              <div className="font-semibold">{trainer.trainer_name} · entrenador real</div>
              <div className="text-muted-foreground">+8 años · +200 alumnos acompañados</div>
            </div>
          </motion.div>

          <div className="text-center max-w-3xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-[1.1] mb-6"
            >
              Entrenador personal online{" "}
              <span className="text-gradient">con seguimiento real</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed"
            >
              Plan de entrenamiento y nutrición personalizado + acompañamiento diario por chat
              para progresar sin improvisar.
            </motion.p>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-8 text-sm"
            >
              {heroBullets.map((b) => (
                <li key={b} className="flex items-center gap-1.5 text-foreground/85">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> {b}
                </li>
              ))}
            </motion.ul>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Button variant="hero" size="xl" onClick={() => navigate("/signup")} className="hover-scale">
                Empezar gratis
              </Button>
              {microcopy}
            </motion.div>
          </div>
        </div>
      </section>

      {/* AI SCAN */}
      <AIScanSection />

      {/* CÓMO FUNCIONA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-3">
              Cómo funciona
            </h2>
            <p className="text-muted-foreground text-center mb-10 max-w-lg mx-auto">
              Simple, rápido, con una persona real al otro lado.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {howItWorks.map((item, i) => (
              <ScrollReveal key={item.step} delay={i * 0.08}>
                <div className={`bg-card rounded-2xl p-5 border h-full hover-scale transition-all duration-300 ${item.highlight ? "border-primary/40 glow-shadow" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl font-bold font-display text-gradient">{item.step}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                      <Clock className="w-3 h-3" /> {item.time}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold font-display mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* DIFERENCIACIÓN + CHAT MOCKUP */}
      <section className="py-20 px-4 bg-card/40 border-y border-border">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <div className="text-center mb-10">
              <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                Qué hace diferente a Autopilot
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3 leading-tight">
                No es una app automática.{" "}
                <span className="text-gradient">Es un copiloto.</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid lg:grid-cols-2 gap-6 items-stretch max-w-4xl mx-auto">
            <div className="grid gap-4">
              <div className="bg-background/40 rounded-2xl p-6 border border-border">
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                  Lo de siempre
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    "App automática sin nadie detrás",
                    "Plantilla genérica para todos",
                    "Soporte por chatbots o tickets",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-card rounded-2xl p-6 border border-primary/40 card-shadow glow-shadow">
                <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                  Autopilot
                </div>
                <ul className="space-y-2 text-sm">
                  {[
                    "Una persona real (yo) en el chat",
                    "Plan diseñado a tu nivel y vida",
                    "Si algo no funciona, lo ajustamos",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <ScrollReveal delay={0.1}>
              <div className="bg-card rounded-2xl border border-border card-shadow flex flex-col h-[340px] overflow-hidden">
                <div className="flex items-center gap-2 p-3 border-b border-border">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary">
                    <MessageCircle className="w-4 h-4" /> Chat con tu entrenador
                  </button>
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
                      Hecho. Reorganizado en 3 días sin perder volumen.
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2 items-center">
                    <button type="button" className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:bg-secondary transition-colors">
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <div className="flex-1 h-9 px-3 flex items-center rounded-md border border-input bg-background text-sm text-muted-foreground">
                      Escribe un mensaje...
                    </div>
                    <button type="button" className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md bg-primary text-primary-foreground">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* QUÉ INCLUYE + TESTIMONIOS */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3">
                Resultados sostenibles,{" "}
                <span className="text-gradient">no cambios de 2 semanas</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <div className="bg-card rounded-2xl p-6 border border-border h-full">
              <Dumbbell className="w-7 h-7 text-primary mb-3" />
              <h3 className="text-base font-bold font-display mb-2">Entrenamiento</h3>
              <ul className="space-y-1.5 text-muted-foreground text-sm">
                {["Rutinas adaptadas a tu vida", "Progresión clara", "Vídeos y técnica", "Pensado para evitar lesiones"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-border h-full">
              <Apple className="w-7 h-7 text-primary mb-3" />
              <h3 className="text-base font-bold font-display mb-2">Nutrición</h3>
              <ul className="space-y-1.5 text-muted-foreground text-sm">
                {["Macros para tu objetivo", "Comidas reales", "Adaptado a alergias", "Sin dietas imposibles"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-primary/40 card-shadow glow-shadow h-full relative">
              <span className="absolute -top-3 right-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                Lo que cambia todo
              </span>
              <HeartHandshake className="w-7 h-7 text-primary mb-3" />
              <h3 className="text-base font-bold font-display mb-2">Acompañamiento</h3>
              <ul className="space-y-1.5 text-foreground/90 text-sm">
                {["Chat directo conmigo", "Ajustes constantes", "Resolución real de dudas", "Apoyo cuando aflojas"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ScrollReveal delay={0.1}>
            <div className="grid md:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <div key={t.name + i} className="bg-card rounded-2xl p-6 border border-border card-shadow h-full flex flex-col">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground flex-1 mb-4">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={t.name} loading="lazy" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {t.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-primary font-medium">{t.result}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* PRECIO + GARANTÍA */}
      <section className="py-20 px-4 bg-card/40 border-y border-border">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3">
                Un precio. Plan + acompañamiento real incluidos.
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <PricingTiers onSelect={() => navigate("/signup")} />
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="max-w-2xl mx-auto mt-16 bg-gradient-to-br from-success/15 to-success/5 border border-success/30 rounded-3xl p-8 pt-14 text-center relative">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-success/20 border border-success/40 flex items-center justify-center">
                <ShieldCheck className="w-9 h-9 text-success" />
              </div>
              <h3 className="text-xl font-bold font-display mb-2">Garantía 30 días</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-2">
                Si no notas la diferencia, te devolvemos el dinero.
              </p>
              <p className="text-xs text-foreground/70">Sin riesgos. Sin permanencia.</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-10">
              Resolvemos tus dudas
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="bg-card border border-border rounded-xl px-5 data-[state=open]:border-primary/40 transition-colors"
                >
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-4 text-left">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 px-4 bg-card/30 border-t border-border">
        <div className="container mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-5xl font-bold font-display mb-5 leading-[1.1]">
              Con esto no vas solo.{" "}
              <span className="text-gradient">Tienes dirección y alguien al otro lado.</span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              7 días gratis. Sin permanencia. Entrenador real.
            </p>
            <Button variant="hero" size="xl" onClick={() => navigate("/signup")} className="hover-scale">
              Dejar de improvisar hoy
            </Button>
            {microcopy}
          </ScrollReveal>
        </div>
      </section>

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
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/90 backdrop-blur-md border-t border-border z-50 md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/signup")}>
          Empezar 7 días gratis
        </Button>
      </div>
    </div>
  );
};

export default Index;
