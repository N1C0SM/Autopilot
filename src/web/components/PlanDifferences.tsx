import { Check, X } from "lucide-react";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import { euro } from "@/shared/lib/planCatalogCore";

/** comparison of features across plans - visible, clear, no jargon */
const PlanDifferences = () => {
  const p = usePlanAvailability();
  
  type Value = boolean | string;
  /** Una fila por característica y el valor de cada plan en la MISMA fila (antes se emparejaban
   *  por posición y, como las listas no iban en el mismo orden, la tabla mezclaba cosas). */
  const rows: { text: string; free: Value; plus: Value; coach: Value }[] = [
    { text: "Rutina según tu objetivo, días y material", free: true, plus: true, coach: true },
    { text: "Registro de series, repeticiones y kg", free: true, plus: true, coach: true },
    { text: "Historial, peso y récords", free: true, plus: true, coach: true },
    { text: "Calorías y macros para tu objetivo", free: true, plus: true, coach: true },
    { text: "Scan básico: nota de tu físico, resumen y 2 mejoras", free: true, plus: true, coach: true },
    { text: "Scan avanzado: composición, músculos, postura, protocolo y tu yo futuro", free: false, plus: true, coach: true },
    { text: "Comidas de cada día según tus gustos", free: false, plus: true, coach: true },
    { text: "Progresión de cargas automática", free: false, plus: true, coach: true },
    { text: "Estadísticas avanzadas", free: false, plus: true, coach: true },
    { text: "Revisión humana de tu plan", free: false, plus: false, coach: true },
  ];
  const plans = [
    { key: "free" as const, name: "Free", price: 0, tagline: "Tu rutina, tu registro y tus macros." },
    p.plus && { key: "plus" as const, name: p.plusName, price: p.plusPrice, tagline: "Tu scan completo y tus comidas." },
    p.coach && { key: "coach" as const, name: p.coachName, price: p.coachPrice, tagline: "Plus con revisión humana." },
  ].filter(Boolean) as { key: "free" | "plus" | "coach"; name: string; price: number; tagline: string }[];
  // Una fila que ningún plan visible incluye es de un plan oculto: no se anuncia.
  const visibleRows = rows.filter((r) => plans.some((pl) => r[pl.key] !== false));
  const cell = (v: Value, compact = false) => typeof v === "string"
    ? <span className={`type-subhead font-semibold ${v === "Básico" ? "text-foreground" : "text-primary"}`}>{v}</span>
    : v
      ? <><Check className={`${compact ? "h-4 w-4" : "h-5 w-5"} shrink-0 text-primary`} aria-hidden="true" /><span className={compact ? "sr-only" : "type-subhead font-medium"}>Sí</span></>
      : <><X className={`${compact ? "h-4 w-4" : "h-5 w-5"} shrink-0 text-muted-foreground/50`} aria-hidden="true" /><span className={compact ? "sr-only" : "type-subhead text-muted-foreground/60"}>No</span></>;

  return (
    <section className="py-12 sm:py-16 bg-card">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <p className="type-subhead text-primary">Así se diferencian los planes</p>
          <h2 className="mt-2 type-title1 sm:text-[40px] sm:leading-[44px]">Elige según lo que necesitas</h2>
          <p className="mt-4 type-body text-muted-foreground">
            Empieza gratis con tu rutina, tus macros y un scan básico. Con Plus ves tu scan completo y tus comidas de cada día.
          </p>
        </div>

        {/* Móvil: una fila por característica, con cada plan debajo; sin tabla que se salga de la pantalla. */}
        <ul className="mt-10 overflow-hidden rounded-2xl bg-card md:hidden">
          {visibleRows.map((row) => (
            <li key={row.text} className="px-4 py-4 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border/60">
              <p className="type-subhead text-foreground">{row.text}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                {plans.map((pl) => (
                  <span key={pl.key} className="inline-flex items-center gap-1.5 type-footnote">
                    <span className="text-muted-foreground">{pl.name}</span>{cell(row[pl.key], true)}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 hidden overflow-x-auto md:block">
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
                          <span className={`type-figure text-[32px] font-bold leading-none tabular-nums ${pl.price === 0 ? "text-primary" : "text-foreground"}`}>
                            {pl.price === 0 ? "Gratis" : euro(pl.price)}
                          </span>
                          {pl.price > 0 && <span className="type-subhead text-muted-foreground">/mes</span>}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map((row) => (
                  <tr key={row.text} className="group hover:bg-accent/20 transition-colors">
                    <td className="py-4 pr-6 type-subhead text-foreground">{row.text}</td>
                    {plans.map((pl) => (
                      <td key={pl.key} className="py-4 text-center">
                        <div className="flex items-center justify-center gap-2">{cell(row[pl.key])}</div>
                      </td>
                    ))}
                  </tr>
                ))}
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
                <span className={`type-figure text-[28px] font-bold leading-none tabular-nums ${pl.price === 0 ? "text-primary" : "text-foreground"}`}>
                  {pl.price === 0 ? "Gratis" : euro(pl.price)}
                </span>
                {pl.price > 0 && <span className="type-subhead text-muted-foreground">/mes</span>}
              </div>
              <p className="mt-2 type-footnote text-muted-foreground">
                {pl.price === 0 
                  ? "Sin tarjeta ni prueba que cancelar" 
                  : `7 días de prueba. Tras eso: ${euro(pl.price)}/mes. Sin permanencia.`}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center type-footnote text-muted-foreground">
          Free no caduca.{(p.plus || p.coach) && " Los planes de pago tienen 7 días de prueba: no se cobra hasta el día 8 y puedes cancelar antes desde Ajustes → Suscripción."}
        </p>
      </div>
    </section>
  );
};

export default PlanDifferences;
