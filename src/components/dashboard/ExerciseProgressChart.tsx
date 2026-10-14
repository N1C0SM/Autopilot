import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hapticSelection } from "@/lib/native";
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

const AXIS_TICK = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const TOOLTIP_STYLE = {
  background: "hsl(var(--accent) / 0.92)",
  backdropFilter: "blur(20px)",
  border: "none",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
  padding: "8px 12px",
  fontSize: 13,
};

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
  const min = values.length ? Math.min(...values) : 0;
  const pad = best !== null ? Math.max(1, (best - min) * 0.15) : 1;

  return (
    <div className={compact ? "flex h-full min-h-0 flex-col" : "flex flex-col"}>
      <div className="min-w-0">
        <p className="font-rounded text-[44px] font-bold leading-none tabular-nums sm:text-[56px]">
          {latest !== null ? round(latest) : "—"}
          <span className="ml-1.5 type-callout font-semibold text-muted-foreground">{unit}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 type-footnote tabular-nums text-muted-foreground">
          {totalChange !== null && values.length > 1 && (
            <span className={totalChange >= 0 ? "font-semibold text-success" : "font-semibold"}>
              {totalChange > 0 ? "+" : ""}{round(totalChange)}% desde el inicio
            </span>
          )}
          {best !== null && <span>Mejor: {round(best)} {unit}</span>}
          <span>{history.length} {history.length === 1 ? "sesión" : "sesiones"}</span>
        </div>
      </div>

      <Tabs
        value={metric}
        onValueChange={(next) => {
          void hapticSelection();
          onMetricChange(next as Metric);
        }}
        className="mt-4"
      >
        <TabsList aria-label="Métrica" className="w-full md:w-auto">
          {METRICS.map(([k, label]) => (
            <TabsTrigger key={k} value={k}>{label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {values.length < 2 ? (
        <div className={`mt-4 flex w-full flex-col justify-end rounded-2xl bg-secondary p-4 ${compact ? "min-h-[200px] flex-1" : "h-64"}`}>
          <div className="flex flex-1 items-end gap-2" aria-hidden>
            {[0.18, 0.26, 0.34, 0.42, 0.5].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-lg bg-accent" style={{ height: `${h * 100}%` }} />
            ))}
            <div className="relative flex-1 rounded-t-lg bg-primary" style={{ height: "58%" }}>
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap type-caption1 font-semibold tabular-nums text-primary">
                {latest !== null ? round(latest) : "—"} {unit}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 sep-t">
            <p className="type-subhead font-semibold">Punto de partida · {history[history.length - 1]?.sessionLabel}</p>
            <p className="mt-0.5 type-footnote text-muted-foreground">Registra otra sesión de este ejercicio y aquí verás tu línea de progreso.</p>
          </div>
        </div>
      ) : (
      <div className={`mt-4 w-full ${compact ? "min-h-[200px] flex-1" : "h-64"}`} role="img" aria-label={`Gráfica de ${exerciseName}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeWidth={0.5} />
            <XAxis dataKey="sessionLabel" axisLine={false} tickLine={false} minTickGap={16} tick={AXIS_TICK} />
            <YAxis
              orientation="right"
              width={36}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              domain={[Math.max(0, Math.floor(min - pad)), Math.ceil((best ?? 0) + pad)]}
              tick={AXIS_TICK}
            />
            {best !== null && values.length > 1 && (
              <ReferenceLine y={best} stroke="hsl(var(--primary))" strokeOpacity={0.35} strokeDasharray="3 4" />
            )}
            <Tooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.4 }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 2 }}
              itemStyle={{ color: "hsl(var(--foreground))", padding: 0, fontWeight: 600 }}
              formatter={(value: number) => [`${round(value)} ${unit}`, METRICS.find(([k]) => k === metric)?.[1] ?? ""]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""}
            />
            <Area
              type="monotone"
              dataKey="metricValue"
              connectNulls
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="hsl(var(--primary))"
              fillOpacity={0.12}
              dot={{ r: 3, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
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
