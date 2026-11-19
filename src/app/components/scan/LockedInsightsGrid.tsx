import { LockKeyhole } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";

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
  // Si la IA no devolvió insights suficientes usamos ejemplos, y lo decimos: nunca
  // los presentamos como si fueran el análisis real de este usuario.
  const hasRealInsights = !!insights && insights.length >= 4;
  const items = (hasRealInsights ? insights! : [...(insights || []), ...FALLBACK]).slice(0, 8);

  const handle = () => {
    void hapticTap();
    onCta();
  };

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 type-title3">
          {hasRealInsights ? `Tus ${items.length} claves por desbloquear` : "Lo que incluye tu plan"}
        </h2>
        <Button variant="plain" size="sm" className="-mr-3 shrink-0" onClick={handle}>
          Desbloquear
        </Button>
      </div>
      {!hasRealInsights && (
        <p className="type-footnote text-muted-foreground">
          Ejemplos del tipo de recomendaciones que recibes con un plan. Las tuyas se calculan con tu análisis.
        </p>
      )}
      <ul className="overflow-hidden rounded-card bg-card">
        {items.map((li, i) => (
          <li key={i} className={cn(i > 0 && "sep-t")}>
            <button
              type="button"
              onClick={handle}
              className="flex min-h-[56px] w-full items-start gap-3 px-4 py-3 text-left transition-opacity active:opacity-60"
            >
              <LockKeyhole className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block type-headline">{li.label}</span>
                <span aria-hidden="true" className="mt-0.5 block line-clamp-2 select-none type-subhead text-muted-foreground blur-[3px]">
                  {li.teaser}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
