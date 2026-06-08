import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Sparkles } from "lucide-react";

type Props = {
  currentScore: number; // 0-10 (physique)
  monthsWithPlan?: number;
  monthsWithoutPlan?: number;
  priorities?: string[]; // ej. ["Pecho", "Espalda"]
  bottleneck?: string;
  onCta: () => void;
};

const milestonesFor = (priorities: string[], monthsWithPlan: number) => {
  const base = [
    "Primera ganancia visible (energía, postura, definición)",
    priorities[0] ? `${priorities[0]}: cambio claro en espejo` : "Cambio claro en espejo",
    priorities[1] ? `${priorities[1]}: simetría restaurada` : "Composición corporal en objetivo",
    "Físico objetivo bloqueado",
  ];
  const m = Math.max(2, monthsWithPlan || 4);
  const points = [1, Math.round(m / 3), Math.round((m * 2) / 3), m];
  return base.map((label, i) => ({ month: points[i], label }));
};

export default function ProjectionTimeline({
  currentScore,
  monthsWithPlan,
  monthsWithoutPlan,
  priorities = [],
  bottleneck,
  onCta,
}: Props) {
  const target = Math.min(10, currentScore + 2.5);
  const without = currentScore; // sin plan: mismo punto
  const m = monthsWithPlan ?? 4;
  const mNo = monthsWithoutPlan ?? Math.max(m + 6, 12);
  const milestones = milestonesFor(priorities, m);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="max-w-5xl mx-auto mt-10"
    >
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Proyección a {m} meses
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Mismo cuerpo, dos futuros. La diferencia no la marca la genética, la marca el sistema.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* SIN PLAN */}
        <div className="relative bg-card/40 backdrop-blur border border-border rounded-2xl p-5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-muted/10 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                  Sin plan · {mNo} meses
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">Score {without.toFixed(1)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden mb-4">
              <div className="h-full bg-muted-foreground/40" style={{ width: `${without * 10}%` }} />
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• Mismo cuello de botella: <span className="italic">{bottleneck || "falta de estructura"}</span></li>
              <li>• Volumen mal distribuido → fatiga sin progreso</li>
              <li>• Macros a ojo → recomp imposible</li>
              <li>• En {mNo} meses, el mismo scan dirá lo mismo</li>
            </ul>
          </div>
        </div>

        {/* CON PLAN */}
        <div className="relative bg-card/80 backdrop-blur border border-primary/40 rounded-2xl p-5 overflow-hidden">
          <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-widest text-primary font-semibold">
                  Con plan · {m} meses
                </span>
              </div>
              <span className="text-[10px] text-primary">Score {target.toFixed(1)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden mb-4">
              <motion.div
                initial={{ width: `${without * 10}%` }}
                whileInView={{ width: `${target * 10}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-primary/70 to-primary"
              />
            </div>
            <ol className="space-y-2 text-xs">
              {milestones.map((mile, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-10 text-[10px] font-mono uppercase tracking-wider text-primary">
                    Mes {mile.month}
                  </span>
                  <span className="text-foreground/90">{mile.label}</span>
                </li>
              ))}
            </ol>
            <button
              onClick={onCta}
              className="mt-4 w-full text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
            >
              Empezar mi plan →
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}