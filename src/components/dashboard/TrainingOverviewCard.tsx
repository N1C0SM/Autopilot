import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { TrainingOverview } from "@/lib/workoutMetrics";

const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");
const weekLabel = (weekStart: string) => {
  const [y, m, d] = weekStart.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
};

/**
 * Panel de entrenamiento (como el de Hevy): tres cifras y el volumen de las últimas
 * semanas en barras, con la semana actual en el acento.
 */
export function TrainingOverviewCard({ overview }: { overview: TrainingOverview }) {
  const data = overview.weeks.map((week, i) => ({
    ...week,
    label: weekLabel(week.weekStart),
    current: i === overview.weeks.length - 1,
  }));
  const stats = [
    { label: "Entrenos", value: fmt(overview.totalSessions), unit: "" },
    { label: "Racha", value: fmt(overview.streakWeeks), unit: "sem" },
    { label: "Últ. 4 sem", value: fmt(overview.last4WeeksVolumeKg), unit: "kg" },
  ];

  return (
    <section aria-label="Resumen de tu entrenamiento" className="space-y-2.5">
      <dl className="grid grid-cols-3 gap-2.5">
        {stats.map((stat, i) => (
          <div key={stat.label} className="min-w-0 rounded-2xl bg-card p-3">
            <dt className="truncate type-footnote text-muted-foreground">{stat.label}</dt>
            <dd className={`mt-0.5 truncate font-rounded text-[24px] font-bold leading-[30px] tabular-nums ${i === 0 ? "text-primary" : ""}`}>
              {stat.value}
              {stat.unit && <span className="ml-0.5 text-[14px] font-semibold text-muted-foreground">{stat.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="rounded-2xl bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="type-headline">Volumen por semana</p>
          <p className="shrink-0 type-footnote tabular-nums text-muted-foreground">
            Esta semana <span className="font-semibold text-foreground">{fmt(data[data.length - 1]?.volumeKg || 0)} kg</span>
          </p>
        </div>
        <div className="mt-3 h-36" role="img" aria-label={`Volumen de las últimas ${data.length} semanas: ${data.map((w) => `${w.label} ${fmt(w.volumeKg)} kg`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--foreground) / 0.06)", radius: 8 }}
                contentStyle={{ background: "hsl(var(--accent) / 0.92)", border: "none", borderRadius: 12, fontSize: 13 }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                formatter={(value: number, _name, item) => [`${fmt(value)} kg · ${item.payload.sessions} ${item.payload.sessions === 1 ? "entreno" : "entrenos"}`, ""]}
                separator=""
              />
              <Bar dataKey="volumeKg" radius={[6, 6, 6, 6]} minPointSize={3} animationDuration={700}>
                {data.map((week) => (
                  <Cell key={week.weekStart} fill={week.current ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.35)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
