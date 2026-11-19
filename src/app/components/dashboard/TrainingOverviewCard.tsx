import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { TrainingOverview } from "@/shared/lib/workoutMetrics";
import { groupedInt } from "@/shared/lib/workoutSummaryFormat";

/** Enteros con punto de miles siempre («2.366»), como `NumberText.grouped` en la app. */
const fmt = (n: number) => groupedInt(n);
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
  // Sin series con peso, «0 kg» desanimaba: se cuentan los entrenos (como la app).
  const hasKg = overview.last4WeeksVolumeKg > 0;

  // Cifras pequeñas en tres columnas (valor arriba, etiqueta debajo), como `stat` en la app.
  const stats = [
    ...(hasKg ? [{ value: fmt(overview.totalSessions), label: overview.totalSessions === 1 ? "entreno" : "entrenos" }] : []),
    { value: fmt(overview.streakWeeks), label: overview.streakWeeks === 1 ? "semana de racha" : "semanas de racha" },
    ...(hasKg ? [{ value: fmt(thisWeek), label: "kg esta semana" }] : []),
  ];

  return (
    <section aria-label="Resumen de tu entrenamiento" className="relative overflow-hidden rounded-[28px] bg-card p-5">
      <p className="type-subhead text-muted-foreground">Últimas 4 semanas</p>
      {/* Cifra protagonista en Big Shoulders; la unidad baja entera si no cabe. */}
      <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
        <span className="type-figure text-[52px] leading-none">{hasKg ? fmt(overview.last4WeeksVolumeKg) : fmt(overview.totalSessions)}</span>
        <span className="whitespace-nowrap type-title3 text-muted-foreground">{hasKg ? "kg levantados" : overview.totalSessions === 1 ? "entreno" : "entrenos"}</span>
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <p className="truncate type-title3 tabular-nums">{stat.value}</p>
            <p className="type-footnote text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      {!hasKg && <p className="mt-4 type-subhead text-muted-foreground">Registra series con peso y aquí verás tus kilos de cada semana.</p>}
      {hasKg && <div className="relative">
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
      </div>}
    </section>
  );
}
