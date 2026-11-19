import { Button } from "@/shared/components/ui/button";
import { formatDecimal } from "@/shared/lib/numberFormat";
import { hapticTap } from "@/shared/lib/native";
import { monthsText } from "@/shared/lib/scanResultFormat";

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
    priorities[0] ? `${priorities[0]}: cambio claro en el espejo` : "Cambio claro en el espejo",
    priorities[1] ? `${priorities[1]}: más simetría` : "Composición corporal en objetivo",
    "Tu físico objetivo, a tu alcance",
  ];
  const m = Math.max(2, monthsWithPlan || 4);
  const points = [1, Math.max(1, Math.round(m / 3)), Math.max(1, Math.round((m * 2) / 3)), m];
  return base.map((label, i) => ({ month: points[i], label }));
};

/**
 * Proyección del scan público (visitantes): por tu cuenta frente a con plan, en dos tarjetas sin
 * borde. Orientativa y dicho así; nada de cifras inventadas fuera de lo que da el análisis.
 */
export default function ProjectionTimeline({
  currentScore,
  monthsWithPlan,
  monthsWithoutPlan,
  priorities = [],
  bottleneck,
  onCta,
}: Props) {
  const target = Math.min(10, currentScore + 2.5);
  const m = Math.max(1, Math.round(monthsWithPlan ?? 4));
  const mNo = Math.max(m + 1, Math.round(monthsWithoutPlan ?? Math.max(m + 6, 12)));
  const milestones = milestonesFor(priorities, m);

  return (
    <section className="flex flex-col gap-2.5">
      <header>
        <h2 className="type-title3">Tu proyección a {monthsText(m)}</h2>
        <p className="mt-0.5 type-footnote text-muted-foreground">
          Mismo punto de partida, dos caminos. Proyección orientativa: no es una promesa de resultados.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-card bg-card p-4">
          <p className="type-headline">Por tu cuenta</p>
          <p className="mt-0.5 type-footnote tabular-nums text-muted-foreground">Unos {monthsText(mNo)} · hoy {formatDecimal(currentScore, 1)}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
            <div className="h-full rounded-full bg-foreground/40" style={{ width: `${currentScore * 10}%` }} />
          </div>
          <ul className="mt-4 flex flex-col gap-2.5 type-subhead text-muted-foreground">
            <li>Lo que más te frena: <span className="text-foreground">{bottleneck || "la falta de estructura"}</span></li>
            <li>Volumen a ojo: progreso más lento</li>
            <li>Macros a ojo: recomposición más lenta</li>
          </ul>
        </div>

        <div className="rounded-card bg-card p-4">
          <p className="type-headline">Con tu plan</p>
          <p className="mt-0.5 type-footnote tabular-nums text-muted-foreground">{monthsText(m)} · objetivo orientativo</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${target * 10}%` }} />
          </div>
          <ol className="mt-4 flex flex-col gap-2.5">
            {milestones.map((mile, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-14 shrink-0 whitespace-nowrap type-subhead font-semibold tabular-nums text-primary">Mes {mile.month}</span>
                <span className="type-subhead text-muted-foreground">{mile.label}</span>
              </li>
            ))}
          </ol>
          <Button
            variant="plain"
            className="-ml-3 mt-2"
            onClick={() => {
              void hapticTap();
              onCta();
            }}
          >
            Empezar mi plan
          </Button>
        </div>
      </div>
    </section>
  );
}
