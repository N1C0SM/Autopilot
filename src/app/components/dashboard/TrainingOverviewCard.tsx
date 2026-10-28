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
    <section aria-label="Resumen de tu entrenamiento" className="relative overflow-hidden rounded-[28px] bg-card p-5">
      {/* Halo dorado como en la landing: la cifra es la protagonista. */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.18),transparent)]" />
      <p className="relative type-subhead font-semibold text-primary">Últimas 4 semanas</p>
      <p className="relative mt-1 font-rounded text-[56px] font-bold leading-none tracking-tight tabular-nums">
        {fmt(overview.last4WeeksVolumeKg)}<span className="ml-1.5 type-title3 text-muted-foreground">kg levantados</span>
      </p>
      <div className="relative mt-4 flex flex-wrap gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-1.5"><span className="font-rounded type-title3 tabular-nums">{fmt(overview.totalSessions)}</span><span className="type-subhead text-muted-foreground">{overview.totalSessions === 1 ? "entreno" : "entrenos"}</span></div>
        <div className="flex items-baseline gap-1.5"><span className="font-rounded type-title3 tabular-nums">{fmt(overview.streakWeeks)}</span><span className="type-subhead text-muted-foreground">{overview.streakWeeks === 1 ? "semana de racha" : "semanas de racha"}</span></div>
        <div className="flex items-baseline gap-1.5"><span className="font-rounded type-title3 tabular-nums">{fmt(thisWeek)}</span><span className="type-subhead text-muted-foreground">kg esta semana</span></div>
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
