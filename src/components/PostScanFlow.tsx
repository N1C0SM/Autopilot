import { motion } from "framer-motion";
import { Brain, UserCheck, ClipboardList, Repeat, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const STEPS = [
  { icon: Brain, title: "La IA detecta tus prioridades físicas", desc: "Postura, simetría, masa muscular y zonas con mayor margen de mejora." },
  { icon: UserCheck, title: "Un entrenador revisa tu caso", desc: "Yo leo tu diagnóstico, tu objetivo y tus horarios reales." },
  { icon: ClipboardList, title: "Recibes un plan adaptado", desc: "Entrenamiento y nutrición a medida de tu nivel, material y disponibilidad." },
  { icon: Repeat, title: "Cada semana se ajusta", desc: "El plan evoluciona contigo según resultados, sensaciones y agenda." },
];

const PostScanFlow = () => {
  const navigate = useNavigate();
  return (
    <section className="py-24 px-4 bg-card/30 border-y border-border">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12 max-w-xl mx-auto">
          <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
            Qué pasa después del scan
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
            Tu diagnóstico se convierte{" "}
            <span className="text-gradient">en un plan</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-card/60 border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Paso {i + 1}
                </span>
              </div>
              <h3 className="font-display font-semibold text-sm mb-1.5 leading-snug">
                {s.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Button
            variant="hero"
            size="lg"
            onClick={() => navigate("/scan")}
            className="hover-scale group"
          >
            Empezar con mi diagnóstico gratis
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <p className="text-[11px] text-muted-foreground mt-3">
            Gratis · Sin tarjeta · 60 segundos
          </p>
        </div>
      </div>
    </section>
  );
};

export default PostScanFlow;
