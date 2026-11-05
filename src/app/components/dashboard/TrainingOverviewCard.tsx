import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { TrainingOverview } from "@/shared/lib/workoutMetrics";

const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");
const weekLabel = (weekStart: string) => {
  const [y, m, d] = weekStart.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
};

/**
 * Panel de entrenamiento con la identidad de la landing: una cifra protagonista,
 * tres datos secundarios y el volumen de las últimas semanas en la misma tarjeta.
 */
export function TrainingOverviewCard({ overview }: { overview: TrainingOverview }) {
  const data = overview.weeks.map((week, i) => ({
    ...week,
    label: weekLabel(week.weekStart),
    current: i === overview.weeks.length - 1,
  }));
  const thisWeek = data[data.length - 1]?.volumeKg || 0;

  return (
    <section aria-label="Resumen de tu entrenamiento" className="relative overflow-hidden rounded-[22px] border border-border bg-card p-5">
      <p className="relative text-xs font-semibold uppercase tracking-[0.16em] text-primary">Últimas 4 semanas</p>
      <p className="relative mt-2 text-[52px] font-semibold leading-none tracking-tight tabular-nums">
        {fmt(overview.last4WeeksVolumeKg)}<span className="ml-1.5 type-title3 text-muted-foreground">kg levantados</span>
      </p>
      <div className="relative mt-4 flex flex-wrap gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-1.5"><span className="text-[20px] font-semibold tabular-nums">{fmt(overview.totalSessions)}</span><span className="type-subhead text-muted-foreground">{overview.totalSessions === 1 ? "entreno" : "entrenos"}</span></div>
        <div className="flex items-baseline gap-1.5"><span className="text-[20px] font-semibold tabular-nums">{fmt(overview.streakWeeks)}</span><span className="type-subhead text-muted-foreground">{overview.streakWeeks === 1 ? "semana de racha" : "semanas de racha"}</span></div>
        <div className="flex items-baseline gap-1.5"><span className="text-[20px] font-semibold tabular-nums">{fmt(thisWeek)}</span><span className="type-subhead text-muted-foreground">kg esta semana</span></div>
      </div>
      <div className="relative">
        <div className="mt-5 h-40" role="img" aria-label={`Volumen de las últimas ${data.length} semanas: ${data.map((w) => `${w.label} ${fmt(w.volumeKg)} kg`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                // Una fecha sí y otra no, terminando en la semana actual: a 12 px no se pisan (como la app).
                tickFormatter={(value: string, index: number) => ((data.length - 1 - index) % 2 === 0 ? value : "")}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--foreground) / 0.06)", radius: 8 }}
                contentStyle={{ background: "hsl(var(--accent) / 0.92)", border: "none", borderRadius: 12, fontSize: 13 }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                formatter={(value: number, _name, item) => [`${fmt(value)} kg · ${item.payload.sessions} ${item.payload.sessions === 1 ? "entreno" : "entrenos"}`, ""]}
                separator=""
              />
              <Bar dataKey="volumeKg" radius={[3, 3, 3, 3]} barSize={14} minPointSize={3} animationDuration={700}>
                {data.map((week) => (
                  <Cell key={week.weekStart} fill={week.current ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.14)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
