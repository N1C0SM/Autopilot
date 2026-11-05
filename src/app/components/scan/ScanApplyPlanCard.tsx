import type { ComponentType } from "react";
import { Apple, Dumbbell, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { formatDecimal } from "@/shared/lib/numberFormat";
import { hapticTap } from "@/shared/lib/native";
import { isIOSNative } from "@/shared/lib/platform";
import { parseScanProtocol, type ScanProtocolInput } from "@/shared/lib/scanApply";

function PlanRow({
  icon,
  title,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <IconTile icon={icon} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="type-headline font-semibold">{title}</p>
          <p className="shrink-0 type-subhead tabular-nums text-muted-foreground">{value}</p>
        </div>
        <p className="mt-0.5 type-footnote text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

/**
 * «Aplicar el scan a mi plan»: la rutina y la nutrición que propone el análisis,
 * en una sola tarjeta. Plus (y Coach) pueden aplicarlo; Free ve la misma opción
 * bloqueada hasta tener Plus — nunca desaparece, para que sepa qué se está
 * perdiendo y pueda decidir.
 */
export default function ScanApplyPlanCard({
  protocol,
  priorities = [],
  canApply,
  hasChanges,
  canUpgrade = true,
  plusName = "Plus",
  onApply,
  onUpgrade,
}: {
  protocol?: ScanProtocolInput | null;
  /** Grupos atrasados que el scan priorizaría en la rutina. */
  priorities?: string[];
  /** Plus, Coach o admin: puede aplicar el scan. */
  canApply: boolean;
  /** El scan propone algo nuevo para este usuario. */
  hasChanges: boolean;
  /** Hay un plan de pago publicado al que se puede ir (si no, no se vende nada). */
  canUpgrade?: boolean;
  plusName?: string;
  onApply: () => void;
  onUpgrade: () => void;
}) {
  const parsed = parseScanProtocol(protocol);
  const keyLifts = parsed?.keyLifts ?? [];
  const proteinPerKg = parsed?.proteinPerKg;
  const calorieAdjustment = parsed?.calorieAdjustmentKcal;

  // La semana no se toca: los días los eligió el usuario. El scan cambia el
  // enfoque de la rutina (grupos atrasados y ejercicios clave) y la nutrición.
  const priorityText = priorities.slice(0, 2).map((m) => m.toLowerCase()).join(" y ");
  const routineValue = priorityText || (canApply ? "Tu semana" : "A tu medida");
  const routineDetail = keyLifts.length
    ? `Clave: ${keyLifts.slice(0, 2).join(", ")}`
    : priorities.length
      ? "Más series y ejercicios para esos grupos."
      : canApply
        ? "Se recalcula con tu objetivo y tu semana."
        : "Tu rutina se ajusta a lo que ve el análisis.";

  const calorieValue = calorieAdjustment === undefined
    ? undefined
    : `${calorieAdjustment > 0 ? "+" : calorieAdjustment < 0 ? "−" : ""}${Math.abs(calorieAdjustment)} kcal/día`;
  const nutritionValue = calorieValue
    ?? (proteinPerKg !== undefined ? `${formatDecimal(proteinPerKg, 1)} g/kg` : "A tu medida");
  const nutritionDetail = proteinPerKg !== undefined && calorieValue !== undefined
    ? `${formatDecimal(proteinPerKg, 1)} g de proteína por kg · macros y comidas recalculados.`
    : proteinPerKg !== undefined
      ? "Proteína diaria por kilo de peso · macros y comidas recalculados."
      : calorieValue !== undefined
        ? "Ajuste diario sobre tu mantenimiento · macros y comidas recalculados."
        : "Macros y comidas calculados para tu objetivo.";

  const iosNative = isIOSNative();
  // En iOS no se venden bienes digitales y, si el admin ocultó los planes de pago,
  // tampoco hay nada que ofrecer: en ambos casos se avisa sin CTA comercial.
  const sellUpgrade = canUpgrade && !iosNative;

  return (
    <section aria-labelledby="scan-apply-title" className="overflow-hidden rounded-[22px] bg-card p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <IconTile icon={Sparkles} />
        <div className="min-w-0 flex-1">
          <h3 id="scan-apply-title" className="type-headline font-semibold">Aplicar el scan a mi plan</h3>
          <p className="mt-0.5 type-footnote text-muted-foreground">
            {!canApply
              ? "Lleva a tu plan la rutina y la nutrición que recomienda este scan."
              : hasChanges
                ? "Esto es lo que cambia en tu plan con este scan."
                : "Este scan no propone cambios nuevos en tu plan."}
          </p>
        </div>
        {!canApply && (
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 type-footnote font-semibold text-primary"
          >
            <LockKeyhole className="size-3.5" strokeWidth={2.5} />
            {plusName}
          </span>
        )}
      </header>

      <div className="mt-4 space-y-4">
        <PlanRow icon={Dumbbell} title="Rutina" value={routineValue} detail={routineDetail} />
        <PlanRow icon={Apple} title="Nutrición" value={nutritionValue} detail={nutritionDetail} />
      </div>

      {!canApply ? (
        sellUpgrade ? (
          <div className="mt-4 space-y-1.5">
            <Button variant="tinted" size="lg" className="w-full" onClick={() => { void hapticTap(); onUpgrade(); }}>
              <LockKeyhole className="size-4" aria-hidden="true" />
              Aplicar con {plusName}
            </Button>
            <p className="text-center type-footnote text-muted-foreground">
              Bloqueado hasta tener {plusName}.
            </p>
          </div>
        ) : (
          <p className="mt-4 type-footnote font-semibold text-primary">Incluido en {plusName}.</p>
        )
      ) : hasChanges ? (
        <Button
          variant="hero"
          size="lg"
          className="mt-4 w-full gap-2 shadow-sm"
          onClick={onApply}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Aplicar a mi plan
        </Button>
      ) : null}
    </section>
  );
}
