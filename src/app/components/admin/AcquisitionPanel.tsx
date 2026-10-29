import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import {
  CHANNEL_LABELS,
  RANGE_OPTIONS,
  fetchAcquisitionFunnel,
  rangeDates,
  type AcquisitionFunnel,
  type ChannelFunnel,
  type RangeKey,
} from "@/shared/lib/acquisitionFunnel";

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

/** Admin → Captación: de qué red llega cada usuario y cómo avanza por el embudo. */
const AcquisitionPanel = () => {
  const [range, setRange] = useState<RangeKey>("30");
  const [data, setData] = useState<AcquisitionFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async (key: RangeKey) => {
    setLoading(true);
    try {
      setData(await fetchAcquisitionFunnel(rangeDates(key)));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(range); }, [load, range]);

  if (!data && loadError && !loading) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Captación no disponible"
        description="No se pudo cargar el embudo. Si acabas de publicar, comprueba que la migración de captación está aplicada."
        action={<Button size="lg" onClick={() => { void hapticTap(); void load(range); }}>Reintentar</Button>}
      />
    );
  }

  const tracking = data?.trackingSince ?? null;
  const total = data?.total;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="type-subhead text-muted-foreground">De qué red llega cada usuario y hasta dónde avanza.</p>
          <Button variant="ghost" size="icon" onClick={() => { void hapticTap(); void load(range); }} aria-label="Actualizar" className="-mr-3 shrink-0 text-primary [&_svg]:size-5">
            <RefreshCw />
          </Button>
        </div>
        <Tabs value={range} onValueChange={(v) => { void hapticSelection(); setRange(v as RangeKey); }}>
          <TabsList className="w-full sm:w-80" aria-label="Rango de fechas">
            {RANGE_OPTIONS.map((o) => <TabsTrigger key={o.key} value={o.key}>{o.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        {loadError && <p role="alert" className="type-footnote text-destructive">No se pudieron actualizar los datos. Se muestra la última carga correcta.</p>}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : data && total ? (
        <>
          <section aria-label="Resumen" className={cn("grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4", loading && "opacity-60")}>
            <Kpi label="Visitantes nuevos" value={tracking ? total.visits : "—"} hint={tracking ? "Primer contacto" : "Aún sin medir"} />
            <Kpi label="Scans" value={tracking ? total.scans : "—"} hint={tracking ? "Hechos en la web" : "Aún sin medir"} />
            <Kpi label="Cuentas creadas" value={total.signups} hint={tracking && total.visits > 0 ? `${pct(total.signups, total.visits)} de las visitas` : "En el rango"} accent />
            <Kpi
              label="Activos 2ª semana"
              value={total.week2Eligible > 0 ? pct(total.activeWeek2, total.week2Eligible) : "—"}
              hint={total.week2Eligible > 0 ? `${total.activeWeek2} de ${total.week2Eligible}` : "Nadie cumple 14 días"}
            />
            <Kpi label="Plus" value={total.plus} hint={`${pct(total.plus, total.signups)} de las cuentas`} />
          </section>

          <p className="px-1 type-footnote text-muted-foreground">
            {tracking
              ? `Midiendo el origen desde el ${fmtDate(tracking)}. Las cuentas anteriores aparecen como «sin origen».`
              : "El origen se empieza a medir cuando se publique esta versión: hasta entonces todas las cuentas aparecen como «sin origen» y no hay visitas ni scans registrados."}
            {" "}Activo en 2ª semana: al menos un entreno entre los días 8 y 14 desde el alta (solo cuenta a quien ya los ha cumplido). Sin cuentas de prueba ni del equipo.
          </p>

          <Card className={cn(loading && "opacity-60")}>
            <SectionHeader title="Por red" size="sm" className="mb-2" />
            <ul className="divide-y divide-border/60">
              {data.channels.map((c) => <ChannelRow key={c.channel} row={c} tracking={!!tracking} />)}
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  );
};

function ChannelRow({ row, tracking }: { row: ChannelFunnel; tracking: boolean }) {
  const empty = row.visits + row.scans + row.signups === 0;
  const stats = [
    { label: "Visitas", value: tracking ? row.visits : "—" },
    { label: "Scans", value: tracking ? row.scans : "—" },
    { label: "Activos 2ª sem.", value: row.week2Eligible > 0 ? `${row.activeWeek2}/${row.week2Eligible}` : "—" },
    { label: "Plus", value: row.plus },
  ];
  return (
    <li className={cn("py-4", empty && "opacity-50")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate type-headline">{CHANNEL_LABELS[row.channel]}</span>
        <span className="shrink-0 tabular-nums">
          <span className="type-figure text-[28px]">{row.signups}</span>
          <span className="ml-1.5 type-footnote text-muted-foreground">{row.signups === 1 ? "cuenta" : "cuentas"}</span>
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="truncate type-caption1 text-muted-foreground">{s.label}</dt>
            <dd className="font-rounded type-headline tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

/** Tarjeta del sistema: sin borde, 22 px. */
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-2xl bg-card p-5", className)}>{children}</section>;
}

/** Cifra clave en tarjeta; `accent` la marca en dorado (una por pantalla). */
function Kpi({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl bg-card p-4 lg:p-5">
      <p className="truncate type-footnote text-muted-foreground">{label}</p>
      <p className={cn("mt-2 truncate type-figure text-[34px] lg:text-[40px]", accent && "text-primary")}>{value}</p>
      {hint ? <p className="mt-1 truncate type-footnote text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default AcquisitionPanel;
