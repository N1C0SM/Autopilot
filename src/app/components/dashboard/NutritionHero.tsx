import type { ReactNode } from "react";
import { ProgressRing } from "@/shared/components/ui/progress-ring";
import { hapticTap } from "@/shared/lib/native";
import { groupedInt } from "@/shared/lib/workoutSummaryFormat";

export type NutritionTotals = { kcal: number; protein: number; carbs: number; fats: number };

/** Enteros con punto de miles siempre («2.366 kcal»), como `NumberText.grouped` en la app. */
const fmt = groupedInt;

/** Reparto de la energía del día en el anillo cuando aún no se marca nada (oro, oro 60 %, oro 32 %). */
const SPLIT_SHADES = ["hsl(var(--primary))", "hsl(var(--primary) / 0.6)", "hsl(var(--primary) / 0.32)"];

/** Aviso de los objetivos estimados, bajo el anillo (el mismo texto en la app). */
export const NUTRITION_ESTIMATE_NOTE = "Estimación según tus datos y objetivo. No sustituye una valoración nutricional individual.";

const SplitRing = ({ parts, size, stroke, children, label }: { parts: number[]; size: number; stroke: number; children: ReactNode; label: string }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = Math.max(1, parts.reduce((a, b) => a + b, 0));
  const gap = c * 0.012;
  let start = 0;
  return (
    <div role="img" aria-label={label} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth={stroke} />
        {parts.map((part, i) => {
          const len = (part / total) * c;
          const dash = Math.max(0, len - gap * 2);
          const offset = -(start + gap);
          start += len;
          return dash > 0 ? (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SPLIT_SHADES[i]} strokeWidth={stroke}
              strokeLinecap="round" strokeDasharray={`${dash} ${c}`} strokeDashoffset={offset} />
          ) : null;
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

/**
 * Cabecera de Nutrición, la única protagonista de la pantalla: el anillo de calorías y, a su lado,
 * las tres barras de macros, en una tarjeta de 28 sin textos de relleno. Con comidas marcables el
 * anillo y las barras suman lo marcado; sin ellas, el anillo reparte la energía del día entre
 * proteína, hidratos y grasas. Igual que `nutritionHero` en la app nativa.
 */
export default function NutritionHero({ target, eaten }: {
  target: NutritionTotals;
  /** Lo marcado hoy (estimado con el reparto del plan); null = solo objetivos. */
  eaten?: NutritionTotals | null;
}) {
  const energy = target.protein * 4 + target.carbs * 4 + target.fats * 9;
  const rows = [
    { label: "Proteína", value: target.protein, eaten: eaten?.protein ?? 0, energy: target.protein * 4 },
    { label: "Hidratos", value: target.carbs, eaten: eaten?.carbs ?? 0, energy: target.carbs * 4 },
    { label: "Grasas", value: target.fats, eaten: eaten?.fats ?? 0, energy: target.fats * 9 },
  ].map((m) => {
    const share = energy > 0 ? Math.round((m.energy / energy) * 100) : 0;
    const bar = eaten ? (m.value > 0 ? Math.min(100, (m.eaten / Math.max(1, Math.round(m.value))) * 100) : 0) : share;
    return { ...m, share, bar };
  });
  const center = (
    <span className="flex max-w-[104px] flex-col items-center">
      <span className="type-figure text-[32px] font-bold leading-none tabular-nums text-foreground">{fmt(eaten ? eaten.kcal : target.kcal)}</span>
      <span className="mt-1 whitespace-nowrap type-footnote tabular-nums text-muted-foreground">{eaten ? `de ${fmt(target.kcal)} kcal` : "kcal al día"}</span>
    </span>
  );

  return (
    <section aria-label="Resumen de hoy" className="rounded-[28px] bg-card p-5">
      {/* Con letra grande el anillo pasa arriba y las barras debajo, sin cortar ninguna cifra. */}
      <div className="flex flex-wrap items-center gap-5">
        {eaten ? (
          <ProgressRing value={target.kcal > 0 ? (eaten.kcal / target.kcal) * 100 : 0} size={136} stroke={12}
            label={`${fmt(eaten.kcal)} de ${fmt(target.kcal)} kcal`}>
            {center}
          </ProgressRing>
        ) : (
          <SplitRing parts={rows.map((m) => m.energy)} size={136} stroke={12}
            label={`Objetivo de ${fmt(target.kcal)} kcal: ${rows.map((m) => `${fmt(m.value)} g de ${m.label.toLowerCase()}`).join(", ")}`}>
            {center}
          </SplitRing>
        )}
        <ul aria-label="Macros del día" className="min-w-[160px] flex-1 space-y-3.5">
          {rows.map((m, i) => (
            <li key={m.label} aria-label={eaten
              ? `${m.label}: ${fmt(m.eaten)} de ${fmt(m.value)} gramos`
              : `${m.label}: objetivo diario de ${fmt(m.value)} gramos, ${m.share} % de las calorías`}>
              <div aria-hidden="true" className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 truncate type-footnote text-muted-foreground">
                  {!eaten && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SPLIT_SHADES[i] }} />}
                  {m.label}
                </span>
                <span className="shrink-0 whitespace-nowrap type-subhead font-semibold tabular-nums">
                  {eaten ? <>{fmt(m.eaten)}<span className="text-muted-foreground">/{fmt(m.value)} g</span></> : `${fmt(m.value)} g`}
                </span>
              </div>
              <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/20">
                <div className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${m.bar}%`, background: eaten ? "hsl(var(--primary))" : SPLIT_SHADES[i] }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Pie de los objetivos estimados (sin comidas): el aviso en una línea tranquila y «Actualizar mis
 * datos» como acción de texto, sin otra tarjeta. Va justo debajo del anillo. Igual que
 * `estimateNote` en la app.
 */
export function NutritionEstimateNote({ onEdit }: { onEdit?: () => void }) {
  return (
    <div className="px-1">
      <p className="type-footnote text-muted-foreground">{NUTRITION_ESTIMATE_NOTE}</p>
      {onEdit && (
        <button
          type="button"
          onClick={() => { void hapticTap(); onEdit(); }}
          className="-ml-1 mt-0.5 inline-flex min-h-11 items-center rounded-full px-1 type-footnote font-semibold text-foreground transition-opacity active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Actualizar mis datos
        </button>
      )}
    </div>
  );
}

/** Esqueleto con la forma final (anillo y tres barras) mientras llegan los objetivos, como la app. */
export function NutritionHeroSkeleton() {
  return (
    <div role="status" aria-label="Cargando tus objetivos" className="rounded-[28px] bg-card p-5">
      <div aria-hidden="true" className="flex animate-pulse items-center gap-5 motion-reduce:animate-none">
        <span className="h-[136px] w-[136px] shrink-0 rounded-full border-[12px] border-secondary" />
        <span className="flex-1 space-y-[22px]">
          <span className="block h-3 rounded-full bg-secondary" />
          <span className="block h-3 rounded-full bg-secondary" />
          <span className="block h-3 rounded-full bg-secondary" />
        </span>
      </div>
    </div>
  );
}
