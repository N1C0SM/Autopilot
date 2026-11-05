import { BarChart3, ChevronRight, Crown, LockKeyhole, RefreshCw, UtensilsCrossed } from "lucide-react";
import { hapticTap } from "@/shared/lib/native";
import { isIOSNative } from "@/shared/lib/platform";
import { usePlanAvailability } from "@/shared/lib/planCatalog";

/** Lo que Plus añade a Nutrición: solo funciones reales del plan de comidas (maqueta de ChatGPT). */
const NUTRITION_PLUS_ROWS = [
  { icon: UtensilsCrossed, title: "Comidas de cada día", detail: "Ajustadas a tus macros y a lo que te gusta." },
  { icon: BarChart3, title: "Seguimiento de macros", detail: "Marca cada comida y se suman sus macros." },
  { icon: RefreshCw, title: "Menú a tu gusto", detail: "Regenera tus comidas cuando quieras." },
] as const;

/**
 * «Más en Plus» de Nutrición (Gratis): filas con candado y «Descubre Autopilot Plus».
 * Si Plus está oculto en Admin → Planes no se muestra; en iOS no enlaza a pagos externos.
 */
export default function NutritionPlusSection({ onUpgrade }: { onUpgrade?: () => void }) {
  const { plus } = usePlanAvailability();
  if (!plus) return null;
  return (
    <section aria-labelledby="nutrition-plus-title">
      <h3 id="nutrition-plus-title" className="type-title2">Más en Plus</h3>
      <p className="mt-0.5 type-subhead text-muted-foreground">Desbloquea tu plan de comidas completo y personalizado.</p>
      <ul className="mt-3 space-y-3">
        {NUTRITION_PLUS_ROWS.map(({ icon: Icon, title, detail }) => (
          <li key={title} className="flex min-h-[72px] items-center gap-3.5 rounded-[22px] border border-border bg-card px-4 py-3">
            <Icon aria-hidden className="h-[22px] w-[22px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block type-headline">{title}</span>
              <span className="mt-0.5 block type-footnote text-muted-foreground">{detail}</span>
            </span>
            <LockKeyhole aria-label="Incluido en Plus" className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} />
          </li>
        ))}
      </ul>
      {onUpgrade && !isIOSNative() ? (
        <button
          type="button"
          onClick={() => { void hapticTap(); onUpgrade(); }}
          className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-[22px] border border-primary/50 px-4 text-left text-primary transition-opacity duration-150 active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Crown aria-hidden className="h-5 w-5 shrink-0" />
          <span className="flex-1 type-subhead font-semibold">Descubre Autopilot Plus</span>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        </button>
      ) : (
        <p className="mt-3 type-footnote font-semibold text-primary">Incluido en Plus</p>
      )}
    </section>
  );
}
