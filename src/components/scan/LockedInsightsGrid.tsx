import { motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";

type Insight = { label: string; teaser: string; category?: string };

const FALLBACK: Insight[] = [
  { label: "Tu ratio calórico exacto", teaser: "Déficit/superávit en kcal y macros para tu peso, edad y NEAT" },
  { label: "Frecuencia óptima por grupo", teaser: "Cuántas veces a la semana golpear tu punto débil sin sobreentrenar" },
  { label: "Volumen prioritario semanal", teaser: "Series exactas por grupo, ajustadas a tu nivel y fatiga" },
  { label: "Orden de ejercicios", teaser: "Secuencia que maximiza tensión en el grupo que falla" },
  { label: "% grasa objetivo realista", teaser: "Hasta dónde puedes bajar sin perder músculo, según tu somatotipo" },
  { label: "Semanas hasta primer hito", teaser: "Cuándo verás el primer cambio claro en espejo" },
  { label: "Predicción de plateau", teaser: "Cuándo y por qué te vas a estancar — y cómo evitarlo" },
  { label: "Cardio mínimo efectivo", teaser: "Minutos exactos para perder grasa sin tocar tu hipertrofia" },
];

export default function LockedInsightsGrid({
  insights,
  onCta,
}: {
  insights?: Insight[];
  onCta: () => void;
}) {
  const items = (insights && insights.length >= 4 ? insights : [...(insights || []), ...FALLBACK]).slice(0, 8);

  return (
    <div className="bg-card/60 backdrop-blur border border-primary/20 rounded-2xl p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> {items.length} insights bloqueados
        </div>
        <button
          onClick={onCta}
          className="text-[10px] uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" /> Desbloquear todos
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {items.map((li, i) => (
          <motion.button
            key={i}
            onClick={onCta}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ scale: 1.02 }}
            className="group relative text-left bg-background/50 hover:bg-background/80 border border-border hover:border-primary/40 rounded-xl p-3 overflow-hidden transition-colors"
          >
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Lock className="w-3 h-3 text-primary" />
            </div>
            <div className="text-[11px] font-semibold text-foreground/90 pr-7 mb-1.5 leading-tight">
              {li.label}
            </div>
            <div className="text-[10px] text-muted-foreground blur-[3px] group-hover:blur-[2px] select-none leading-snug line-clamp-2">
              {li.teaser}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-card to-transparent flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[9px] uppercase tracking-wider text-primary font-bold">Desbloquear</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}