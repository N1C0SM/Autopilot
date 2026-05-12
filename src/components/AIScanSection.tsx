import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Brain,
  ScanLine,
  TrendingUp,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const improvements = [
  { label: "Más volumen en hombros", priority: "Alta" },
  { label: "Mejorar postura torácica", priority: "Alta" },
  { label: "Definir pecho superior", priority: "Media" },
];

const AIScanSection = () => {
  const navigate = useNavigate();
  const [scanProgress, setScanProgress] = useState(0);
  const [scoreAttract, setScoreAttract] = useState(0);
  const [scorePotential, setScorePotential] = useState(0);

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
  }, []);

  return (
    <section className="relative py-20 px-4 overflow-hidden border-y border-border">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_70%)]" />
      </div>

      <div className="container mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm mb-5"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Nuevo · AI Scan
              </span>
            </motion.div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display leading-[1.05] mb-5">
              Descubre cómo verte{" "}
              <span className="text-gradient">más atractivo</span> con IA
            </h2>

            <p className="text-base text-muted-foreground mb-7 leading-relaxed">
              Sube una foto, la IA analiza tu físico y te dice qué priorizar para llegar a tu mejor versión.
              Análisis en 60s, 100% privado.
            </p>

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
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent rounded-3xl blur-2xl opacity-60" />

            <div className="relative bg-card/80 backdrop-blur-xl border border-primary/20 rounded-3xl p-6 card-shadow overflow-hidden">
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
              </div>

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

              <div className="bg-background/60 border border-border rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" /> Mejoras detectadas
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

export default AIScanSection;
