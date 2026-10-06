import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/config/tiers";
import { track } from "@/lib/analytics";

export default function CoachingOffer({ onChoose, nutrition = false, compact = false, defaultPlan }: {
  onChoose: (plan: "training" | "full") => Promise<void>;
  nutrition?: boolean;
  compact?: boolean;
  /** Plan que el usuario ya eligió en la web, para destacarlo aquí. */
  defaultPlan?: "training" | "full";
}) {
  const [pending, setPending] = useState(false);
  const choose = async (plan: "training" | "full") => {
    setPending(true);
    track("plan_select", { plan, source: nutrition ? "nutrition_gate" : "free_dashboard" });
    try { await onChoose(plan); } finally { setPending(false); }
  };
  const coachPreferred = defaultPlan === "full";
  return (
    <section className="rounded-xl border border-primary/25 bg-card p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Autopilot Plus · {TIERS.training.price} €/mes</p>
      <h2 className="mt-2 font-display text-xl font-bold">Autopilot se adapta a ti.</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{nutrition
        ? "Plus incluye tu plan de nutrición, adaptación automática y estadísticas avanzadas."
        : "Plus adapta tu entrenamiento automáticamente. Coach añade una persona real detrás."}</p>
      {defaultPlan && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          Elegiste {TIERS[defaultPlan].name} en la web · puedes cambiarlo aquí
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button disabled={pending} variant={coachPreferred ? "outline" : "default"} onClick={() => void choose("training")}>
          {pending ? "Abriendo pago…" : "Mejorar a Plus"}
        </Button>
        {!nutrition && !compact && <Button disabled={pending} variant={coachPreferred ? "default" : "outline"} onClick={() => void choose("full")}>Elegir Coach · {TIERS.full.price}€/mes</Button>}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">7 días de prueba y después {TIERS.training.price}€/mes (Coach {TIERS.full.price}€/mes). Renovación automática. Cancela desde Ajustes → Suscripción antes de terminar la prueba para evitar el primer cobro.</p>
      <p className="mt-2 text-xs text-muted-foreground">Puedes seguir entrenando y guardando tu progreso gratis.</p>
    </section>
  );
}
