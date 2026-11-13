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
      <h3 id="nutrition-plus-title" className="type-title2">Registra tus comidas</h3>
      <p className="mt-0.5 type-subhead text-muted-foreground">Disponible en Plus.</p>
      {/* Un solo grupo sin bordes (menos tarjetas, como la maqueta): filas separadas por una línea fina. */}
      <ul className="mt-3 overflow-hidden rounded-[22px] bg-card">
        {NUTRITION_PLUS_ROWS.map(({ icon: Icon, title, detail }) => (
          <li key={title} className="group/row flex min-h-[72px] items-center gap-3.5 pl-4">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-secondary">
              <Icon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.75} />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pr-4 group-[:not(:last-child)]/row:sep-b">
              <span className="min-w-0 flex-1">
                <span className="block type-headline">{title}</span>
                <span className="mt-0.5 block type-footnote text-muted-foreground">{detail}</span>
              </span>
              <LockKeyhole aria-label="Incluido en Plus" className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} />
            </span>
          </li>
        ))}
      </ul>
      {onUpgrade && !isIOSNative() ? (
        <button
          type="button"
          onClick={() => { void hapticTap(); onUpgrade(); }}
          className="btn-gold mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-full bg-primary px-5 text-left text-primary-foreground transition-opacity duration-150 active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
