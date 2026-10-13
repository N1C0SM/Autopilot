import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/config/tiers";
import { euro, usePlanAvailability } from "@/lib/planCatalog";
import { track } from "@/lib/analytics";
import { isIOSNative } from "@/lib/platform";

export default function CoachingOffer({ onChoose, nutrition = false, compact = false, defaultPlan }: {
  onChoose: (plan: "training" | "full") => Promise<void>;
  nutrition?: boolean;
  compact?: boolean;
  /** Plan que el usuario ya eligió en la web, para destacarlo aquí. */
  defaultPlan?: "training" | "full";
}) {
  // iOS v1 (reader app, App Store §3.1.3(a)): no upsell inside the native build.
  if (isIOSNative()) return null;
  const [pending, setPending] = useState(false);
  const choose = async (plan: "training" | "full") => {
    setPending(true);
    track("plan_select", { plan, source: nutrition ? "nutrition_gate" : "free_dashboard" });
    try { await onChoose(plan); } finally { setPending(false); }
  };
  const plans = usePlanAvailability();
  const coachPreferred = defaultPlan === "full" && plans.coach;
  return (
    <section className="rounded-xl border border-primary/25 bg-card p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Autopilot {plans.plusName} · {euro(plans.plusPrice)}/mes</p>
      <h2 className="mt-2 font-display text-xl font-bold">Autopilot se adapta a ti.</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{nutrition
        ? `${plans.plusName} incluye tu plan de nutrición, adaptación automática y estadísticas avanzadas.`
        : `${plans.plusName} adapta tu entrenamiento automáticamente.${plans.coach ? ` ${plans.coachName} añade a Nicolás detrás.` : ""}`}</p>
      {defaultPlan && (defaultPlan !== "full" || plans.coach) && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          Elegiste {TIERS[defaultPlan].name} en la web · puedes cambiarlo aquí
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button disabled={pending} variant={coachPreferred ? "outline" : "default"} onClick={() => void choose("training")}>
          {pending ? "Abriendo pago…" : `Mejorar a ${plans.plusName}`}
        </Button>
        {!nutrition && !compact && plans.coach && <Button disabled={pending} variant={coachPreferred ? "default" : "outline"} onClick={() => void choose("full")}>Elegir {plans.coachName} · {euro(plans.coachPrice)}/mes</Button>}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">7 días de prueba y después {euro(plans.plusPrice)}/mes{plans.coach ? ` (${plans.coachName} ${euro(plans.coachPrice)}/mes)` : ""}. Renovación automática. Cancela desde Ajustes → Suscripción antes de terminar la prueba para evitar el primer cobro.</p>
      <p className="mt-2 text-xs text-muted-foreground">Puedes seguir entrenando y guardando tu progreso gratis.</p>
    </section>
  );
}
