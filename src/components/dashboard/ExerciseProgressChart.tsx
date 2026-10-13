import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";
import type { ExerciseHistoryEntry } from "@/lib/workoutMetrics";

type Metric = "volumeKg" | "reps" | "bestEstimated1RmKg";

interface Props {
  exerciseName: string;
  history: ExerciseHistoryEntry[];
  metric: Metric;
  onMetricChange: (metric: Metric) => void;
  compact?: boolean;
}

const METRICS: [Metric, string][] = [
  ["bestEstimated1RmKg", "1RM"],
  ["volumeKg", "Volumen"],
  ["reps", "Reps"],
];

const round = (v: number) => Math.round(v * 10) / 10;

const ExerciseProgressChart = ({ exerciseName, history, metric, onMetricChange, compact = false }: Props) => {
  const valueOf = (entry: ExerciseHistoryEntry | undefined) => {
    if (!entry) return null;
    if (metric === "volumeKg") return entry.loadedSets > 0 ? Math.round(entry.volumeKg) : null;
    if (metric === "reps") return entry.reps;
    return entry.bestEstimated1RmKg;
  };
  const chartData = history.slice(-16).map((entry) => ({ ...entry, metricValue: valueOf(entry) }));
  const values = chartData.map((d) => d.metricValue).filter((v): v is number => v !== null);
  const latest = valueOf(history[history.length - 1]);
  const first = values[0] ?? null;
  const best = values.length ? Math.max(...values) : null;
  const totalChange = latest !== null && first !== null && first > 0 ? ((latest - first) / first) * 100 : null;
  const unit = metric === "reps" ? "reps" : "kg";
  const gid = `area-${metric}`;
  const min = values.length ? Math.min(...values) : 0;
  const pad = best !== null ? Math.max(1, (best - min) * 0.15) : 1;

  return (
    <div className={compact ? "flex h-full min-h-0 flex-col" : "flex flex-col"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-5xl font-bold leading-none tabular-nums tracking-[-0.045em] sm:text-6xl">
            {latest !== null ? round(latest) : "—"}
            <span className="ml-1.5 align-top text-base font-medium tracking-normal text-muted-foreground">{unit}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] tabular-nums text-muted-foreground">
            {totalChange !== null && values.length > 1 && (
              <span className={totalChange >= 0 ? "font-semibold text-primary" : "font-semibold"}>
                {totalChange > 0 ? "+" : ""}{round(totalChange)}% desde el inicio
              </span>
            )}
            {best !== null && <span>Mejor: {round(best)} {unit}</span>}
            <span>{history.length} {history.length === 1 ? "sesión" : "sesiones"}</span>
          </div>
        </div>
        <div role="tablist" aria-label="Métrica" className="flex shrink-0 rounded-full bg-secondary/60 p-0.5">
          {METRICS.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={metric === k}
              onClick={() => onMetricChange(k)}
              className={`relative h-8 rounded-full px-3 text-xs font-semibold transition-colors ${metric === k ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              {metric === k && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 600, damping: 40 }} />}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {values.length < 2 ? (
        <div className={`mt-4 flex w-full flex-col justify-end rounded-2xl border border-border/60 bg-secondary/20 p-4 ${compact ? "min-h-[200px] flex-1" : "h-64"}`}>
          <div className="flex flex-1 items-end gap-2" aria-hidden>
            {[0.18, 0.26, 0.34, 0.42, 0.5].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-lg border border-dashed border-border" style={{ height: `${h * 100}%` }} />
            ))}
            <div className="relative flex-1 rounded-t-lg bg-primary" style={{ height: "58%" }}>
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tabular-nums text-primary">
                {latest !== null ? round(latest) : "—"} {unit}
              </span>
            </div>
          </div>
          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="text-sm font-semibold">Punto de partida · {history[history.length - 1]?.sessionLabel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Registra otra sesión de este ejercicio y aquí verás tu línea de progreso.</p>
          </div>
        </div>
      ) : (
      <div className={`mt-4 w-full ${compact ? "min-h-[200px] flex-1" : "h-64"}`} role="img" aria-label={`Gráfica de ${exerciseName}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="sessionLabel" axisLine={false} tickLine={false} minTickGap={16} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              orientation="right"
              width={36}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              domain={[Math.max(0, Math.floor(min - pad)), Math.ceil((best ?? 0) + pad)]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            {best !== null && values.length > 1 && (
              <ReferenceLine y={best} stroke="hsl(var(--primary))" strokeOpacity={0.35} strokeDasharray="3 4" />
            )}
            <Tooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.4 }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              formatter={(value: number) => [`${round(value)} ${unit}`, METRICS.find(([k]) => k === metric)?.[1] ?? ""]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""}
            />
            <Area
              type="monotone"
              dataKey="metricValue"
              connectNulls
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill={`url(#${gid})`}
              dot={{ r: 2.5, fill: "hsl(var(--background))", stroke: "hsl(var(--primary))", strokeWidth: 1.5 }}
              activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
};

export default ExerciseProgressChart;
