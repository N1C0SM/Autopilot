import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ExerciseHistoryEntry } from "@/lib/workoutMetrics";

interface Props {
  exerciseName: string;
  history: ExerciseHistoryEntry[];
  metric: "volumeKg" | "reps" | "bestEstimated1RmKg";
  onMetricChange: (metric: "volumeKg" | "reps" | "bestEstimated1RmKg") => void;
  compact?: boolean;
}

const ExerciseProgressChart = ({ exerciseName, history, metric, onMetricChange, compact = false }: Props) => {
  const chartData = history.slice(-12).map((entry) => ({
    ...entry,
    metricValue: metric === "volumeKg"
      ? entry.loadedSets > 0 ? Math.round(entry.volumeKg) : null
      : metric === "reps" ? entry.reps : entry.bestEstimated1RmKg,
  }));
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const metricValue = (entry: ExerciseHistoryEntry | undefined) => {
    if (!entry) return null;
    if (metric === "volumeKg") return entry.loadedSets > 0 ? entry.volumeKg : null;
    if (metric === "reps") return entry.reps;
    return entry.bestEstimated1RmKg;
  };
  const latestMetric = metricValue(latest);
  const previousMetric = metricValue(previous);
  const change = latestMetric !== null && previousMetric !== null ? latestMetric - previousMetric : null;
  const unit = metric === "reps" ? " reps" : " kg";
  const metricName = metric === "volumeKg" ? "volumen" : metric === "reps" ? "repeticiones" : "fuerza estimada";
  const metricLabel = metric === "volumeKg" ? "Volumen (kg)" : metric === "reps" ? "Repeticiones" : "Fuerza estimada";
  const formatValue = (value: number) => `${Math.round(value * 10) / 10}${unit}`;

  return (
    <div className={compact ? "flex h-full min-h-0 flex-col" : undefined}>
      {compact ? (
        <div className="flex items-center justify-between gap-2">
          <select
            aria-label="Métrica de progresión"
            value={metric}
            onChange={(e) => onMetricChange(e.target.value as Props["metric"])}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-semibold"
          >
            <option value="volumeKg">Volumen (kg)</option>
            <option value="reps">Repeticiones</option>
            <option value="bestEstimated1RmKg">Fuerza estimada</option>
          </select>
          {change !== null && (
            <span className="text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
              {change > 0 ? "+" : ""}{Math.round(change * 10) / 10}{unit} vs. anterior
            </span>
          )}
        </div>
      ) : (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" role="group" aria-label="Métrica de progresión">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
          <button
            type="button"
            aria-pressed={metric === "volumeKg"}
            onClick={() => onMetricChange("volumeKg")}
            className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold sm:px-3 sm:text-xs ${metric === "volumeKg" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            Volumen (kg)
          </button>
          <button
            type="button"
            aria-pressed={metric === "reps"}
            onClick={() => onMetricChange("reps")}
            className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold sm:px-3 sm:text-xs ${metric === "reps" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            Repeticiones
          </button>
          <button
            type="button"
            aria-pressed={metric === "bestEstimated1RmKg"}
            onClick={() => onMetricChange("bestEstimated1RmKg")}
            className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold sm:px-3 sm:text-xs ${metric === "bestEstimated1RmKg" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            Fuerza estimada
          </button>
        </div>
        {change !== null && (
          <span className="text-right text-xs font-semibold text-muted-foreground sm:ml-auto">
            {change > 0 ? "+" : ""}{Math.round(change * 10) / 10}{unit} vs. sesión anterior
          </span>
        )}
      </div>
      )}

      <div
        className={`mt-2 w-full ${compact ? "min-h-0 flex-1" : "h-56"}`}
        role="img"
        aria-label={`Gráfica de ${metricName} para ${exerciseName}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="sessionLabel" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              width={48}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(value: number) => `${Math.round(value)}${metric === "reps" ? "" : " kg"}`}
              domain={metric === "reps" ? ["dataMin - 1", "dataMax + 1"] : ["dataMin - 5", "dataMax + 5"]}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--secondary) / .5)" }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              formatter={(value: number) => [formatValue(value), metricLabel]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""}
            />
            <Bar dataKey="metricValue" name={metricLabel} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={38} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!compact && <p className="mt-1 text-[10px] text-muted-foreground">
        {metric === "volumeKg"
          ? "Volumen = suma de peso × repeticiones de las series completadas con carga."
          : metric === "reps"
            ? "Repeticiones totales de las series completadas; compara también cuántas series hiciste."
            : "1RM estimado (Epley) a partir de la mejor serie completada con carga; no es una prueba máxima."}
      </p>}
    </div>
  );
};

export default ExerciseProgressChart;
