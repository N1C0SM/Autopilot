import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/config/tiers";
import { track } from "@/lib/analytics";

export default function CoachingOffer({ onChoose, nutrition = false, compact = false }: {
  onChoose: (plan: "training" | "full") => Promise<void>;
  nutrition?: boolean;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const choose = async (plan: "training" | "full") => {
    setPending(true);
    track("plan_select", { plan, source: nutrition ? "nutrition_gate" : "free_dashboard" });
    try { await onChoose(plan); } finally { setPending(false); }
  };
  return (
    <section className="rounded-xl border border-primary/25 bg-card p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Seguimiento opcional</p>
      <h2 className="mt-2 font-display text-xl font-bold">{nutrition ? "Añade nutrición personalizada" : "¿Necesitas que alguien adapte tu rutina?"}</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{nutrition
        ? "Completo incluye entrenamiento, nutrición y revisión semanal con tu entrenador."
        : "Un entrenador prepara tu plan, revisa tu progreso cada 2 semanas y responde a tus dudas por chat en 48h."}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button disabled={pending} onClick={() => void choose(nutrition ? "full" : "training")}>
          {pending ? "Abriendo pago…" : `Probar ${nutrition ? "Completo" : "Entrenamiento"} · 7 días`}
        </Button>
        {!nutrition && !compact && <Button disabled={pending} variant="outline" onClick={() => void choose("full")}>Añadir nutrición · {TIERS.full.price}€/mes</Button>}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Después de la prueba: {nutrition ? TIERS.full.price : TIERS.training.price}€/mes{!nutrition && !compact ? ` (${TIERS.full.price}€/mes con Completo)` : ""}. Renovación automática. Cancela desde Ajustes → Suscripción antes de terminar la prueba para evitar el primer cobro.</p>
      <p className="mt-2 text-xs text-muted-foreground">Puedes seguir entrenando y guardando tu progreso gratis.</p>
    </section>
  );
}
