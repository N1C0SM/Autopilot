import {
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
  Star,
  Dumbbell,
  Apple,
  X,
  Compass,
  RefreshCw,
  HeartHandshake,
  Clock,
  Users,
  Award,
  TrendingUp,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ---------- CONTENIDO ---------- */

const heroBullets = [
  "Ajustes reales según tu progreso",
  "Hablas directamente conmigo",
  "Sin dietas extremas",
  "Adaptado a tu vida real",
  "7 días gratis",
];

const painPoints = [
  "Empiezas el lunes con muchas ganas y el jueves ya no sabes qué tocar.",
  "Cambias de rutina cada dos semanas porque ninguna te convence.",
  "Copias ejercicios sueltos de TikTok o YouTube sin saber si encajan.",
  "Te frustra no ver progreso aunque estés esforzándote.",
  "Has empezado dietas imposibles que no aguantan ni 5 días.",
  "Sientes que pierdes el tiempo y que cada mes vuelves al punto de partida.",
];

const benefits = [
  {
    icon: Compass,
    title: "Dirección clara cada día",
    desc: "Sabes exactamente qué entrenar, qué comer y por qué. Nada de improvisar.",
  },
  {
    icon: RefreshCw,
    title: "Tu plan se adapta contigo",
    desc: "Si cambia tu semana, tu lesión o tu objetivo, lo ajustamos juntos por chat.",
  },
  {
    icon: HeartHandshake,
    title: "Acompañamiento real",
    desc: "No hablas con un bot ni con una IA. Soy yo, leyendo y respondiendo.",
  },
  {
    icon: TrendingUp,
    title: "Progreso sostenible",
    desc: "Resultados que se mantienen porque construimos hábitos, no parches de 2 semanas.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Me cuentas tu situación",
    desc: "Cuestionario corto: objetivo, nivel, lesiones, equipamiento, horarios reales.",
    time: "2 min",
  },
  {
    step: "02",
    title: "Creo tu plan personalizado",
    desc: "Entrenamiento + nutrición pensados para ti, no plantillas genéricas.",
    time: "< 48 h",
  },
  {
    step: "03",
    title: "Empiezas esta semana",
    desc: "Sabes qué hacer cada día, sin dudas ni lagunas.",
    time: "Hoy mismo",
  },
  {
    step: "04",
    title: "Lo ajustamos contigo por chat",
    desc: "Aquí está la diferencia. Un plan vivo que evoluciona con tu vida.",
    time: "Continuo",
    highlight: true,
  },
];

const realBenefits = [
  "Perder grasa sin dejar de comer normal",
  "Aprender a entrenar correctamente",
  "Volver a entrenar sin dolor",
  "Organizar entrenos aunque tengas poco tiempo",
  "Ganar músculo sin improvisar",
  "Mantener la constancia durante meses, no semanas",
];

const fallbackTestimonials = [
  {
    name: "María G.",
    result: "Llevo 6 meses constante",
    text: "Lo que más valoro no es el plan, es saber que puedo escribir cuando algo no encaja y al día siguiente está ajustado.",
    photo_url: null as string | null,
  },
  {
    name: "Carlos R.",
    result: "Por fin he dejado de cambiar de rutina",
    text: "Antes empezaba algo nuevo cada mes. Ahora sigo el mismo camino y lo vamos afinando juntos. Es otra historia.",
    photo_url: null,
  },
  {
    name: "Laura M.",
    result: "Entreno sin miedo a lesionarme",
    text: "Tuve una molestia en la rodilla y al día siguiente ya tenía el plan reajustado. Eso no te lo da ninguna app.",
    photo_url: null,
  },
];

const faqs = [
  {
    q: "¿Y si nunca he entrenado?",
    a: "Mejor. El plan se construye desde tu nivel real y vamos paso a paso. Por chat puedes preguntar cualquier cosa: cómo se hace un ejercicio, qué comer, si te duele algo. Aprendes acompañado.",
  },
  {
    q: "¿Y si tengo poco tiempo?",
    a: "Me dices cuántos días y minutos tienes y el plan se ajusta a eso. No hay sesiones de 2 horas si solo tienes 40 minutos.",
  },
  {
    q: "¿Y si entreno en casa o sin material?",
    a: "Sin problema. En el cuestionario indicas tu equipamiento (gym, casa, calistenia, mancuernas, gomas, lo que tengas) y se construye sobre eso.",
  },
  {
    q: "¿Y si viajo?",
    a: "Me lo cuentas y reescribimos esa semana con lo que tengas a mano. La constancia no se rompe por un viaje.",
  },
  {
    q: "¿Es IA o una persona?",
    a: "Una persona. Soy yo quien lee tus mensajes y ajusta el plan. Sin bots, sin respuestas automáticas.",
  },
  {
    q: "¿Cuánto tardas en responder?",
    a: "Normalmente en menos de 24h en días laborables. No es soporte de tickets, es conversación real.",
  },
  {
    q: "¿Tengo que hacer dietas raras?",
    a: "No. La nutrición se basa en lo que ya comes y te gusta, ajustando cantidades para que apoye tu objetivo. Nada de batidos extraños ni alimentos prohibidos.",
  },
  {
    q: "¿Y si abandono fácil?",
    a: "Por eso existe el chat. Cuando notes que aflojas, hablamos y ajustamos. La constancia se construye con apoyo, no con motivación puntual.",
  },
  {
    q: "¿Y si tengo lesiones?",
    a: "Es lo primero que pregunto. Cada ejercicio se elige respetando lo que tu cuerpo permite, y si aparece algo nuevo, lo modificamos al momento.",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState(fallbackTestimonials);
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
      <section className="pt-52 sm:pt-64 pb-44 px-4 overflow-hidden">
        <div className="container mx-auto max-w-5xl">
          {/* Trust bar arriba */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-3 mb-20"
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
              className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-[1.1] mb-10"
            >
              Entrenador personal online{" "}
              <span className="text-gradient">con seguimiento real</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-muted-foreground mb-20 max-w-2xl mx-auto leading-relaxed"
            >
              Plan de entrenamiento y nutrición personalizado + acompañamiento diario por chat
              para ayudarte a crear hábitos duraderos y progresar sin improvisar.
            </motion.p>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-20 text-sm"
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

      {/* MENSAJE CENTRAL */}
      <section className="py-36 px-4 border-y border-border bg-card/30">
        <div className="container mx-auto max-w-3xl text-center">
          <ScrollReveal>
            <p className="text-2xl sm:text-3xl font-display font-medium leading-snug">
              No necesitas más motivación.{" "}
              <span className="text-gradient">Necesitas dirección, estructura y alguien que te ayude a mantenerte constante.</span>
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* BENEFICIOS RÁPIDOS */}
      <section className="py-44 px-4">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <div className="text-center mb-24">
              <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                Qué cambia para ti
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
                La diferencia no es entrenar más.{" "}
                <span className="text-gradient">Es tener dirección.</span>
              </h2>
            </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-8">
            {benefits.map((b, i) => (
              <ScrollReveal key={b.title} delay={i * 0.08}>
                <div className="bg-card rounded-2xl p-8 border border-border h-full hover-scale transition-all duration-300">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <b.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base font-bold font-display mb-1">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* DOLOR / IDENTIFICACIÓN */}
      <section className="py-44 px-4 bg-card/30 border-y border-border">
        <div className="container mx-auto max-w-3xl">
          <ScrollReveal>
            <div className="text-center mb-20">
              <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                Si llevas tiempo intentándolo solo
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4 leading-tight">
                El problema no eres tú.{" "}
                <span className="text-gradient">Es intentar hacerlo solo.</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Entrenar solo parece gratis… hasta que pierdes meses sin avanzar.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-3">
            {painPoints.map((p, i) => (
              <ScrollReveal key={p} delay={i * 0.05}>
                <div className="flex items-start gap-4 bg-card border border-border rounded-xl p-4 h-full">
                  <X className="w-4 h-4 text-destructive flex-shrink-0 mt-1" />
                  <p className="text-sm text-foreground/85">{p}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal delay={0.3}>
            <p className="text-center text-base sm:text-lg text-muted-foreground mt-10 italic">
              "Deja de empezar de cero cada lunes."
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="py-44 px-4">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
              Cómo funciona
            </h2>
            <p className="text-muted-foreground text-center mb-24 max-w-lg mx-auto">
              Simple, rápido, sin complicaciones. Y con una persona real al otro lado.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, i) => (
              <ScrollReveal key={item.step} delay={i * 0.1}>
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

      {/* DIFERENCIACIÓN */}
      <section className="py-44 px-4 bg-card/40 border-y border-border">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="text-center mb-20">
              <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                Qué hace diferente a Autopilot
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4 leading-tight">
                No es una app automática.{" "}
                <span className="text-gradient">Es un copiloto.</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                No hablas con un bot. Soy yo quien responde, ajusta y te acompaña.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-20">
            <div className="bg-background/40 rounded-2xl p-8 border border-border">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">
                Lo de siempre
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                {[
                  "App automática sin nadie detrás",
                  "PDF estático que no cambia",
                  "Plantilla genérica para todos",
                  "Soporte por chatbots o tickets",
                  "Promesas de transformación en 30 días",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-primary/40 card-shadow glow-shadow">
              <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-4">
                Autopilot
              </div>
              <ul className="space-y-2.5 text-sm">
                {[
                  "Una persona real (yo) en el chat",
                  "Plan que se reescribe contigo",
                  "Diseñado a tu nivel, lesiones y vida",
                  "Si algo no funciona, lo ajustamos",
                  "Progreso sostenible, no parches",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* MOCKUP CHAT */}
          <ScrollReveal delay={0.1}>
            <div className="max-w-2xl mx-auto">
              <p className="text-center text-xs uppercase tracking-widest text-primary font-semibold mb-4">
                Así es el chat por dentro
              </p>
              <div className="bg-card rounded-2xl border border-border card-shadow flex flex-col h-[460px] overflow-hidden">
                <div className="flex items-center gap-2 p-3 border-b border-border">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary">
                    <MessageCircle className="w-4 h-4" /> Chat con tu entrenador
                  </button>
                </div>
                <div className="flex-1 overflow-hidden p-4 space-y-3 bg-background/20">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
                      Hoy me dolía un poco el hombro al hacer press banca
                      <div className="text-[10px] mt-1 text-primary-foreground/60">10:24</div>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-secondary text-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                      Sin problema. Te cambio el press banca por press inclinado con mancuernas y bajamos a 3 series. ¿Cómo va el resto?
                      <div className="text-[10px] mt-1 text-muted-foreground">10:31</div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
                      Esta semana solo puedo entrenar L, M y V
                      <div className="text-[10px] mt-1 text-primary-foreground/60">10:33</div>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-secondary text-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                      Hecho. Te he reorganizado la semana en 3 días sin perder volumen. Tu plan ya está actualizado.
                      <div className="text-[10px] mt-1 text-muted-foreground">10:35</div>
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2 items-center">
                    <button type="button" className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md text-muted-foreground hover:bg-secondary transition-colors">
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <div className="flex-1 h-10 px-3 flex items-center rounded-md border border-input bg-background text-sm text-muted-foreground">
                      Escribe un mensaje...
                    </div>
                    <button type="button" className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md bg-primary text-primary-foreground">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">
                Mismo chat que verás dentro. Soy yo respondiendo, no un bot.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="text-center mt-12">
              <Button variant="hero" size="lg" onClick={() => navigate("/signup")} className="hover-scale">
                Quiero mi plan personalizado
              </Button>
              {microcopy}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* SOBRE MÍ */}
      <section className="py-44 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <ScrollReveal>
            <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
              Quién está al otro lado del chat
            </span>
            {trainer.trainer_photo_url && (
              <img
                src={trainer.trainer_photo_url}
                alt={trainer.trainer_name}
                loading="lazy"
                className="w-32 h-32 rounded-full object-cover mx-auto mb-6 border-2 border-primary/30"
              />
            )}
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-6 leading-tight">
              Hola, soy <span className="text-gradient">{trainer.trainer_name}</span>.
            </h2>
            {trainer.trainer_bio ? (
              <p className="text-muted-foreground mb-10 leading-relaxed whitespace-pre-line">
                {trainer.trainer_bio}
              </p>
            ) : (
              <>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Llevo más de 8 años ayudando a personas a entrenar bien, comer mejor y, sobre todo, mantenerse constantes.
                </p>
                <p className="text-muted-foreground mb-10 leading-relaxed">
                  Mi enfoque no es darte una rutina más. Es ayudarte a construir un sistema que aguante con tu vida real: trabajo, viajes, lesiones, semanas malas.
                </p>
              </>
            )}
            <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <Users className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">Alumnos</div>
                <div className="font-bold font-display">+200</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <Award className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">Experiencia</div>
                <div className="font-bold font-display">+8 años</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <HeartHandshake className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">Enfoque</div>
                <div className="font-bold font-display">Humano</div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* QUÉ INCLUYE / RESULTADOS REALES */}
      <section className="py-44 px-4 bg-card/30 border-y border-border">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <div className="text-center mb-24">
              <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                Para qué te sirve
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
                Resultados sostenibles,{" "}
                <span className="text-gradient">no cambios de 2 semanas</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-4 mb-20">
            <div className="bg-card rounded-2xl p-8 border border-border h-full">
              <Dumbbell className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold font-display mb-3">Entrenamiento</h3>
              <ul className="space-y-2 text-muted-foreground text-sm">
                {[
                  "Rutinas semanales adaptadas a tu vida",
                  "Progresión clara, sin saltos al vacío",
                  "Vídeos y técnica de cada ejercicio",
                  "Pensado para evitar lesiones",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-border h-full">
              <Apple className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold font-display mb-3">Nutrición</h3>
              <ul className="space-y-2 text-muted-foreground text-sm">
                {[
                  "Macros calculados para tu objetivo",
                  "Comidas reales que te gustan",
                  "Adaptado a alergias y preferencias",
                  "Sin dietas imposibles de mantener",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-primary/40 card-shadow glow-shadow h-full relative">
              <span className="absolute -top-3 right-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                Lo que cambia todo
              </span>
              <HeartHandshake className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold font-display mb-3">Acompañamiento</h3>
              <ul className="space-y-2 text-foreground/90 text-sm">
                {[
                  "Chat directo conmigo (humano)",
                  "Ajustes constantes del plan",
                  "Resolución real de dudas",
                  "Apoyo cuando aflojas la constancia",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ScrollReveal delay={0.15}>
            <div className="bg-card/60 rounded-2xl p-8 border border-border max-w-3xl mx-auto">
              <p className="text-center text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">
                Lo que vas a conseguir
              </p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {realBenefits.map((b) => (
                  <div key={b} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="py-44 px-4">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
              Lo que dicen quienes ya están dentro
            </h2>
            <p className="text-muted-foreground text-center mb-24 max-w-lg mx-auto">
              Personas reales que dejaron de improvisar y empezaron a progresar de verdad.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-10">
            {testimonials.map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 0.12}>
                <div className="bg-card rounded-2xl p-8 border border-border card-shadow h-full flex flex-col">
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
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={0.3}>
            <div className="text-center mt-12">
              <Button variant="hero" size="lg" onClick={() => navigate("/signup")} className="hover-scale">
                Empezar a progresar de verdad
              </Button>
              {microcopy}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* PRECIO */}
      <section className="py-44 px-4 bg-card/40 border-y border-border">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
                Mucho más barato que perder meses entrenando mal
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Un precio. Plan + acompañamiento real incluidos.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="grid md:grid-cols-3 gap-4 mb-20 max-w-4xl mx-auto">
              <div className="bg-background/40 rounded-2xl p-5 border border-border opacity-70">
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                  Entrenador presencial
                </div>
                <div className="text-2xl font-bold font-display mb-1">€60+<span className="text-sm text-muted-foreground font-normal">/sesión</span></div>
                <p className="text-xs text-muted-foreground mb-3">Lo ves 1-2 veces por semana. Fuera de ahí, te apañas solo.</p>
                <div className="text-xs text-muted-foreground">≈ €240-480/mes</div>
              </div>
              <div className="bg-background/40 rounded-2xl p-5 border border-border opacity-70">
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                  App genérica
                </div>
                <div className="text-2xl font-bold font-display mb-1">€10-15<span className="text-sm text-muted-foreground font-normal">/mes</span></div>
                <p className="text-xs text-muted-foreground mb-3">Plan automático. Sin nadie detrás. No se adapta a ti.</p>
                <div className="text-xs text-muted-foreground">Soporte: chatbot</div>
              </div>
              <div className="bg-card rounded-2xl p-5 border border-primary/40 card-shadow glow-shadow relative">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap">
                  Punto medio justo
                </span>
                <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">
                  Autopilot
                </div>
                <div className="text-2xl font-bold font-display mb-1">€19<span className="text-sm text-muted-foreground font-normal">/mes</span></div>
                <p className="text-xs text-foreground/80 mb-3">Plan personalizado + entrenador real ajustando contigo.</p>
                <div className="text-xs text-primary font-semibold">Soporte: humano</div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <PricingTiers onSelect={() => navigate("/signup")} />
          </ScrollReveal>

          {/* GARANTÍA */}
          <ScrollReveal delay={0.3}>
            <div className="max-w-2xl mx-auto mt-10 bg-gradient-to-br from-success/15 to-success/5 border border-success/30 rounded-3xl p-8 text-center relative overflow-hidden">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-success/20 border border-success/40 flex items-center justify-center">
                <ShieldCheck className="w-9 h-9 text-success" />
              </div>
              <div className="pt-10">
                <h3 className="text-xl font-bold font-display mb-2">Garantía 30 días</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-3">
                  Si no notas la diferencia de tener estructura, seguimiento y acompañamiento real,
                  te devolvemos el dinero.
                </p>
                <p className="text-xs text-foreground/70">Sin riesgos. Sin permanencia.</p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-44 px-4">
        <div className="container mx-auto max-w-2xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
              Resolvemos tus dudas
            </h2>
            <p className="text-muted-foreground text-center mb-20">
              Las preguntas que más me hacen antes de empezar.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
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
      <section className="py-48 px-4 bg-card/30 border-t border-border">
        <div className="container mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-5xl font-bold font-display mb-6 leading-[1.1]">
              Con esto no vas solo.{" "}
              <span className="text-gradient">Tienes dirección, estructura y alguien al otro lado.</span>
            </h2>
            <p className="text-muted-foreground mb-10 max-w-md mx-auto">
              7 días gratis. Sin permanencia. Y un entrenador real acompañándote.
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