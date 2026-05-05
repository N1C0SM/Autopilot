import {
  MessageCircle,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Star,
  Dumbbell,
  Apple,
  HeartPulse,
  X,
  ArrowRight,
  Clock,
  Sparkles,
  Target,
  Calendar,
  AlertCircle,
  Award,
  Users,
  TrendingUp,
  Image as ImageIcon,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import ScrollReveal from "@/components/ScrollReveal";
import PricingTiers from "@/components/PricingTiers";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


const problems = [
  {
    icon: AlertCircle,
    title: "Vas al gym sin saber qué tocar hoy",
    desc: "Cambias de rutina cada semana porque ninguna te convence.",
  },
  {
    icon: Apple,
    title: "Empiezas dietas que duran 4 días",
    desc: "Demasiado estrictas, nada realistas con tu vida.",
  },
  {
    icon: X,
    title: "Planes genéricos que no encajan contigo",
    desc: "Mismo PDF para todos. Tu lesión, tus horarios o tu nivel dan igual.",
  },
  {
    icon: HeartPulse,
    title: "Lesiones, fatiga o falta de constancia",
    desc: "Sin nadie que te guíe, abandonas a las 3 semanas.",
  },
];

const personalization = [
  { icon: Target, title: "Tu objetivo real", desc: "Perder grasa, ganar músculo, rendimiento o salud." },
  { icon: Calendar, title: "Tu tiempo disponible", desc: "Días que entrenas y minutos por sesión." },
  { icon: Sparkles, title: "Tus preferencias", desc: "Equipamiento, deportes, comidas que te gustan." },
  { icon: HeartPulse, title: "Tus lesiones y limitaciones", desc: "Adaptamos cada ejercicio a lo que tu cuerpo permite." },
];

const liveFeatures = [
  { title: "Si no progresas", desc: "Ajustamos volumen, intensidad o nutrición hasta que avances." },
  { title: "Si cambian tus horarios", desc: "Reescribimos la semana en minutos." },
  { title: "Si aparece una molestia", desc: "Sustituimos ejercicios y bajamos carga al instante." },
  { title: "Si tienes una duda", desc: "Me escribes y te respondo. Sin tickets, sin chatbots." },
];

const testimonials = [
  {
    name: "María G.",
    result: "−8 kg en 3 meses",
    text: "Lo que marcó la diferencia fue poder escribir cuando algo no iba. Ajustó la dieta dos veces hasta que encajó con mi trabajo.",
    avatar: "MG",
  },
  {
    name: "Carlos R.",
    result: "+5 kg de músculo",
    text: "No es un PDF que olvidas. Cada semana revisamos cómo va y cambiamos lo que no funciona. Por fin un plan vivo.",
    avatar: "CR",
  },
  {
    name: "Laura M.",
    result: "−12% grasa corporal",
    text: "Tuve una molestia en la rodilla y al día siguiente ya tenía el plan reajustado. Eso no te lo da ninguna app.",
    avatar: "LM",
  },
];

const faqs = [
  {
    q: "Soy principiante total. ¿Esto es para mí?",
    a: "Sí, especialmente. El plan se calibra desde tu nivel actual y tienes el chat para preguntarme cualquier cosa: cómo se hace un ejercicio, qué comer antes de entrenar, si te duele algo. Aprendes acompañado, no solo.",
  },
  {
    q: "¿Y si entreno en casa o sin material?",
    a: "Sin problema. En el cuestionario indicas qué equipamiento tienes (gym, casa, calistenia, mancuernas, gomas, lo que sea) y el plan se construye sobre eso. Cero ejercicios imposibles.",
  },
  {
    q: "¿Qué pasa si no me funciona?",
    a: "Por eso existe el chat: si no ves progreso en 2-3 semanas, lo detectamos y ajustamos. Y si aún así no estás contento, cancelas dentro de los 7 días gratis y no pagas nada.",
  },
  {
    q: "Tengo una lesión o limitación. ¿Lo tienes en cuenta?",
    a: "Es lo primero que pregunto. El plan se diseña respetando lo que tu cuerpo puede y no puede hacer. Si aparece algo nuevo durante el camino, me lo cuentas y lo modifico al momento.",
  },
  {
    q: "¿Cuánto tardas en responder en el chat?",
    a: "Normalmente en menos de 24h en días laborables. No es soporte automático: soy yo (humano) leyendo y respondiendo a tu situación concreta.",
  },
  {
    q: "¿Puedo cambiar de objetivo a mitad de camino?",
    a: "Claro. Si quieres pasar de perder grasa a ganar músculo, o cambiar deporte, me escribes y reescribimos el plan. No hay límite de cambios.",
  },
];

const Index = () => {
  const navigate = useNavigate();

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
              Empezar gratis
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-4 overflow-hidden">
        <div className="container mx-auto text-center max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8"
          >
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Plan + entrenador real por chat
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-[1.05] mb-6"
          >
            Deja de improvisar:{" "}
            <span className="text-gradient">ajusto tu entrenamiento y tu dieta contigo.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto"
          >
            Recibes un plan personalizado de entrenamiento y nutrición, me escribes
            cuando lo necesites y lo adaptamos a tu progreso, horarios y sensaciones.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Button
              variant="hero"
              size="xl"
              onClick={() => navigate("/signup")}
              className="hover-scale"
            >
              Empezar gratis (2 min)
            </Button>
            <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> Sin tarjeta para empezar · 7 días gratis · Cancela cuando quieras
            </p>
          </motion.div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-20 px-4 border-y border-border bg-card/30">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
              Si llevas tiempo intentándolo solo, esto te suena
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
              No fallas por falta de ganas. Fallas porque nadie te dice qué hacer hoy,
              mañana y la semana que viene.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-4">
            {problems.map((p, i) => (
              <ScrollReveal key={p.title} delay={i * 0.08}>
                <div className="flex items-start gap-3 bg-card border border-border rounded-xl p-5 h-full">
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <p.icon className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground/90 text-sm mb-1">{p.title}</h3>
                    <p className="text-sm text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUCIÓN */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="text-center mb-14">
              <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                Por qué Autopilot
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
                Plan personalizado <span className="text-gradient">+ ajustes continuos por chat</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                "Personalizado" no es una palabra de marketing. Significa esto:
              </p>
            </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-4">
            {personalization.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 0.08}>
                <div className="bg-card rounded-2xl p-6 border border-border h-full hover-scale transition-all duration-300">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base font-bold font-display mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* DIFERENCIADOR */}
      <section className="py-20 px-4 bg-card/50">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="text-center mb-14">
              <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                El diferenciador
              </span>
              <h2 className="text-3xl sm:text-5xl font-bold font-display mb-4 leading-tight">
                No es una app. No es un PDF.{" "}
                <span className="text-gradient">Es un plan vivo.</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                La diferencia entre cumplir tus objetivos y abandonarlos en 3 semanas
                es tener a alguien al otro lado.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 gap-4 mb-12">
            {liveFeatures.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 0.08}>
                <div className="bg-card rounded-2xl p-6 border border-primary/30 card-shadow h-full">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold font-display mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal>
            <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-16">
              <div className="bg-background/50 rounded-2xl p-6 border border-border">
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">
                  Lo de siempre
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {[
                    "PDF estático que no cambia",
                    "App automática sin nadie detrás",
                    "Plantilla genérica para todos",
                    "Soporte por tickets o bots",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-card rounded-2xl p-6 border border-primary/40 card-shadow glow-shadow">
                <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-4">
                  Autopilot
                </div>
                <ul className="space-y-2.5 text-sm">
                  {[
                    "Plan que se reescribe contigo",
                    "Una persona real (yo) en el chat",
                    "Diseñado a tu nivel, lesiones, vida",
                    "Respuesta humana cuando la necesites",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          {/* MOCKUP CHAT — réplica visual del chat real de la app */}
          <ScrollReveal delay={0.1}>
            <div className="max-w-2xl mx-auto">
              <p className="text-center text-xs uppercase tracking-widest text-primary font-semibold mb-4">
                Así es el chat por dentro
              </p>
              <div className="bg-card rounded-2xl border border-border card-shadow flex flex-col h-[500px] overflow-hidden">
                {/* Header con tabs (igual al chat real) */}
                <div className="flex items-center gap-2 p-3 border-b border-border">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary">
                    <MessageCircle className="w-4 h-4" />
                    Chat con tu entrenador
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground">
                    <ImageIcon className="w-4 h-4" />
                    Media
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">3</span>
                  </button>
                </div>

                {/* Mensajes (mismas burbujas que ChatMessages.tsx) */}
                <div className="flex-1 overflow-hidden p-4 space-y-3 bg-background/20">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
                      <span>Hoy me dolía un poco el hombro al hacer press banca 😕</span>
                      <div className="text-[10px] mt-1 text-primary-foreground/60">10:24</div>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-secondary text-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                      <span>Sin problema. Te cambio el press banca por press inclinado con mancuernas y bajamos a 3 series. ¿Cómo va el resto?</span>
                      <div className="text-[10px] mt-1 text-muted-foreground">10:31</div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
                      <span>Esta semana solo puedo entrenar L, M y V</span>
                      <div className="text-[10px] mt-1 text-primary-foreground/60">10:33</div>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-secondary text-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                      <span>Hecho ✅ Te he reorganizado la semana en 3 días sin perder volumen. Tu plan ya está actualizado.</span>
                      <div className="text-[10px] mt-1 text-muted-foreground">10:35</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]" />
                    </div>
                    <span className="text-xs text-muted-foreground">Nicolás está escribiendo…</span>
                  </div>
                </div>

                {/* Input (mismo formato que el real) */}
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2 items-center">
                    <button
                      type="button"
                      className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                      aria-label="Adjuntar imagen"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <div className="flex-1 h-10 px-3 flex items-center rounded-md border border-input bg-background text-sm text-muted-foreground">
                      Escribe un mensaje...
                    </div>
                    <button
                      type="button"
                      className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md bg-primary text-primary-foreground"
                      aria-label="Enviar"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">
                Mismo chat que verás dentro de la app. Soy yo respondiendo, no un bot.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* SOBRE MÍ */}
      <section className="py-20 px-4 border-y border-border">
        <div className="container mx-auto max-w-3xl text-center">
          <ScrollReveal>
            <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
              Quién está al otro lado del chat
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-6 leading-tight">
              Hola, soy <span className="text-gradient">Nicolás</span>.
            </h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              Llevo años ayudando a personas a mejorar su físico y rendimiento con
              planes claros y fáciles de seguir. Mi especialidad es{" "}
              <span className="text-foreground font-semibold">
                simplificar el entrenamiento y la progresión
              </span>{" "}
              para que consigas resultados reales sin complicarte.
            </p>
            <p className="text-muted-foreground mb-10 leading-relaxed">
              He trabajado con perfiles muy distintos, desde principiantes que nunca
              pisaron un gym hasta niveles avanzados de calistenia y fuerza. Por eso
              Autopilot funciona igual de bien tanto si tu objetivo es el gimnasio,
              la calistenia o un mix de los dos.
            </p>
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
                <TrendingUp className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">Enfoque</div>
                <div className="font-bold font-display">Real</div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
              Cómo funciona
            </h2>
            <p className="text-muted-foreground text-center mb-14 max-w-lg mx-auto">
              Tres pasos. El tercero es donde está el verdadero valor.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Te registras",
                desc: "Cuestionario corto: objetivo, nivel, lesiones, equipamiento, horarios.",
                time: "2 min",
              },
              {
                step: "02",
                title: "Recibes tu plan inicial",
                desc: "Entrenamiento y nutrición listos para empezar esta misma semana.",
                time: "< 48 h",
              },
              {
                step: "03",
                title: "Lo ajustamos por chat",
                desc: "Aquí está el oro. Cada cambio, duda o molestia. Tu plan evoluciona contigo.",
                time: "Continuo",
                highlight: true,
              },
            ].map((item, i) => (
              <ScrollReveal key={item.step} delay={i * 0.12}>
                <div className={`bg-card rounded-2xl p-6 card-shadow border h-full hover-scale transition-all duration-300 ${item.highlight ? "border-primary/40 glow-shadow" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl font-bold font-display text-gradient">
                      {item.step}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary rounded-full px-3 py-1">
                      <Clock className="w-3 h-3" /> {item.time}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold font-display mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* QUÉ INCLUYE */}
      <section className="py-20 px-4 bg-card/50">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-14">
              Qué incluye exactamente
            </h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-6">
            <ScrollReveal direction="left">
              <div className="bg-card rounded-2xl p-6 card-shadow border border-border h-full">
                <Dumbbell className="w-9 h-9 text-primary mb-4" />
                <h3 className="text-lg font-bold font-display mb-3">Entrenamiento</h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  {[
                    "Rutinas semanales adaptadas",
                    "Series, reps, descansos e intensidades",
                    "Adaptado a tu nivel y deporte",
                    "Vídeos y técnica de cada ejercicio",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div className="bg-card rounded-2xl p-6 card-shadow border border-border h-full">
                <Apple className="w-9 h-9 text-primary mb-4" />
                <h3 className="text-lg font-bold font-display mb-3">Nutrición</h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  {[
                    "Macros diarios calculados",
                    "Ideas de comidas reales",
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
            </ScrollReveal>
            <ScrollReveal direction="right">
              <div className="bg-card rounded-2xl p-6 border border-primary/40 card-shadow glow-shadow h-full relative">
                <span className="absolute -top-3 right-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                  Lo que cambia todo
                </span>
                <MessageCircle className="w-9 h-9 text-primary mb-4" />
                <h3 className="text-lg font-bold font-display mb-3">Acompañamiento</h3>
                <ul className="space-y-2 text-foreground/90 text-sm">
                  {[
                    "Chat directo conmigo (humano)",
                    "Ajustes constantes del plan",
                    "Resolución real de dudas",
                    "Sin tickets, sin chatbots",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
              Resultados reales
            </h2>
            <p className="text-muted-foreground text-center mb-14 max-w-lg mx-auto">
              Personas que dejaron de improvisar y empezaron a progresar.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 0.12}>
                <div className="bg-card rounded-2xl p-6 border border-border card-shadow h-full flex flex-col">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground flex-1 mb-4">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-primary font-medium">{t.result}</div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIO */}
      <section className="py-20 px-4 bg-card/50">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
                Un precio. Todo incluido.
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Compara lo que pagarías por el mismo nivel de acompañamiento.
              </p>
            </div>
          </ScrollReveal>

          {/* COMPARATIVA */}
          <ScrollReveal delay={0.1}>
            <div className="grid md:grid-cols-3 gap-4 mb-12 max-w-4xl mx-auto">
              <div className="bg-background/50 rounded-2xl p-5 border border-border opacity-70">
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                  Entrenador presencial
                </div>
                <div className="text-2xl font-bold font-display mb-1">€60+<span className="text-sm text-muted-foreground font-normal">/sesión</span></div>
                <p className="text-xs text-muted-foreground mb-3">Ves al entrenador 1-2 veces por semana. Fuera de ahí, te apañas.</p>
                <div className="text-xs text-muted-foreground">≈ €240-480/mes</div>
              </div>
              <div className="bg-background/50 rounded-2xl p-5 border border-border opacity-70">
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                  App genérica
                </div>
                <div className="text-2xl font-bold font-display mb-1">€10-15<span className="text-sm text-muted-foreground font-normal">/mes</span></div>
                <p className="text-xs text-muted-foreground mb-3">Plan automático. Sin humano detrás. No se adapta a ti.</p>
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
                <p className="text-xs text-foreground/80 mb-3">Plan personalizado + entrenador real (yo) ajustando contigo.</p>
                <div className="text-xs text-primary font-semibold">Soporte: humano</div>
              </div>
            </div>
          </ScrollReveal>

          {/* CARD PRINCIPAL */}
          <ScrollReveal delay={0.2}>
            <PricingTiers onSelect={(plan) => navigate("/signup")} />
            <div className="max-w-md mx-auto mt-6 bg-success/10 border border-success/30 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-foreground mb-0.5">Garantía 30 días</div>
                <p className="text-xs text-muted-foreground">
                  Si no notas la diferencia en 30 días, te devuelvo el dinero. Sin preguntas.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="py-20 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
              Cómo funciona
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
              En 3 pasos. Sin apps que aprender.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { n: "01", t: "Cuestionario 2 min", d: "Cuéntanos objetivo, nivel, tiempo y lesiones." },
              { n: "02", t: "Recibes tu plan", d: "Entrenos y comidas adaptados a ti, listos en minutos." },
              { n: "03", t: "Lo vives en tu Calendar", d: "Todo en Google Calendar. Te ajusto el plan por chat." },
            ].map((s, i) => (
              <ScrollReveal key={s.n} delay={i * 0.08}>
                <div className="bg-card border border-border rounded-2xl p-6 h-full">
                  <div className="text-xs font-mono text-primary mb-3">{s.n}</div>
                  <h3 className="font-bold font-display text-lg mb-2">{s.t}</h3>
                  <p className="text-sm text-muted-foreground">{s.d}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
              Resolvemos tus dudas
            </h2>
            <p className="text-muted-foreground text-center mb-12">
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
      <section className="py-24 px-4 bg-card/30 border-t border-border">
        <div className="container mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-5xl font-bold font-display mb-6 leading-[1.1]">
              Empieza hoy.{" "}
              <span className="text-gradient">Cada día sin plan es un día sin progreso.</span>
            </h2>
            <p className="text-muted-foreground mb-10 max-w-md mx-auto">
              7 días gratis. Sin permanencia. Y un entrenador real al otro lado del chat.
            </p>
            <Button
              variant="hero"
              size="xl"
              onClick={() => navigate("/signup")}
              className="hover-scale"
            >
              Quiero mi plan + acompañamiento
            </Button>
            <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> 2 minutos · 7 días gratis · Cancela
              cuando quieras
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground text-sm">
          <span className="font-display font-bold text-gradient">Autopilot</span> &copy;{" "}
          {new Date().getFullYear()}. Todos los derechos reservados.
        </div>
      </footer>

      {/* Floating CTA mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-md border-t border-border z-50 md:hidden">
        <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/signup")}>
          Empezar mis 7 días gratis
        </Button>
      </div>
    </div>
  );
};

export default Index;
