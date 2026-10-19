import { useState } from "react";
import { Sparkles } from "lucide-react";
import { hapticTap } from "@/lib/native";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/config/tiers";
import { DASHBOARD_CHAT_ENABLED } from "@/lib/releaseScope";
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
  const [pending, setPending] = useState(false);
  const choose = async (plan: "training" | "full") => {
    setPending(true);
    track("plan_select", { plan, source: nutrition ? "nutrition_gate" : "free_dashboard" });
    try { await onChoose(plan); } finally { setPending(false); }
  };
  const plans = usePlanAvailability();
  // Sin chat de cliente no se puede entregar el plan con entrenador: no se ofrece comprarlo.
  const coachAvailable = plans.coach && DASHBOARD_CHAT_ENABLED;
  const coachPreferred = defaultPlan === "full" && coachAvailable;
  // iOS v1 (reader app, App Store §3.1.3(a)): no upsell inside the native build.
  if (isIOSNative()) return null;
  return (
    <section className="px-1 py-2">
      <Sparkles className="h-7 w-7 text-primary" strokeWidth={1.75} />
      <p className="mt-3 type-subhead text-muted-foreground">Autopilot {plans.plusName} · {euro(plans.plusPrice)}/mes</p>
      <h2 className="mt-1 type-title2">Autopilot se adapta a ti.</h2>
      <p className="mt-1.5 max-w-xl type-subhead text-muted-foreground">{nutrition
        ? `${plans.plusName} incluye tu plan de nutrición, adaptación automática y estadísticas avanzadas.`
        : `${plans.plusName} adapta tu entrenamiento automáticamente.${coachAvailable ? ` ${plans.coachName} añade a Nicolás detrás.` : ""}`}</p>
      {defaultPlan === "full" && !DASHBOARD_CHAT_ENABLED && (
        <p role="note" className="mt-3 type-footnote text-muted-foreground">
          El plan con entrenador no está disponible todavía. Te ofrecemos {plans.plusName} mientras tanto.
        </p>
      )}
      {defaultPlan && (defaultPlan !== "full" || coachAvailable) && (
        <p className="mt-3 type-footnote text-primary">
          Elegiste {TIERS[defaultPlan].name} en la web · puedes cambiarlo aquí
        </p>
      )}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" disabled={pending} variant={coachPreferred ? "tinted" : "default"} onClick={() => { void hapticTap(); void choose("training"); }}>
          {pending ? "Abriendo pago…" : `Mejorar a ${plans.plusName}`}
        </Button>
        {!nutrition && !compact && coachAvailable && <Button size="lg" disabled={pending} variant={coachPreferred ? "default" : "tinted"} onClick={() => { void hapticTap(); void choose("full"); }}>Elegir {plans.coachName} · {euro(plans.coachPrice)}/mes</Button>}
      </div>
      <p className="mt-4 type-footnote text-muted-foreground">7 días de prueba y después {euro(plans.plusPrice)}/mes{coachAvailable ? ` (${plans.coachName} ${euro(plans.coachPrice)}/mes)` : ""}. Renovación automática. Cancela desde Ajustes → Suscripción antes de terminar la prueba para evitar el primer cobro.</p>
      <p className="mt-2 type-footnote text-muted-foreground">Puedes seguir entrenando y guardando tu progreso gratis.</p>
    </section>
  );
}
