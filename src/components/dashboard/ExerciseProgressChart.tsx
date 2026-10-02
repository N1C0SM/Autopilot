import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ExerciseHistoryEntry } from "@/lib/workoutMetrics";

interface Props {
  exerciseName: string;
  history: ExerciseHistoryEntry[];
  metric: "volumeKg" | "bestEstimated1RmKg";
  onMetricChange: (metric: "volumeKg" | "bestEstimated1RmKg") => void;
  compact?: boolean;
}

const ExerciseProgressChart = ({ exerciseName, history, metric, onMetricChange, compact = false }: Props) => {
  const chartData = history.slice(-12).map((entry) => ({
    ...entry,
    metricValue: metric === "volumeKg" ? Math.round(entry.volumeKg) : entry.bestEstimated1RmKg,
  }));
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const latestMetric = latest ? (metric === "volumeKg" ? latest.volumeKg : latest.bestEstimated1RmKg) : null;
  const previousMetric = previous ? (metric === "volumeKg" ? previous.volumeKg : previous.bestEstimated1RmKg) : null;
  const change = latestMetric !== null && previousMetric !== null ? latestMetric - previousMetric : null;

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" role="group" aria-label="Métrica de progresión">
        <div className="flex min-w-0 items-center gap-2">
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
            aria-pressed={metric === "bestEstimated1RmKg"}
            onClick={() => onMetricChange("bestEstimated1RmKg")}
            className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold sm:px-3 sm:text-xs ${metric === "bestEstimated1RmKg" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            Fuerza estimada
          </button>
        </div>
        {change !== null && (
          <span className={`text-right text-xs font-semibold sm:ml-auto ${change > 0 ? "text-primary" : change < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {change > 0 ? "+" : ""}{Math.round(change * 10) / 10} kg vs. sesión anterior
          </span>
        )}
      </div>

      <div
        className={`mt-3 w-full ${compact ? "h-36" : "h-56"}`}
        role="img"
        aria-label={`Gráfica de ${metric === "volumeKg" ? "volumen" : "fuerza estimada"} para ${exerciseName}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="sessionLabel" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              width={48}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(value: number) => `${Math.round(value)} kg`}
              domain={["dataMin - 5", "dataMax + 5"]}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--secondary) / .5)" }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              formatter={(value: number) => [`${Math.round(value * 10) / 10} kg`, metric === "volumeKg" ? "Volumen total" : "1RM estimado"]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""}
            />
            <Bar dataKey="metricValue" name={metric === "volumeKg" ? "Volumen total" : "1RM estimado"} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={38} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {metric === "volumeKg"
          ? "Volumen = suma de peso × repeticiones de las series completadas con carga."
          : "1RM estimado (Epley) a partir de la mejor serie completada con carga; no es una prueba máxima."}
      </p>
    </div>
  );
};

export default ExerciseProgressChart;
