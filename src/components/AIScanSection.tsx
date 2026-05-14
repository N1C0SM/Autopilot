import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Brain,
  ScanLine,
  TrendingUp,
  Zap,
  ArrowRight,
  Lock,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const improvements = [
  { label: "Más volumen en hombros", priority: "Alta", locked: false },
  { label: "Mejorar postura torácica", priority: "Alta", locked: false },
  { label: "Definir pecho superior", priority: "Media", locked: true },
  { label: "Reducir grasa abdominal", priority: "Media", locked: true },
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
    <section className="relative py-24 px-4 overflow-hidden border-y border-border">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/[0.06] blur-[120px]" />
      </div>

      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12 max-w-xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 mb-5"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Paso 0 · Diagnóstico gratis
            </span>
          </motion.div>

          <h2 className="text-3xl sm:text-4xl font-bold font-display leading-[1.1] mb-4">
            Antes de empezar,{" "}
            <span className="text-gradient">te leemos el cuerpo</span>
          </h2>

          <p className="text-base text-muted-foreground leading-relaxed">
            Sube una foto. La IA detecta tus puntos débiles en 60s.
            Después tu entrenador construye el plan que los corrige.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          {/* Mock card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative order-2 lg:order-1"
          >
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/25 via-primary/5 to-transparent rounded-3xl blur-2xl opacity-70" />

            <div className="relative bg-card/90 backdrop-blur-xl border border-primary/15 rounded-3xl p-5 sm:p-6 premium-shadow overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
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
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  60s
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-background/60 border border-border rounded-2xl p-4 relative overflow-hidden">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    Estado actual
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold font-display">
                      {scoreAttract.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">/10</span>
                  </div>
                  <ScoreBar value={scoreAttract * 10} muted />
                </div>
                <div className="bg-background/60 border border-primary/40 rounded-2xl p-4 relative overflow-hidden glow-shadow">
                  <div className="text-[10px] uppercase tracking-widest text-primary mb-1 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Tu potencial
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
                  <TrendingUp className="w-3 h-3" /> Prioridades detectadas
                </div>
                <ul className="space-y-2.5">
                  {improvements.map((m, i) => (
                    <motion.li
                      key={m.label}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 + i * 0.08 }}
                      className={`flex items-center justify-between text-xs ${
                        m.locked ? "opacity-50" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {m.locked ? (
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                        <span className={m.locked ? "blur-[3px] select-none" : ""}>
                          {m.label}
                        </span>
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
                <div className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground text-center">
                  Análisis completo desbloqueado dentro del coaching
                </div>
              </div>

              <div className="absolute inset-x-0 top-0 h-full pointer-events-none overflow-hidden rounded-3xl">
                <div
                  className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_hsl(var(--primary))]"
                  style={{ top: `${scanProgress}%`, opacity: 0.6 }}
                />
              </div>
            </div>
          </motion.div>

          {/* Connection narrative */}
          <div className="order-1 lg:order-2 space-y-6">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-7 h-7 shrink-0 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-[11px] font-bold text-primary">
                  1
                </div>
                <div>
                  <div className="font-display font-semibold text-sm mb-1">La IA detecta qué falla</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Postura, simetría, prioridades visuales y composición corporal estimada.
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowDown className="w-4 h-4 text-primary/60" />
              </div>

              <div className="flex gap-3">
                <div className="w-7 h-7 shrink-0 rounded-lg bg-primary text-primary-foreground border border-primary flex items-center justify-center text-[11px] font-bold">
                  2
                </div>
                <div>
                  <div className="font-display font-semibold text-sm mb-1">Tu entrenador lo convierte en plan</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Yo leo tu diagnóstico, hablo contigo y construyo el entrenamiento + nutrición que cierra esa brecha.
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="hero"
              size="lg"
              onClick={() => navigate("/scan")}
              className="hover-scale group w-full sm:w-auto"
            >
              <ScanLine className="w-4 h-4 mr-1" />
              Hacer mi diagnóstico gratis
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Sin registro previo · 100% privado · 60 segundos
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const ScoreBar = ({ value, muted = false }: { value: number; muted?: boolean }) => (
  <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
    <motion.div
      initial={{ width: 0 }}
      whileInView={{ width: `${value}%` }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className={`h-full ${
        muted
          ? "bg-muted-foreground/40"
          : "bg-gradient-to-r from-primary to-primary/60"
      }`}
    />
  </div>
);

export default AIScanSection;
