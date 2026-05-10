import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Upload,
  Brain,
  Target,
  ScanLine,
  TrendingUp,
  Zap,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ScrollReveal from "@/components/ScrollReveal";
import { useNavigate } from "react-router-dom";

const steps = [
  {
    icon: Upload,
    title: "Sube tu foto",
    desc: "Una foto de cuerpo completo. Privada, segura y solo para ti.",
  },
  {
    icon: Brain,
    title: "La IA analiza tu físico",
    desc: "Composición, postura, simetría y atractivo estético.",
  },
  {
    icon: Target,
    title: "Recibes tu plan",
    desc: "Entrenamiento + nutrición para llegar a tu mejor versión.",
  },
];

const improvements = [
  { label: "Más volumen en hombros", priority: "Alta" },
  { label: "Mejorar postura torácica", priority: "Alta" },
  { label: "Definir pecho superior", priority: "Media" },
  { label: "Reducir grasa abdominal", priority: "Media" },
];

const faqs = [
  {
    q: "¿Es realmente IA?",
    a: "Sí. Usamos modelos de visión avanzados para analizar tu físico, postura y proporciones. El plan posterior lo construyo yo, persona real.",
  },
  {
    q: "¿Mis fotos son privadas?",
    a: "Totalmente. Solo las vemos tú y yo. No se comparten, no se publican, no se usan para entrenar modelos.",
  },
  {
    q: "¿Cuánto tarda el análisis?",
    a: "Menos de 60 segundos. El plan personalizado completo lo recibes en menos de 48h.",
  },
  {
    q: "¿Y si no me gusta el resultado?",
    a: "Tienes 7 días gratis y 30 días de garantía. Sin permanencia. Cancelas cuando quieras.",
  },
];

