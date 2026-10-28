import { Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { hapticTap } from "@/shared/lib/native";
import { isIOSNative } from "@/shared/lib/platform";
import { useMealPhoto } from "@/shared/hooks/useSessionCover";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";

/**
 * En lugar de «Sin comidas todavía» cuando la persona no tiene Plus: le contamos que con Plus
 * Autopilot le prepara las comidas del día con lo que dijo en el onboarding (gustos, alergias,
 * objetivo). En iOS no se enlaza a un pago externo (normas de la App Store).
 */
export default function MealsPlusCard({ onUpgrade }: { onUpgrade?: () => void }) {
  const photo = useMealPhoto("Pollo a la plancha con arroz integral y verduras asadas") || BRAND_PHOTOS.meal;
  return (
    <EmptyState
      photo={photo}
      card
      icon={Sparkles}
      title="Tus comidas, hechas para ti"
      description="Con Plus, Autopilot te prepara las comidas de cada día con tus gustos, alergias y objetivo del onboarding, ajustadas a tus macros."
      action={onUpgrade && !isIOSNative()
        ? <Button size="lg" onClick={() => { void hapticTap(); onUpgrade(); }}>Desbloquear con Plus</Button>
        : <p className="type-footnote font-semibold text-primary">Incluido en Plus</p>}
    />
  );
}
