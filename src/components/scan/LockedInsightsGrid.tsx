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
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="type-title3">
          {hasRealInsights ? `${items.length} insights bloqueados` : "Ejemplos de lo que incluye tu plan"}
        </h3>
        <button
          type="button"
          onClick={handle}
          className="min-h-[44px] shrink-0 type-subhead font-semibold text-primary active:opacity-60 transition-opacity"
        >
          Desbloquear todos
        </button>
      </div>
      {!hasRealInsights && (
        <p className="type-footnote text-muted-foreground px-1 -mt-1 mb-2">
          Ejemplos del tipo de recomendaciones que recibes con un plan. Las tuyas se calculan con tu análisis.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 md:grid-cols-4 md:gap-x-4">
        {items.map((li, i) => (
          <button
            key={i}
            type="button"
            onClick={handle}
            className="sep-b last:border-b-0 flex items-start gap-3 py-3 min-h-[44px] text-left active:opacity-60 transition-opacity md:flex-col md:gap-2"
          >
            <Lock className="w-5 h-5 mt-0.5 text-primary shrink-0" strokeWidth={2} />
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
