import {
  MessageCircle,
  ShieldCheck,
  Star,
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

const howItWorks = [
  { step: "01", title: "Me cuentas tu situación", desc: "Cuestionario corto: objetivo, nivel, equipamiento, horarios." },
  { step: "02", title: "Creo tu plan personalizado", desc: "Entrenamiento + nutrición pensados para ti, no plantillas." },
  { step: "03", title: "Empiezas esta semana", desc: "Sabes qué hacer cada día, sin dudas." },
  { step: "04", title: "Lo ajustamos por chat", desc: "Plan vivo que evoluciona contigo." },
];

const faqs = [
  { q: "¿Y si nunca he entrenado?", a: "Mejor. El plan se construye desde tu nivel real y vamos paso a paso." },
  { q: "¿Y si entreno en casa o sin material?", a: "Sin problema. Indicas tu equipamiento y se construye sobre eso." },
  { q: "¿Es IA o una persona?", a: "Una persona. Soy yo quien lee tus mensajes y ajusta el plan." },
  { q: "¿Y si tengo lesiones?", a: "Cada ejercicio se elige respetando lo que tu cuerpo permite." },
  { q: "¿Y si no me convence?", a: "7 días gratis y 30 días de garantía. Sin permanencia." },
];

const Index = () => {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState([
    { name: "María G.", result: "Llevo 6 meses constante", text: "Lo que más valoro no es el plan, es saber que puedo escribir cuando algo no encaja y al día siguiente está ajustado.", photo_url: null as string | null },
    { name: "Carlos R.", result: "Dejé de cambiar de rutina", text: "Antes empezaba algo nuevo cada mes. Ahora sigo el mismo camino y lo afinamos juntos.", photo_url: null },
    { name: "Laura M.", result: "Entreno sin miedo", text: "Tuve molestia en la rodilla y al día siguiente ya tenía el plan reajustado.", photo_url: null },
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

      {/* HERO — respirado */}
      <section className="pt-40 sm:pt-48 pb-36 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-[1.1] mb-8"
          >
            Entrenador personal online{" "}
            <span className="text-gradient">con seguimiento real</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-lg text-muted-foreground mb-12 max-w-xl mx-auto leading-relaxed"
          >
            Plan personalizado de entrenamiento y nutrición + acompañamiento diario por chat.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button variant="hero" size="xl" onClick={() => navigate("/signup")} className="hover-scale">
              Empezar gratis
            </Button>
            <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3 h-3" />
              7 días gratis · Sin permanencia
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-3 mt-20 text-xs text-muted-foreground"
          >
            {trainer.trainer_photo_url ? (
              <img
                src={trainer.trainer_photo_url}
                alt={trainer.trainer_name}
                loading="lazy"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <span>{trainer.trainer_name} · +8 años · +200 alumnos</span>
          </motion.div>
        </div>
      </section>

      {/* AI SCAN — denso, visual */}
      <AIScanSection />

      {/* CÓMO FUNCIONA — respirado, tipográfico */}
      <section className="py-32 px-4">
        <div className="container mx-auto max-w-3xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-20">
              Cómo funciona
            </h2>
          </ScrollReveal>
          <div className="space-y-14">
            {howItWorks.map((item, i) => (
              <ScrollReveal key={item.step} delay={i * 0.08}>
                <div className="flex gap-6 sm:gap-10 items-start">
                  <span className="text-4xl sm:text-5xl font-bold font-display text-gradient leading-none shrink-0 w-16">
                    {item.step}
                  </span>
                  <div className="pt-1">
                    <h3 className="text-lg font-semibold font-display mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-base max-w-md leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* DIFERENCIACIÓN + CHAT — denso, visual */}
      <section className="py-24 px-4 bg-card/30 border-y border-border">
        <div className="container mx-auto max-w-3xl">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4 leading-tight">
                No es una app automática.{" "}
                <span className="text-gradient">Es un copiloto.</span>
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Hablas conmigo. Yo leo, ajusto y respondo. Sin bots.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="bg-card rounded-2xl border border-border card-shadow flex flex-col h-[360px] overflow-hidden max-w-xl mx-auto">
              <div className="flex items-center gap-2 p-3 border-b border-border">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary">
                  <MessageCircle className="w-4 h-4" /> Chat con tu entrenador
                </div>
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
      </section>

      {/* TESTIMONIOS — respirado, una voz */}
      <section className="py-32 px-4">
        <div className="container mx-auto max-w-3xl">
          <ScrollReveal>
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-widest text-primary font-semibold">
                Lo que dicen
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <blockquote className="text-center max-w-2xl mx-auto mb-20">
              <p className="text-2xl sm:text-3xl font-display font-medium leading-snug mb-8">
                "{featured.text}"
              </p>
              <footer className="flex items-center justify-center gap-3 text-sm">
                {featured.photo_url ? (
                  <img src={featured.photo_url} alt={featured.name} loading="lazy" className="w-10 h-10 rounded-full object-cover" />
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

          <div className="grid sm:grid-cols-2 gap-10 max-w-2xl mx-auto">
            {rest.map((t, i) => (
              <ScrollReveal key={t.name + i} delay={i * 0.1}>
                <div>
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

      {/* PRICING — denso, decisión */}
      <section className="py-24 px-4 bg-card/30 border-y border-border">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-12">
              Precio
            </h2>
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

      {/* FAQ — respirado */}
      <section className="py-32 px-4">
        <div className="container mx-auto max-w-2xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-16">
              Resolvemos tus dudas
            </h2>
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

      {/* CTA FINAL — respirado, cierre */}
      <section className="py-36 px-4 border-t border-border">
        <div className="container mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-5xl font-bold font-display mb-8 leading-[1.1]">
              Empieza con{" "}
              <span className="text-gradient">dirección</span>.
            </h2>
            <Button variant="hero" size="xl" onClick={() => navigate("/signup")} className="hover-scale">
              Empezar gratis
            </Button>
            <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3 h-3" />
              7 días gratis · Sin permanencia
            </p>
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
