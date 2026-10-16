import { PhoneAppBar, PhoneFrame, PhoneHome } from "@/components/PublicPhone";
import { usePlanAvailability } from "@/lib/planCatalog";

const FADE = "linear-gradient(to bottom, #000 80%, transparent 100%)";

/** Static picture of the app's "Hoy" screen for the landing hero. The phone rises from the section edge and fades out. */
export default function PublicHeroPhone() {
  const plans = usePlanAvailability();
  return (
    <div
      role="img"
      aria-label="Pantalla de Autopilot con el entrenamiento del día"
      style={{ WebkitMaskImage: FADE, maskImage: FADE }}
      className="relative mx-auto h-[31rem] w-full max-w-[22rem] overflow-hidden select-none"
    >
      <PhoneFrame screenClassName="h-[37rem]">
        <PhoneAppBar avatar="L" />
        <div className="flex-1 overflow-hidden px-4 pt-3">
          <PhoneHome plans={plans} exerciseCount={3} />
        </div>
      </PhoneFrame>
    </div>
  );
}
