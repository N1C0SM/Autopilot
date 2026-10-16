import { Lock } from "lucide-react";
import { hapticTap } from "@/lib/native";

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
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 type-title2">
          {hasRealInsights ? `${items.length} insights bloqueados` : "Ejemplos de lo que incluye tu plan"}
        </h2>
        <button
          type="button"
          onClick={handle}
          className="-mr-3 min-h-[44px] shrink-0 px-3 type-body text-primary active:opacity-60 transition-opacity"
        >
          Desbloquear todos
        </button>
      </div>
      {!hasRealInsights && (
        <p className="type-footnote text-muted-foreground mt-1">
          Ejemplos del tipo de recomendaciones que recibes con un plan. Las tuyas se calculan con tu análisis.
        </p>
      )}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        {items.map((li, i) => (
          <button
            key={i}
            type="button"
            onClick={handle}
            className="sep-b last:border-b-0 flex items-start gap-3 py-3 min-h-[44px] text-left active:opacity-60 transition-opacity"
          >
            <Lock className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="type-headline block">{li.label}</span>
              <span className="type-subhead block text-muted-foreground blur-[3px] select-none line-clamp-2 mt-0.5">
                {li.teaser}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
