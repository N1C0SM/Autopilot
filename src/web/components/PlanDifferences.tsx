import { Check, X } from "lucide-react";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import { euro } from "@/shared/lib/planCatalogCore";

/** comparison of features across plans - visible, clear, no jargon */
const PlanDifferences = () => {
  const p = usePlanAvailability();
  
  type Value = boolean | string;
  /** Una fila por característica y el valor de cada plan en la MISMA fila (antes se emparejaban
   *  por posición y, como las listas no iban en el mismo orden, la tabla mezclaba cosas). */
  type Group = "Entrenamiento" | "Nutrición" | "Análisis" | "Acompañamiento";
  const rows: { text: string; group: Group; free: Value; plus: Value; coach: Value }[] = [
    { text: "Rutina según tu objetivo, días y material", group: "Entrenamiento", free: true, plus: true, coach: true },
    { text: "Registro de series, repeticiones y kg", group: "Entrenamiento", free: true, plus: true, coach: true },
    { text: "Historial, peso y récords", group: "Entrenamiento", free: true, plus: true, coach: true },
    { text: "Progresión de cargas automática", group: "Entrenamiento", free: false, plus: true, coach: true },
    { text: "Calorías y macros para tu objetivo", group: "Nutrición", free: true, plus: true, coach: true },
    { text: "Comidas de cada día según tus gustos", group: "Nutrición", free: false, plus: true, coach: true },
    { text: "Scan corporal con IA", group: "Análisis", free: "Básico", plus: "Completo", coach: "Completo" },
    { text: "Composición, músculos, postura y protocolo del scan", group: "Análisis", free: false, plus: true, coach: true },
    { text: "Tu yo futuro y comparativa de scans", group: "Análisis", free: false, plus: true, coach: true },
    { text: "Estadísticas avanzadas", group: "Análisis", free: false, plus: true, coach: true },
    { text: "Revisión humana de tu plan", group: "Acompañamiento", free: false, plus: false, coach: true },
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

        {/* Móvil: cabecera con los planes una sola vez y una rejilla alineada por columnas.
            Antes cada fila repetía «Free / Plus» y no había forma de comparar de un vistazo. */}
        <div className="mt-10 md:hidden">
          <div
            className="grid items-end gap-x-3 border-b border-border pb-3"
            style={{ gridTemplateColumns: `1fr repeat(${plans.length}, minmax(0, 4.5rem))` }}
          >
            <p className="type-footnote text-muted-foreground">Incluido en</p>
            {plans.map((pl) => (
              <p
                key={pl.key}
                className={`text-center type-footnote font-semibold ${pl.price === 0 ? "text-muted-foreground" : "text-primary"}`}
              >
                {pl.name}
              </p>
            ))}
          </div>

          {(["Entrenamiento", "Nutrición", "Análisis", "Acompañamiento"] as const).map((group) => {
            const groupRows = visibleRows.filter((r) => r.group === group);
            if (!groupRows.length) return null;
            return (
              <div key={group}>
                <p className="pt-5 pb-1 type-footnote font-semibold uppercase tracking-[0.1em] text-muted-foreground">{group}</p>
                {groupRows.map((row) => (
                  <div
                    key={row.text}
                    className="grid items-center gap-x-3 border-b border-border/60 py-3 last:border-b-0"
                    style={{ gridTemplateColumns: `1fr repeat(${plans.length}, minmax(0, 4.5rem))` }}
                  >
                    <p className="type-subhead text-foreground">{row.text}</p>
                    {plans.map((pl) => (
                      <div key={pl.key} className="flex justify-center">
                        {cell(row[pl.key], true)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

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

        <p className="mt-8 text-center type-footnote text-muted-foreground">
          Free no caduca.{(p.plus || p.coach) && " Los planes de pago tienen 7 días de prueba: no se cobra hasta el día 8 y puedes cancelar antes desde Ajustes → Suscripción."}
        </p>
      </div>
    </section>
  );
};

export default PlanDifferences;
