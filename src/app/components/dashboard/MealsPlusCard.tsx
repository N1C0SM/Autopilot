import { Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { hapticTap } from "@/shared/lib/native";
import { isIOSNative } from "@/shared/lib/platform";
import { useMealPhoto } from "@/shared/hooks/useSessionCover";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";

/**
 * En lugar de «Sin comidas todavía» cuando la persona no tiene Plus: le contamos que con Plus
 * se le preguntan sus gustos y alergias y Autopilot le prepara las comidas del día. En iOS no se enlaza a un pago externo (normas de la App Store).
 */
export default function MealsPlusCard({ onUpgrade }: { onUpgrade?: () => void }) {
  const photo = useMealPhoto("Pollo a la plancha con arroz integral y verduras asadas") || BRAND_PHOTOS.meal;
  return (
    <EmptyState
      photo={photo}
      card
      icon={Sparkles}
      title="Tus comidas, hechas para ti"
      description="Con Plus te preguntamos qué te gusta y qué no comes, y Autopilot te prepara las comidas de cada día ajustadas a tus macros."
      action={onUpgrade && !isIOSNative()
        ? <Button size="lg" onClick={() => { void hapticTap(); onUpgrade(); }}>Desbloquear con Plus</Button>
        : <p className="type-footnote font-semibold text-primary">Incluido en Plus</p>}
    />
  );
}
