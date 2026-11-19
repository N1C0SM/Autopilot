import { useEffect, useId, useState } from "react";
import { ArrowUp, History } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDecimal } from "@/shared/lib/numberFormat";
import { supabase } from "@/shared/integrations/supabase/client";
import { signedUrlsFor } from "@/shared/lib/storageSign";
import { FindingRow, ScanImage, StatRow } from "@/app/components/scan/ScanResultParts";

type Row = {
  id: string;
  taken_at: string;
  physique: number | null;
  current_photo_url: string | null;
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(/\./g, "");
const TOOLTIP_STYLE = {
  background: "hsl(var(--accent) / 0.92)",
  backdropFilter: "blur(20px)",
  border: "none",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
  padding: "8px 12px",
  fontSize: 13,
};

/**
 * «Tu progreso» del scan (web con cuenta): la nota de físico de cada scan en una línea dorada,
 * como las gráficas de Progreso, tres cifras y tus fotos. Solo se destaca lo que sube.
 */
export default function ScanProgressPanel({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const gradientId = `scan-area-${useId().replace(/:/g, "")}`;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("scan_history")
        .select("id, taken_at, physique, current_photo_url")
        .eq("user_id", userId)
        .order("taken_at", { ascending: true });
      if (!active) return;
      const list = (data as Row[]) || [];
      // progress-photos es privado: firmamos las rutas (y las URLs antiguas de ese bucket).
      const needsSign = (v: string | null) => !!v && (!/^https?:/i.test(v) || v.includes("/progress-photos/"));
      const values = list.map((r) => r.current_photo_url).filter((v): v is string => needsSign(v));
      const map = values.length ? await signedUrlsFor("progress-photos", values) : new Map<string, string>();
      if (!active) return;
      setRows(list.map((r) => (needsSign(r.current_photo_url) ? { ...r, current_photo_url: map.get(r.current_photo_url as string) ?? null } : r)));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading || rows.length === 0) return null;

  if (rows.length === 1) {
    return (
      <div className="rounded-card bg-card p-4">
        <FindingRow
          icon={History}
          title="Tu primer scan está guardado"
          description="Repite el análisis cada 2–4 semanas para ver tu evolución aquí."
        />
      </div>
    );
  }

  const scored = rows.filter((r) => r.physique != null);
  const first = Number(scored[0]?.physique ?? 0);
  const last = Number(scored[scored.length - 1]?.physique ?? 0);
  const gain = last - first;
  const chartData = rows.map((r, i) => ({ i, date: shortDate(r.taken_at), value: r.physique == null ? null : Number(r.physique) }));
  const lastIndex = chartData.reduce((acc, d, i) => (d.value !== null ? i : acc), -1);
  const best = scored.length ? Math.max(...scored.map((r) => Number(r.physique))) : null;
  const days = Math.max(1, Math.round((Date.now() - new Date(rows[0].taken_at).getTime()) / 86400000));

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="type-title3">Tu progreso</h2>
          <p className="mt-0.5 type-footnote tabular-nums text-muted-foreground">{rows.length} scans</p>
        </div>
        {gain >= 0.1 && (
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary/15 px-2.5 py-1 type-footnote font-semibold tabular-nums text-primary">
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />+{formatDecimal(gain, 1)} de físico
          </span>
        )}
      </div>

      <div className="rounded-card bg-card p-4">
        {!compact && scored.length > 1 && (
          <div className="relative h-44 w-full" role="img" aria-label={`Tu nota de físico: de ${formatDecimal(first, 1)} a ${formatDecimal(last, 1)}`}>
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                {/* Línea dorada sobre un degradado, rejilla tenue y el último punto resaltado (como Progreso). */}
                <AreaChart data={chartData} margin={{ top: 12, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--foreground))" strokeOpacity={0.07} />
                  <XAxis
                    dataKey="i"
                    type="number"
                    domain={[0, Math.max(1, chartData.length - 1)]}
                    ticks={[0, chartData.length - 1]}
                    axisLine={false}
                    tickLine={false}
                    tick={({ x, y, payload }: { x: number; y: number; payload: { value: number } }) => (
                      <text x={x} y={y} dy={12} textAnchor={payload.value === 0 ? "start" : "end"} fontSize={12} fill="hsl(var(--muted-foreground))">
                        {chartData[payload.value]?.date ?? ""}
                      </text>
                    )}
                  />
                  <YAxis orientation="right" width={28} domain={[0, 10]} ticks={[0, 5, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.4 }}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 2 }}
                    itemStyle={{ color: "hsl(var(--foreground))", padding: 0, fontWeight: 600 }}
                    formatter={(value: number) => [formatDecimal(value, 1), "Físico"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    connectNulls
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={(props: { cx?: number; cy?: number; index?: number }) =>
                      props.index === lastIndex && props.cx != null && props.cy != null ? (
                        <g key={`dot-${props.index}`}>
                          <circle cx={props.cx} cy={props.cy} r={9} fill="hsl(var(--primary))" fillOpacity={0.2} />
                          <circle cx={props.cx} cy={props.cy} r={4.5} fill="hsl(var(--primary))" />
                        </g>
                      ) : <g key={`dot-${props.index}`} />}
                    activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!compact && (
          <StatRow
            className="mt-3"
            stats={[
              { label: "Mejor físico", value: best === null ? "—" : formatDecimal(best, 1) },
              { label: "Desde el inicio", value: days, unit: days === 1 ? "día" : "días" },
              { label: "Scans", value: rows.length },
            ]}
          />
        )}

        <div className={`-mx-0.5 flex gap-3 overflow-x-auto p-0.5 ${compact ? "" : "mt-4"}`} data-no-swipe>
          {rows.slice(-8).map((r, idx, arr) => {
            const label = shortDate(r.taken_at);
            const isLast = idx === arr.length - 1;
            return (
              <div key={r.id} className="w-20 shrink-0">
                <ScanImage
                  src={r.current_photo_url}
                  alt={`Scan del ${label}`}
                  className={`h-[106px] w-full rounded-chip ${isLast ? "ring-2 ring-primary" : ""}`}
                />
                <p className="mt-1.5 truncate type-footnote text-muted-foreground">{label}</p>
                <p className="type-figure text-[22px] leading-none">{r.physique == null ? "—" : formatDecimal(r.physique, 1)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
