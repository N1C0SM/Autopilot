import { useState } from "react";
import { Check, Lock, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/config/tiers";

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
  const options: TierKey[] = allowCoach ? ["training", "full"] : [plan === "plus" ? "training" : "full"];
  const [selected, setSelected] = useState<TierKey>(defaultPlan && options.includes(defaultPlan) ? defaultPlan : options[0]);
  const t = TIERS[selected];

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-7 w-7 text-primary" />
      </div>

      {options.length > 1 && (
        <div role="tablist" aria-label="Elige tu plan" className="mb-6 grid grid-cols-2 gap-2">
          {options.map((key) => {
            const tier = TIERS[key];
            const active = selected === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelected(key)}
                className={`rounded-2xl border p-3 text-left transition-all active:scale-[0.97] ${
                  active ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border bg-secondary/40"
                }`}
              >
                <p className="font-display text-sm font-bold">{tier.name}</p>
                <p className="text-xs tabular-nums text-muted-foreground">{tier.price} €/mes</p>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Autopilot {t.name}</p>
      <h2 className="mt-2 font-display text-3xl font-bold tabular-nums">
        {t.price} €<span className="text-base font-semibold text-muted-foreground">/mes</span>
      </h2>

      <ul className="mx-auto mb-6 mt-5 max-w-xs space-y-2.5 text-left">
        {FEATURES[selected].map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button
        variant="hero"
        size="lg"
        onClick={() => onChoose(selected)}
        className="h-12 w-full rounded-xl active:scale-[0.98]"
      >
        Continuar al pago · {t.price} €/mes
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">Sin permanencia. Cancela cuando quieras.</p>
      {onSeeOther && otherLabel && (
        <button
          type="button"
          onClick={onSeeOther}
          className="mt-3 min-h-11 w-full text-xs font-medium text-primary underline underline-offset-4"
        >
          {otherLabel}
        </button>
      )}
    </div>
  );
};

/** Estado Coach pagado sin entrenador asignado todavía. */
export const CoachPendingAssignment = () => (
  <div className="bg-card rounded-2xl p-6 md:p-10 border border-border text-center max-w-2xl mx-auto md:w-full md:max-w-none">
    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5"><UserCheck className="w-7 h-7 text-primary" /></div>
    <h2 className="text-xl font-bold font-display">Estamos asignándote un entrenador.</h2>
    <p className="mt-2 text-sm text-muted-foreground">Mientras tanto puedes seguir usando todo Plus. Te avisaremos en cuanto tengas a tu entrenador.</p>
  </div>
);
