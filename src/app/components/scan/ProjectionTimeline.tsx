import { TrendingUp, TrendingDown } from "lucide-react";
import { hapticTap } from "@/shared/lib/native";

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
    <section>
      <h2 className="type-title2">Proyección a {m} meses</h2>
      <p className="type-subhead text-muted-foreground mt-1">
        Mismo punto de partida, dos escenarios. Proyección orientativa: no es una promesa de resultados.
      </p>

      <div className="grid md:grid-cols-2 gap-10 md:gap-12 mt-6">
        <div>
          <div className="flex items-center gap-3">
            <TrendingDown className="w-7 h-7 text-muted-foreground shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <div className="type-headline">Sin plan · {mNo} meses</div>
              <div className="type-subhead text-muted-foreground tabular-nums">Puntuación {without.toFixed(1)}</div>
            </div>
          </div>
          <div className="h-1 rounded-full bg-secondary overflow-hidden mt-4 mb-5">
            <div className="h-full bg-muted-foreground/60" style={{ width: `${without * 10}%` }} />
          </div>
          <ul className="space-y-3 type-subhead text-muted-foreground">
            <li>
              Mismo cuello de botella: <span className="text-foreground">{bottleneck || "falta de estructura"}</span>
            </li>
            <li>Volumen mal distribuido: fatiga sin progreso</li>
            <li>Macros a ojo: recomposición más lenta</li>
            <li>Probablemente el siguiente scan seguiría igual</li>
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-primary shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <div className="type-headline">Con plan · {m} meses</div>
              <div className="type-subhead text-muted-foreground">Objetivo orientativo</div>
            </div>
          </div>
          <div className="h-1 rounded-full bg-secondary overflow-hidden mt-4 mb-5">
            <div className="h-full bg-primary" style={{ width: `${target * 10}%` }} />
          </div>
          <ol className="space-y-3">
            {milestones.map((mile, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-14 shrink-0 type-subhead font-semibold text-primary tabular-nums">Mes {mile.month}</span>
                <span className="type-subhead text-muted-foreground">{mile.label}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => {
              void hapticTap();
              onCta();
            }}
            className="mt-4 -ml-3 min-h-[44px] px-3 type-headline text-primary active:opacity-60 transition-opacity"
          >
            Empezar mi plan
          </button>
        </div>
      </div>
    </section>
  );
}
