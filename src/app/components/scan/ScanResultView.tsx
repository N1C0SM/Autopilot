import type { ReactNode } from "react";
import { Minus, Target } from "lucide-react";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { cn } from "@/shared/lib/utils";
import { formatDecimal } from "@/shared/lib/numberFormat";
import { groupedInt } from "@/shared/lib/workoutSummaryFormat";
import {
  improvementList, isHighPriority, meterFraction, monthsText, objectiveMonths, scoreText, sentence, signedKcal,
  type ScanResultData,
} from "@/shared/lib/scanResultFormat";
import ScanPlusCard from "./ScanPlusCard";

/**
 * Resultado del scan, calcado de `ScanResultView` en la app (la referencia), en el mismo orden:
 * tu foto con la nota de físico, Atractivo · Potencial · Estilo, el objetivo (si lo hay), el
 * resumen, «Qué mejorar», la lectura estimada por IA (Plus) y lo que desbloquea Plus.
 * Lo usan Progreso → Scan y el scan público; cada pantalla pone debajo sus acciones.
 */
export default function ScanResultView({ result, photo, objectivePhoto, onUpgrade }: {
  result: ScanResultData;
  /** La foto del propio scan (delante o, si no hay, espalda). */
  photo?: string | null;
  /** La foto del físico objetivo, si se eligió. */
  objectivePhoto?: string | null;
  /** Web pública: «Ver mi scan completo con Plus» en el scan básico. */
  onUpgrade?: () => void;
}) {
  const months = objectiveMonths(result);
  const similarity = typeof result.similarity === "number" && result.similarity > 0 ? Math.round(result.similarity) : null;
  return (
    <div className="flex flex-col gap-[18px]">
      <ScanHero result={result} photo={photo} />

      <div className="grid grid-cols-3 gap-3">
        <ScoreTile label="Atractivo" value={result.attractiveness} />
        <ScoreTile label="Potencial" value={result.potential} accent />
        <ScoreTile label="Estilo" value={result.style} />
      </div>

      {months && (
        <section aria-label="Tu físico objetivo" className="flex flex-col gap-4 rounded-card bg-card p-[18px]">
          <div className="flex items-center gap-4">
            {objectivePhoto && (
              <img src={objectivePhoto} alt="" decoding="async" className="h-[88px] w-[66px] shrink-0 rounded-chip bg-secondary object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="type-footnote text-muted-foreground">Hasta tu físico objetivo</p>
              <p className="mt-1 whitespace-nowrap">
                <span className="type-figure text-[40px] leading-none">{groupedInt(months.withPlan)}</span>
                <span className="ml-1.5 type-subhead text-muted-foreground">{months.withPlan === 1 ? "mes" : "meses"}</span>
              </p>
              {months.withoutPlan !== null && (
                <p className="mt-1.5 type-footnote tabular-nums text-muted-foreground">Con plan, frente a unos {monthsText(months.withoutPlan)} sin plan.</p>
              )}
            </div>
          </div>
          {similarity !== null && (
            <Meter label="Similitud con tu objetivo" value={`${similarity} %`} fraction={similarity / 100} strong={similarity >= 70} />
          )}
        </section>
      )}

      {result.summary?.trim() && (
        <p className="rounded-card bg-card p-[18px] type-body text-foreground/85">{result.summary.trim()}</p>
      )}

      <ScanImprovements result={result} />

      <ScanDetail result={result} />

      {result.basic && <ScanPlusCard sections={result.locked_sections} onUpgrade={onUpgrade} />}
    </div>
  );
}

/** Tarjeta protagonista: tu foto y la nota de físico en Big Shoulders, con la frase del diagnóstico. */
function ScanHero({ result, photo }: { result: ScanResultData; photo?: string | null }) {
  const has = typeof result.physique === "number";
  const headline = result.headline_diagnosis?.trim();
  return (
    <section className="rounded-sheet bg-card p-5">
      <h3 className="sr-only">{`Tu físico: ${has ? `${scoreText(result.physique)} sobre 10` : "sin puntuación global"}`}</h3>
      <div className="flex items-center gap-4" aria-hidden="true">
        {photo && (
          <img src={photo} alt="" decoding="async" className="h-[132px] w-[99px] shrink-0 rounded-media bg-secondary object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="type-title3">Tu físico</p>
          <p className="mt-2 whitespace-nowrap">
            <span className="type-figure text-[64px] leading-none">{scoreText(result.physique)}</span>
            {has && <span className="ml-1 type-title3 text-muted-foreground">/10</span>}
          </p>
          <p className="mt-1.5 type-footnote text-muted-foreground">{has ? "Puntuación global de tu físico" : "Sin puntuación global"}</p>
        </div>
      </div>
      {headline && <p className="mt-4 type-headline">{headline}</p>}
    </section>
  );
}

/** Nota de 0 a 10 con su «/10» en la misma línea (nunca se parte). */
function ScoreTile({ label, value, accent }: { label: string; value?: number | null; accent?: boolean }) {
  const has = typeof value === "number";
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card bg-card p-4">
      <span className="sr-only">{`${label}: ${has ? `${scoreText(value)} sobre 10` : "sin datos"}`}</span>
      <p className="truncate type-footnote text-muted-foreground" aria-hidden="true">{label}</p>
      <p className="whitespace-nowrap" aria-hidden="true">
        <span className={cn("type-figure text-[34px] leading-none", accent ? "text-primary" : "text-foreground")}>{scoreText(value)}</span>
        {has && <span className="ml-0.5 type-footnote text-muted-foreground">/10</span>}
      </p>
    </div>
  );
}

/** Cifra de composición con su unidad pegada («18,5 %», «62,3 kg»). */
function UnitTile({ label, value, unit, accent }: { label: string; value: number; unit: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card bg-card p-4">
      <span className="sr-only">{`${label}: ${formatDecimal(value, 1)} ${unit}`}</span>
      <p className="truncate type-footnote text-muted-foreground" aria-hidden="true">{label}</p>
      <p className="whitespace-nowrap" aria-hidden="true">
        <span className={cn("type-figure text-[28px] leading-none", accent ? "text-primary" : "text-foreground")}>{formatDecimal(value, 1)}</span>
        <span className="ml-1 type-footnote text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

/** «Qué mejorar»: lo que más te frena y las mejoras numeradas en un solo grupo. */
function ScanImprovements({ result }: { result: ScanResultData }) {
  const list = improvementList(result);
  const bottleneck = result.bottleneck?.trim();
  if (!list.length && !bottleneck) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="type-title3">Qué mejorar</h3>
      {bottleneck && (
        <div className="flex items-start gap-3.5 rounded-card bg-card p-4">
          <IconTile icon={Target} size="md" />
          <div className="min-w-0 flex-1">
            <p className="type-footnote text-muted-foreground">Lo que más te frena</p>
            <p className="mt-0.5 type-headline">{sentence(bottleneck)}</p>
          </div>
        </div>
      )}
      {list.length > 0 && (
        <ol className="overflow-hidden rounded-card bg-card">
          {list.map((item, i) => (
            <li key={i} className={cn("flex items-start gap-3 px-4 py-3.5", i > 0 && "sep-t")}>
              <span className="sr-only">{`Mejora ${i + 1}: ${sentence(item.label)}${item.priority ? `. Prioridad ${item.priority.toLowerCase()}` : ""}`}</span>
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 type-footnote font-bold tabular-nums text-primary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1" aria-hidden="true">
                <span className="block type-headline">{sentence(item.label)}</span>
                {item.priority && (
                  <span className={cn("mt-1 inline-flex rounded-full px-2 py-[3px] type-footnote font-semibold",
                    isHighPriority(item.priority) ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                    Prioridad {item.priority.toLowerCase()}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Block({ title, trailing, children }: { title: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="min-w-0 type-headline">{title}</h4>
        {trailing}
      </div>
      {children}
    </section>
  );
}

const Panel = ({ children }: { children: ReactNode }) => (
  <div className="rounded-card bg-card px-[18px] py-2.5 [&>*:not(:first-child)]:sep-t">{children}</div>
);

function Meter({ label, value, fraction, strong, note }: { label: string; value: string; fraction: number; strong: boolean; note?: string | null }) {
  return (
    <div className="flex flex-col gap-1.5 py-2.5">
      <span className="sr-only">{`${label}: ${value}${note ? `. ${note}` : ""}`}</span>
      <div className="flex items-baseline justify-between gap-3" aria-hidden="true">
        <p className="min-w-0 type-subhead font-semibold">{label}</p>
        <p className={cn("shrink-0 whitespace-nowrap type-subhead font-semibold tabular-nums", strong ? "text-primary" : "text-foreground")}>{value}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div className={cn("h-full rounded-full", strong ? "bg-primary" : "bg-foreground/40")} style={{ width: `${meterFraction(fraction, 1) * 100}%` }} />
      </div>
      {note && <p className="type-footnote text-muted-foreground" aria-hidden="true">{note}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <p className="min-w-0 type-subhead">{label}</p>
      <p className="max-w-[55%] text-right type-subhead tabular-nums text-muted-foreground">{value}</p>
    </div>
  );
}

const TextRow = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <p className={cn("py-2.5", muted ? "type-footnote text-muted-foreground" : "type-subhead")}>{children}</p>
);

/** «Lectura estimada por IA» (Plus): composición, músculos, proporciones, postura, rasgos y protocolo. */
function ScanDetail({ result }: { result: ScanResultData }) {
  const bc = result.body_composition;
  const pr = result.proportions;
  const po = result.posture;
  const pc = result.protocol;
  const groups = result.muscle_breakdown ?? [];
  const markers = result.genetic_markers ?? [];
  const issues = po?.issues ?? [];
  const hasPosture = !!po && (issues.length > 0 || !!po.note);
  const hasDetail = !!(bc || groups.length || pr || hasPosture || markers.length || pc);
  if (!hasDetail) return null;
  const tiles = bc ? [
    bc.body_fat_pct != null && <UnitTile key="fat" label="Grasa" value={bc.body_fat_pct} unit="%" accent />,
    bc.lean_mass_kg != null && <UnitTile key="lean" label="Masa magra" value={bc.lean_mass_kg} unit="kg" />,
    bc.weight_kg != null && <UnitTile key="weight" label="Peso est." value={bc.weight_kg} unit="kg" />,
  ].filter(Boolean) : [];
  const severity = po?.severity?.trim();
  return (
    <section className="flex flex-col gap-[18px]">
      <header className="flex flex-col gap-1">
        <h3 className="type-title3">Lectura estimada por IA</h3>
        <p className="type-footnote text-muted-foreground">Es una estimación visual, no un diagnóstico médico.</p>
      </header>

      {bc && (
        <Block title="Composición corporal estimada">
          {tiles.length > 0 && <div className={cn("grid gap-3", tiles.length === 3 ? "grid-cols-3" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-1")}>{tiles}</div>}
          {(bc.somatotype || bc.frame_size || bc.fat_distribution) && (
            <Panel>
              {bc.somatotype && <InfoRow label="Somatotipo" value={sentence(bc.somatotype)} />}
              {bc.frame_size && <InfoRow label="Estructura" value={sentence(bc.frame_size)} />}
              {bc.fat_distribution && <InfoRow label="Distribución de grasa" value={sentence(bc.fat_distribution)} />}
            </Panel>
          )}
        </Block>
      )}

      {groups.length > 0 && (
        <Block title="Lectura por grupo muscular">
          <Panel>
            {groups.map((m, i) => (
              <Meter key={i} label={sentence(m.group)} value={`${formatDecimal(m.score, 1)}/10`} fraction={meterFraction(m.score)} strong={m.score >= 7} note={m.verdict || undefined} />
            ))}
          </Panel>
        </Block>
      )}

      {pr && (
        <Block title="Proporciones y simetría">
          <Panel>
            {pr.shoulder_to_waist_ratio != null && (
              <Meter label="Ratio hombro/cintura" value={formatDecimal(pr.shoulder_to_waist_ratio, 2)}
                fraction={meterFraction(pr.shoulder_to_waist_ratio, 1.8)} strong={pr.shoulder_to_waist_ratio >= 1.5} note="Ideal ~1,60" />
            )}
            {pr.v_taper_score != null && <Meter label="V-taper" value={`${formatDecimal(pr.v_taper_score, 1)}/10`} fraction={meterFraction(pr.v_taper_score)} strong={pr.v_taper_score >= 7} />}
            {pr.symmetry_score != null && <Meter label="Simetría" value={`${formatDecimal(pr.symmetry_score, 1)}/10`} fraction={meterFraction(pr.symmetry_score)} strong={pr.symmetry_score >= 7} />}
            {pr.upper_lower_balance && <InfoRow label="Balance" value={sentence(pr.upper_lower_balance)} />}
            {pr.weakest_link && <InfoRow label="Eslabón más débil" value={sentence(pr.weakest_link)} />}
          </Panel>
        </Block>
      )}

      {hasPosture && (
        <Block title="Postura" trailing={severity && (
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 type-footnote font-semibold",
            /leve/i.test(severity) ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary")}>
            {sentence(severity)}
          </span>
        )}>
          <Panel>
            {issues.map((issue, i) => <TextRow key={i}>{sentence(issue)}</TextRow>)}
            {po?.note && <TextRow muted>{po.note}</TextRow>}
          </Panel>
        </Block>
      )}

      {markers.length > 0 && (
        <Block title="Rasgos visuales que juegan a tu favor (o en contra)">
          <Panel>
            {markers.map((g, i) => <TextRow key={i}>{sentence(g)}</TextRow>)}
          </Panel>
          <p className="type-footnote text-muted-foreground">Señales observadas en tus fotos: no es un estudio genético.</p>
        </Block>
      )}

      {pc && (
        <Block title="Protocolo recomendado por la IA">
          {(pc.training_days_per_week != null || pc.weekly_sets_priority != null || pc.protein_g_per_kg != null
            || pc.calorie_adjustment_kcal != null || pc.cardio_minutes_per_week != null) && (
            <Panel>
              {pc.training_days_per_week != null && <InfoRow label="Días de entreno por semana" value={groupedInt(pc.training_days_per_week)} />}
              {pc.weekly_sets_priority != null && <InfoRow label="Series del grupo prioritario" value={groupedInt(pc.weekly_sets_priority)} />}
              {pc.protein_g_per_kg != null && <InfoRow label="Proteína por kg" value={`${formatDecimal(pc.protein_g_per_kg, 1)} g`} />}
              {pc.calorie_adjustment_kcal != null && <InfoRow label="Calorías frente a mantenimiento" value={signedKcal(pc.calorie_adjustment_kcal)} />}
              {pc.cardio_minutes_per_week != null && <InfoRow label="Cardio por semana" value={`${groupedInt(pc.cardio_minutes_per_week)} min`} />}
            </Panel>
          )}
          {!!pc.key_lifts?.length && (
            <div className="flex flex-col gap-2">
              <p className="type-subhead font-semibold">Ejercicios clave</p>
              <div className="flex flex-wrap gap-2">
                {pc.key_lifts.map((l, i) => <span key={i} className="rounded-full bg-card px-3 py-1.5 type-subhead">{l}</span>)}
              </div>
            </div>
          )}
          {!!pc.avoid?.length && (
            <div className="flex flex-col gap-1">
              <p className="type-subhead font-semibold">Evita</p>
              {pc.avoid.map((a, i) => (
                <p key={i} className="flex items-start gap-2.5 py-1 type-subhead text-muted-foreground">
                  <Minus className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                  {a}
                </p>
              ))}
            </div>
          )}
        </Block>
      )}
    </section>
  );
}
