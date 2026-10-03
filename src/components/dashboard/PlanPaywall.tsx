import { Lock, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/config/tiers";

/** Paywall integrado (sin popups) para funciones Plus o Coach. */
export const PlanPaywall = ({ plan, onChoose }: { plan: "plus" | "coach"; onChoose: () => void }) => {
  const t = plan === "plus" ? TIERS.training : TIERS.full;
  return (
    <div className="bg-card rounded-2xl p-6 md:p-10 border border-border card-shadow text-center max-w-2xl mx-auto md:w-full md:max-w-none">
      <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5"><Lock className="w-7 h-7 text-primary" /></div>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Autopilot {t.name}</p>
      <h2 className="mt-2 text-2xl font-bold font-display">{t.price} €/mes</h2>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        {plan === "plus" ? "Autopilot se adapta a ti." : "Todo Plus + seguimiento de un entrenador."}
      </p>
      <Button variant="hero" size="lg" onClick={onChoose} className="w-full md:w-auto">{plan === "plus" ? "Mejorar a Plus" : "Elegir Coach"}</Button>
    </div>
  );
};

/** Estado Coach pagado sin entrenador asignado todavía. */
export const CoachPendingAssignment = () => (
  <div className="bg-card rounded-2xl p-6 md:p-10 border border-border card-shadow text-center max-w-2xl mx-auto md:w-full md:max-w-none">
    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5"><UserCheck className="w-7 h-7 text-primary" /></div>
    <h2 className="text-xl font-bold font-display">Estamos asignándote un entrenador.</h2>
    <p className="mt-2 text-sm text-muted-foreground">Mientras tanto puedes seguir usando todo Plus. Te avisaremos en cuanto tengas a tu entrenador.</p>
  </div>
);
