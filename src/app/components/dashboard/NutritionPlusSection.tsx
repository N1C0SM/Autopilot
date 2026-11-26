import { ChevronRight, UtensilsCrossed } from "lucide-react";
import { PlusBadge } from "@/shared/components/ui/plus-badge";
import { hapticTap } from "@/shared/lib/native";
import { isIOSNative } from "@/shared/lib/platform";
import { usePlanAvailability } from "@/shared/lib/planCatalog";

/** Lo que Plus añade a Nutrición, en una sola fila tranquila (el mismo texto en la app). */
export const NUTRITION_PLUS_ROW = { title: "Comidas de cada día", detail: "Ajustadas a tus macros y a lo que te gusta." } as const;

/**
 * Nutrición en Gratis: lo de Plus en una sola fila tranquila bajo el anillo (icono en su losa,
 * título, una línea y la insignia Plus). Sin títulos ni listas de ventajas. Si Plus está oculto en
 * Admin → Planes no se muestra; en iOS no enlaza a pagos externos (normas de la App Store).
 * Igual que `plusRow` en la app nativa.
 */
export default function NutritionPlusSection({ onUpgrade }: { onUpgrade?: () => void }) {
  const { plus } = usePlanAvailability();
  if (!plus) return null;
  const canUpgrade = Boolean(onUpgrade) && !isIOSNative();
  const content = (
    <>
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-secondary">
        <UtensilsCrossed className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block type-headline">{NUTRITION_PLUS_ROW.title}</span>
        <span className="mt-0.5 block type-footnote text-muted-foreground">{NUTRITION_PLUS_ROW.detail}</span>
      </span>
      <PlusBadge />
      {canUpgrade && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.25} />}
    </>
  );
  const row = "flex min-h-[72px] w-full items-center gap-3.5 rounded-[22px] bg-card px-4 py-3 text-left";
  return canUpgrade ? (
    <button
      type="button"
      onClick={() => { void hapticTap(); onUpgrade?.(); }}
      aria-label={`${NUTRITION_PLUS_ROW.title}, incluido en Plus. Ver Autopilot Plus`}
      className={`${row} transition-transform duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:active:scale-100`}
    >
      {content}
    </button>
  ) : (
    <div role="group" aria-label={`${NUTRITION_PLUS_ROW.title}, incluido en Plus`} className={row}>{content}</div>
  );
}
