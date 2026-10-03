import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  ["bestEstimated1RmKg", "Fuerza"],
  ["volumeKg", "Volumen"],
  ["reps", "Reps"],
];

const ExerciseProgressChart = ({ exerciseName, history, metric, onMetricChange, compact = false }: Props) => {
  const valueOf = (entry: ExerciseHistoryEntry | undefined) => {
    if (!entry) return null;
    if (metric === "volumeKg") return entry.loadedSets > 0 ? Math.round(entry.volumeKg) : null;
    if (metric === "reps") return entry.reps;
    return entry.bestEstimated1RmKg;
  };
  const chartData = history.slice(-12).map((entry) => ({ ...entry, metricValue: valueOf(entry) }));
  const latest = valueOf(history[history.length - 1]);
  const previous = valueOf(history[history.length - 2]);
  const change = latest !== null && previous !== null ? latest - previous : null;
  const unit = metric === "reps" ? "reps" : "kg";
  const round = (v: number) => Math.round(v * 10) / 10;
  const gid = `grad-${metric}`;

  return (
    <div className={compact ? "flex h-full min-h-0 flex-col" : "flex flex-col"}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-4xl font-bold leading-none tabular-nums tracking-tight sm:text-5xl">
            {latest !== null ? round(latest) : "—"}
            <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>
          </p>
          {change !== null && (
            <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${change >= 0 ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
              {change > 0 ? "+" : ""}{round(change)} {unit} vs. anterior
            </span>
          )}
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

      <div
        className={`mt-4 w-full ${compact ? "min-h-[220px] flex-1" : "h-64"}`}
        role="img"
        aria-label={`Gráfica de ${exerciseName}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 6, left: 6, bottom: 0 }} barCategoryGap="22%">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <XAxis dataKey="sessionLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip
              cursor={{ fill: "hsl(var(--primary) / .08)" }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              formatter={(value: number) => [`${round(value)} ${unit}`, ""]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""}
            />
            <Bar dataKey="metricValue" radius={[10, 10, 4, 4]} maxBarSize={chartData.length <= 3 ? 120 : 56} isAnimationActive={false}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={`url(#${gid})`} fillOpacity={i === chartData.length - 1 ? 1 : 0.4} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ExerciseProgressChart;
