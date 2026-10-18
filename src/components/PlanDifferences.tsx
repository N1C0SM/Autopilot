import { Check, X } from "lucide-react";
import { usePlanAvailability } from "@/lib/planCatalog";
import { euro } from "@/lib/planCatalogCore";

/** comparison of features across plans - visible, clear, no jargon */
const PlanDifferences = () => {
  const p = usePlanAvailability();
  
  const plans = [
    {
      name: "Free",
      price: 0,
      tagline: "Tu rutina y tu registro.",
      features: [
        { text: "Rutina inicial según tu objetivo, días y material", included: true },
        { text: "Registro de series, repeticiones y kg", included: true },
        { text: "Historial, peso y récords", included: true },
        { text: "Análisis corporal por foto con IA (scan)", included: true },
        { text: "Plan de nutrición y macros", included: false },
        { text: "Progresión de cargas automática", included: false },
        { text: "Chat con Nicolás", included: false },
      ],
    },
    p.plus && {
      name: p.plusName,
      price: p.plusPrice,
      tagline: "Te dice qué comer y cuánto subir.",
      features: [
        { text: "Todo lo de Free", included: true },
        { text: "Plan de nutrición: calorías y macros", included: true },
        { text: "Progresión de cargas con tus registros", included: true },
        { text: "Análisis corporal por foto con IA", included: true },
        { text: "Estadísticas avanzadas", included: true },
        { text: "Chat con Nicolás", included: false },
      ],
    },
    p.coach && {
      name: p.coachName,
      price: p.coachPrice,
      tagline: "Plus + Nicolás revisando tu plan.",
      features: [
        { text: "Todo lo de Plus", included: true },
        { text: "Nicolás revisa tu plan", included: true },
        { text: "Chat directo con él dentro de la app", included: true },
        { text: "Ajustes si cambian tus horarios o material", included: true },
        { text: "Seguimiento humano tu progreso", included: true },
      ],
    },
  ].filter(Boolean) as typeof plans;

  const maxFeatures = Math.max(...plans.map((pl) => pl.features.length));

  return (
    <section className="py-12 sm:py-16 bg-card">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <p className="type-subhead text-primary">Así se diferencian los planes</p>
          <h2 className="mt-2 type-title1 sm:text-[40px] sm:leading-[44px]">Elige según lo que necesitas</h2>
          <p className="mt-4 type-body text-muted-foreground">
            Empieza gratis y añade características según avances. El scan (análisis por IA) es gratis para todos.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto">
          <div className="min-w-[800px]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="pb-4 pr-6 type-subhead text-muted-foreground min-w-[180px]">Característica</th>
                  {plans.map((pl) => (
                    <th key={pl.name} className="pb-4 type-subhead min-w-[220px]">
                      <div className="text-center">
                        <h3 className="type-title3 text-foreground">{pl.name}</h3>
                        <p className="mt-2 type-subhead text-muted-foreground">{pl.tagline}</p>
                        <div className="mt-3 flex justify-center items-baseline gap-1.5">
                          <span className={`font-rounded text-[32px] font-bold leading-none tabular-nums ${pl.price === 0 ? "text-primary" : "text-foreground"}`}>
                            {pl.price === 0 ? "0" : euro(pl.price)}
                          </span>
                          <span className="type-subhead text-muted-foreground">{pl.price === 0 ? "/mes gratis" : "/mes"}</span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from({ length: maxFeatures }).map((_, i) => {
                  const feature = plans[0].features[i];
                  if (!feature) return null;
                  return (
                    <tr key={i} className="group hover:bg-accent/20 transition-colors">
                      <td className="py-4 pr-6 type-subhead text-foreground">
                        {feature.text}
                      </td>
                      {plans.map((pl) => {
                        const hasFeature = pl.features[i]?.included ?? false;
                        return (
                          <td key={pl.name} className="py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {hasFeature ? (
                                <>
                                  <Check className="h-5 w-5 text-success shrink-0" aria-hidden="true" />
                                  <span className="type-subhead text-success font-medium">Sí</span>
                                </>
                              ) : (
                                <>
                                  <X className="h-5 w-5 text-muted-foreground/50 shrink-0" aria-hidden="true" />
                                  <span className="type-subhead text-muted-foreground/60">No</span>
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3 text-center">
          {plans.map((pl) => (
            <div key={pl.name} className={`rounded-2xl p-6 ${pl.price === 0 ? "bg-card" : "bg-card border"}`}>
              <h4 className="type-title3">{pl.name}</h4>
              <p className="mt-2 type-subhead text-muted-foreground">{pl.tagline}</p>
              <div className="mt-4 flex items-baseline justify-center gap-1.5">
                <span className={`font-rounded text-[28px] font-bold leading-none tabular-nums ${pl.price === 0 ? "text-primary" : "text-foreground"}`}>
                  {pl.price === 0 ? "0" : euro(pl.price)}
                </span>
                <span className="type-subhead text-muted-foreground">/mes</span>
              </div>
              <p className="mt-2 type-footnote text-muted-foreground">
                {pl.price === 0 
                  ? "Sin tarjeta ni prueba que cancelar" 
                  : `${pl.price === p.plusPrice ? "7" : "7"} días de prueba. Tras eso: ${euro(pl.price)}/mes. Sin permanencia.`}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center type-footnote text-muted-foreground">
          Free no caduca. Los planes de pago tienen 7 días de prueba: no se cobra hasta el día 8 y puedes cancelar antes desde Ajustes → Suscripción.
        </p>
      </div>
    </section>
  );
};

export default PlanDifferences;