const AIScanSection = () => {
  const navigate = useNavigate();
  const [scanProgress, setScanProgress] = useState(0);
  const [scoreAttract, setScoreAttract] = useState(0);
  const [scorePotential, setScorePotential] = useState(0);
  const [scorePhysique, setScorePhysique] = useState(0);
  const [scoreStyle, setScoreStyle] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setScanProgress((p) => (p >= 100 ? 0 : p + 2));
    }, 60);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const animate = (target: number, setter: (n: number) => void, delay = 0) => {
      setTimeout(() => {
        let cur = 0;
        const id = setInterval(() => {
          cur += target / 30;
          if (cur >= target) {
            setter(target);
            clearInterval(id);
          } else setter(parseFloat(cur.toFixed(1)));
        }, 35);
      }, delay);
    };
    animate(6.8, setScoreAttract, 200);
    animate(8.5, setScorePotential, 400);
    animate(7.2, setScorePhysique, 600);
    animate(6.5, setScoreStyle, 800);
  }, []);

  return (
    <div className="relative">
      {/* HERO IA SCAN */}
      <section className="relative py-32 px-4 overflow-hidden border-y border-border">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_70%)]" />
        </div>

        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Texto */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm mb-6"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Nuevo · AI Scan
                </span>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-[1.05] mb-6"
              >
                Descubre cómo verte{" "}
                <span className="text-gradient">más atractivo</span> con IA
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-lg text-muted-foreground mb-8 leading-relaxed"
              >
                Analiza tu físico, detecta qué te limita y recibe un plan
                personalizado para mejorar tu cuerpo y estética.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Button
                  variant="hero"
                  size="xl"
                  onClick={() => navigate("/scan")}
                  className="hover-scale group"
                >
                  <ScanLine className="w-5 h-5 mr-1" />
                  Escanear mi físico gratis
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex items-center gap-4 mt-8 text-xs text-muted-foreground"
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  100% privado
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  Análisis en 60s
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  7 días gratis
                </div>
              </motion.div>
            </div>

            {/* Mockup Dashboard */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative"
            >
              {/* Glow halo */}
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent rounded-3xl blur-2xl opacity-60" />

              <div className="relative bg-card/80 backdrop-blur-xl border border-primary/20 rounded-3xl p-6 card-shadow overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                      <Brain className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">AI Physique Scan</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        Análisis completo
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    v2.4
                  </span>
                </div>

                {/* Scores big */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-background/60 border border-border rounded-2xl p-4 relative overflow-hidden">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                      Atractivo
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold font-display text-gradient">
                        {scoreAttract.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">/10</span>
                    </div>
                    <ScoreBar value={scoreAttract * 10} />
                  </div>
                  <div className="bg-background/60 border border-primary/30 rounded-2xl p-4 relative overflow-hidden glow-shadow">
                    <div className="text-[10px] uppercase tracking-widest text-primary mb-1 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Potencial
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold font-display text-gradient">
                        {scorePotential.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">/10</span>
                    </div>
                    <ScoreBar value={scorePotential * 10} />
                  </div>
                </div>

                {/* Sub scores */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <MiniScore label="Físico" value={scorePhysique} />
                  <MiniScore label="Estilo" value={scoreStyle} />
                </div>

                {/* Top mejoras */}
                <div className="bg-background/60 border border-border rounded-2xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" /> Top mejoras detectadas
                  </div>
                  <ul className="space-y-2">
                    {improvements.map((m, i) => (
                      <motion.li
                        key={m.label}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {m.label}
                        </span>
                        <span
                          className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            m.priority === "Alta"
                              ? "bg-primary/15 text-primary"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {m.priority}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Scan line */}
                <div className="absolute inset-x-0 top-0 h-full pointer-events-none overflow-hidden">
                  <div
                    className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_hsl(var(--primary))]"
                    style={{ top: `${scanProgress}%`, opacity: 0.6 }}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="py-28 px-4">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <div className="text-center mb-14">
              <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                Cómo funciona el scan
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3 leading-tight">
                3 pasos. <span className="text-gradient">60 segundos.</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-5 relative">
            {/* Línea conectora */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            {steps.map((s, i) => (
              <ScrollReveal key={s.title} delay={i * 0.1}>
                <div className="relative bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-6 h-full hover-scale transition-all duration-300 hover:border-primary/40 hover:bg-card group">
                  <div className="absolute -top-3 left-6 bg-background border border-primary/30 px-2 py-0.5 rounded-full text-[10px] font-bold text-primary">
                    0{i + 1}
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <s.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold font-display mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARA TU OBJETIVO */}
      <section className="py-28 px-4 bg-card/30 border-y border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal>
              <span className="inline-block text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                Compara tu objetivo
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-5 leading-tight">
                Sube tu físico actual{" "}
                <span className="text-gradient">y tu físico ideal.</span>
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                La IA compara ambas imágenes y te dice exactamente qué te falta,
                cuánto tardarías y qué músculos priorizar para acercarte a tu
                referencia.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Detección de gaps musculares específicos",
                  "Estimación realista de tiempo (meses)",
                  "Priorización inteligente de grupos musculares",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl blur-xl" />
                <div className="relative grid grid-cols-2 gap-3">
                  <ComparisonCard label="Actual" sim={42} highlight={false} />
                  <ComparisonCard label="Objetivo" sim={100} highlight />
                </div>
                <div className="relative mt-3 bg-card/80 backdrop-blur-sm border border-primary/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span className="text-muted-foreground">Similitud al objetivo</span>
                    <span className="font-bold text-primary">42%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: "42%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                    />
                  </div>
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    Tiempo estimado: <span className="text-foreground font-semibold">~7 meses</span> con plan
                    personalizado y constancia.
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* PUENTE A COACHING */}
      <section className="py-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[160px]" />
        </div>
        <div className="container mx-auto max-w-4xl text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-5xl font-bold font-display mb-5 leading-tight">
              La IA detecta el problema.{" "}
              <span className="text-gradient">Yo te ayudo a transformarlo.</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              El scan es solo el principio. Después construimos un plan real
              contigo y te acompañamos cada semana hasta que lo consigas.
            </p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-3 gap-4 mb-12 max-w-3xl mx-auto">
            {[
              { icon: Target, title: "Entrenamiento", desc: "100% personalizado a tu cuerpo" },
              { icon: Sparkles, title: "Nutrición", desc: "Adaptada a tu vida real" },
              { icon: User, title: "Seguimiento real", desc: "Persona detrás, no un bot" },
            ].map((c, i) => (
              <ScrollReveal key={c.title} delay={i * 0.1}>
                <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-5 h-full hover:border-primary/40 transition-colors">
                  <c.icon className="w-5 h-5 text-primary mx-auto mb-3" />
                  <div className="font-bold font-display text-sm mb-1">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.desc}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={0.2}>
            <Button
              variant="hero"
              size="xl"
              onClick={() => navigate("/signup")}
              className="hover-scale group"
            >
              Quiero mi plan personalizado
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              7 días gratis · Sin permanencia
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ AI SCAN */}
      <section className="py-24 px-4 bg-card/20 border-t border-border">
        <div className="container mx-auto max-w-2xl">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-center mb-10">
              Sobre el <span className="text-gradient">AI Scan</span>
            </h2>
          </ScrollReveal>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`item-${i}`}
                className="bg-card/60 border border-border rounded-xl px-4 backdrop-blur-sm"
              >
                <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
};

const ScoreBar = ({ value }: { value: number }) => (
  <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
    <motion.div
      initial={{ width: 0 }}
      whileInView={{ width: `${value}%` }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="h-full bg-gradient-to-r from-primary to-primary/60"
    />
  </div>
);

const MiniScore = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-background/40 border border-border rounded-xl p-3">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-bold font-display">{value.toFixed(1)}</span>
    </div>
    <ScoreBar value={value * 10} />
  </div>
);

const ComparisonCard = ({
  label,
  sim,
  highlight,
}: {
  label: string;
  sim: number;
  highlight: boolean;
}) => (
  <div
    className={`relative aspect-[3/4] rounded-2xl border overflow-hidden flex items-end p-3 ${
      highlight
        ? "border-primary/40 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent glow-shadow"
        : "border-border bg-gradient-to-br from-secondary to-card"
    }`}
  >
    {/* Silueta */}
    <svg
      viewBox="0 0 100 140"
      className={`absolute inset-0 w-full h-full ${
        highlight ? "text-primary/50" : "text-muted-foreground/30"
      }`}
      fill="currentColor"
    >
      <circle cx="50" cy="22" r="10" />
      <path d="M30 38 Q50 32 70 38 L75 70 Q70 75 65 75 L65 110 Q65 130 55 132 L55 95 L45 95 L45 132 Q35 130 35 110 L35 75 Q30 75 25 70 Z" />
    </svg>
    <div className="relative z-10 w-full flex items-center justify-between">
      <span
        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
          highlight
            ? "bg-primary text-primary-foreground"
            : "bg-background/80 text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">
        {sim}%
      </span>
    </div>
  </div>
);

export default AIScanSection;