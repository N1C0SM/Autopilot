import { useState } from "react";
import { Check, Lock, UserCheck } from "lucide-react";
import { hapticSelection, hapticTap } from "@/lib/native";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/config/tiers";
import { usePlanAvailability } from "@/lib/planCatalog";
import { isIOSNative } from "@/lib/platform";
import { IosFeatureLocked } from "@/components/platform/IosFeatureLocked";

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
    "Chat directo con fotos y vídeos de técnica",
    "Videollamadas de revisión",
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
  // Coach is only offered while it is published in Admin → Planes.
  const options: TierKey[] = allowCoach && coach ? ["training", "full"] : [plan === "plus" || !coach ? "training" : "full"];
  const [selected, setSelected] = useState<TierKey>(defaultPlan && options.includes(defaultPlan) ? defaultPlan : options[0]);
  const t = TIERS[selected];

  // iOS v1 (reader app, App Store §3.1.3(a)): replace the paywall with a neutral
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
