import { useState } from "react";
import { Check, Lock, UserCheck } from "lucide-react";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { COACH_CONTACT_FEATURE, TIERS } from "@/shared/config/tiers";
import { DASHBOARD_CHAT_ENABLED } from "@/shared/lib/releaseScope";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import { isIOSNative } from "@/shared/lib/platform";
import { IosFeatureLocked } from "@/shared/components/platform/IosFeatureLocked";

type TierKey = "training" | "full";

const FEATURES: Record<TierKey, string[]> = {
  training: [
    "Entrenamiento adaptativo cada semana",
    "Plan de nutrición personalizado",
    "Progresión de cargas calculada",
  ],
  full: [
    "Todo lo incluido en Plus",
    "Seguimiento personal de Nicolás",
    // Mientras el chat de cliente esté apagado no se promete chat ni videollamada:
    // se ofrece el canal real que existe (email de contacto).
    ...(DASHBOARD_CHAT_ENABLED
      ? ["Chat directo con fotos y vídeos de técnica", "Videollamadas de revisión"]
      : [COACH_CONTACT_FEATURE]),
  ],
};

/** Paywall integrado con confirmación antes de abrir el pago. */
export const PlanPaywall = ({
  plan,
  onChoose,
  allowCoach = false,
  defaultPlan,
  onSeeOther,
  otherLabel,
}: {
  plan: "plus" | "coach";
  onChoose: (tier: TierKey) => void;
  allowCoach?: boolean;
  /** Plan que el usuario ya eligió en la web, para no obligarle a elegir otra vez. */
  defaultPlan?: TierKey;
  /** Salida alternativa cuando el plan mostrado no es el que quiere el usuario. */
  onSeeOther?: () => void;
  otherLabel?: string;
}) => {
  const { coach } = usePlanAvailability();
  // Coach is only offered while it is published in Admin → Planes AND the client chat
  // is enabled: sin chat no se puede entregar el servicio que se estaba vendiendo.
  const coachAvailable = coach && DASHBOARD_CHAT_ENABLED;
  const options: TierKey[] = allowCoach && coachAvailable ? ["training", "full"] : [coachAvailable && plan === "coach" ? "full" : "training"];
  const unavailableNote = plan === "coach" && !DASHBOARD_CHAT_ENABLED;
  const [selected, setSelected] = useState<TierKey>(defaultPlan && options.includes(defaultPlan) ? defaultPlan : options[0]);
  const t = TIERS[selected];

  // iOS v1 (App Store §3.1.1: sin venta de bienes digitales; §3.1.3(a) no cubre fitness): replace the paywall with a neutral
  // "visit autopilotplan.com" card. No pricing, no checkout CTA.
  if (isIOSNative()) return <IosFeatureLocked />;

  return (
    <div className="mx-auto w-full max-w-md px-1 py-4">
      <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[22%] bg-card">
        <Lock className="h-8 w-8 text-primary" strokeWidth={1.75} />
      </div>

      {options.length > 1 && (
        <div role="tablist" aria-label="Elige tu plan" className="mt-6 grid grid-cols-2 gap-1 rounded-[10px] bg-secondary p-0.5">
          {options.map((key) => {
            const tier = TIERS[key];
            const active = selected === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { void hapticSelection(); setSelected(key); }}
                className={`min-h-11 rounded-lg px-3 py-1.5 text-center transition-colors active:scale-[0.97] ${
                  active ? "bg-card" : ""
                }`}
              >
                <p className="type-headline">{tier.name}</p>
                <p className="type-footnote tabular-nums text-muted-foreground">{tier.price} €/mes</p>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="type-subhead text-muted-foreground">Autopilot {t.name}</p>
        <h2 className="mt-1 font-rounded text-[44px] font-bold leading-none tabular-nums">
          {t.price} €<span className="type-title3 text-muted-foreground">/mes</span>
        </h2>
      </div>

      {unavailableNote && (
        <p role="note" className="mt-4 rounded-xl bg-secondary px-4 py-3 text-center type-footnote text-muted-foreground">
          El plan con entrenador no está disponible todavía. Te ofrecemos {TIERS.training.name} mientras tanto.
        </p>
      )}

      <ul className="mt-7 space-y-5 text-left">
        {FEATURES[selected].map((f) => (
          <li key={f} className="flex items-start gap-4">
            <Check className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.75} />
            <span className="type-body">{f}</span>
          </li>
        ))}
      </ul>

      <Button
        variant="hero"
        size="lg"
        onClick={() => { void hapticTap(); onChoose(selected); }}
        className="mt-8 w-full"
      >
        Continuar al pago · {t.price} €/mes
      </Button>
      <p className="mt-3 text-center type-footnote text-muted-foreground">Sin permanencia. Cancela cuando quieras.</p>
      {onSeeOther && otherLabel && (
        <Button variant="plain" onClick={onSeeOther} className="mt-1 w-full">
          {otherLabel}
        </Button>
      )}
    </div>
  );
};

/** Estado Coach pagado sin entrenador asignado todavía. */
export const CoachPendingAssignment = () => (
  <EmptyState
    icon={UserCheck}
    title="Estamos asignándote un entrenador."
    description="Mientras tanto puedes seguir usando todo Plus. Te avisaremos en cuanto tengas a tu entrenador."
    className="mx-auto max-w-2xl"
  />
);
