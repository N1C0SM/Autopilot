import type { ReactNode } from "react";
import type { Profile } from "@/pages/Admin";
import { MONTHLY_ESTIMATE_NOTE, summarizeClientPlans } from "@/lib/adminMetrics";
import { cn } from "@/lib/utils";

/** Cifra protagonista sobre negro: etiqueta, número grande y una línea de contexto. */
export function HeroFigure({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <p className="type-subhead text-muted-foreground">{label}</p>
      <p className="mt-1 font-rounded text-[48px] font-bold leading-[52px] tabular-nums">{value}</p>
      {hint ? <p className="mt-1 type-footnote text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export interface StatItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

// Con cuatro cifras la fila es 2 × 2 en estrecho. `fourUpAt` decide desde qué ancho de pantalla
// pasa a cuatro columnas: en una columna a media pantalla hace falta más ancho para que ninguna etiqueta se corte.
// Las clases van completas (y sin pisarse entre sí) para que Tailwind las genere.
const FOUR_UP = {
  sm: {
    grid: "grid-cols-2 sm:grid-cols-4",
    cells: ["", "pl-3 sep-l", "max-sm:sep-t sm:pl-3 sm:sep-l", "pl-3 sep-l max-sm:sep-t"],
  },
  "2xl": {
    grid: "grid-cols-2 2xl:grid-cols-4",
    cells: ["", "pl-3 sep-l", "max-2xl:sep-t 2xl:pl-3 2xl:sep-l", "pl-3 sep-l max-2xl:sep-t"],
  },
} as const;

/** Fila de cifras al estilo Salud: sin cajas, separadas por líneas finas. */
export function StatRow({
  items,
  className,
  fourUpAt = "sm",
}: {
  items: StatItem[];
  className?: string;
  fourUpAt?: keyof typeof FOUR_UP;
}) {
  const four = items.length === 4;
  return (
    <dl className={cn("grid sep-t sep-b", four ? FOUR_UP[fourUpAt].grid : "grid-cols-3", className)}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "flex min-w-0 flex-col py-3 pr-3",
            four ? FOUR_UP[fourUpAt].cells[index] : index > 0 && "pl-3 sep-l",
          )}
        >
          <dt className="type-footnote text-muted-foreground">{item.label}</dt>
          <dd className="whitespace-nowrap font-rounded text-[28px] font-bold leading-[34px] tabular-nums">{item.value}</dd>
          {item.hint ? <dd className="type-footnote text-muted-foreground">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

interface Props {
  users: Profile[];
}

const AdminStats = ({ users }: Props) => {
  const { total, counts, estimatedMonthly } = summarizeClientPlans(users);

  return (
    <section aria-label="Resumen">
      <HeroFigure label="Estimación mensual" value={estimatedMonthly.toLocaleString("es-ES") + " €"} />
      <StatRow
        className="mt-5 md:max-w-2xl"
        items={[
          { label: "Clientes", value: total },
          { label: "Plus", value: counts.plus },
          { label: "Coach", value: counts.coach },
        ]}
      />
      <p className="mt-3 type-footnote text-muted-foreground">{MONTHLY_ESTIMATE_NOTE}</p>
    </section>
  );
};

export default AdminStats;
