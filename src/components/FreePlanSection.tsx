import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanAvailability } from "@/lib/planCatalog";
import { track } from "@/lib/analytics";
import { hapticTap } from "@/lib/native";

/**
 * El plan Free como puerta de entrada: precio, qué incluye y condiciones a la vista.
 * Lee el mismo catálogo que las tarjetas de precios, así que nunca promete otra cosa.
 */
export default function FreePlanSection() {
  const plans = usePlanAvailability();
  const free = plans.plans.find((p) => p.key === "free");
  if (!free) return null;
  return <div className="mx-auto grid max-w-5xl items-center gap-10 rounded-[40px] bg-[radial-gradient(120%_120%_at_0%_0%,hsl(var(--primary)/0.14),transparent_55%)] bg-card px-6 py-10 sm:px-12 sm:py-14 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
    <div>
      <p className="type-subhead font-semibold text-primary">Plan {free.name}</p>
      <p className="mt-2 font-rounded text-[clamp(96px,18vw,168px)] font-bold leading-[0.9] tracking-tighter tabular-nums">0<span className="text-primary"> €</span></p>
      <p className="mt-4 type-body text-muted-foreground">Sin tarjeta. Sin caducidad. Web y móvil.</p>
      <Button variant="hero" size="lg" asChild className="mt-8 w-full sm:w-auto sm:px-10">
        <Link to="/onboarding" onClick={() => { void hapticTap(); track("cta_click", { cta: "free_signup", source: "free_plan" }); }}>Crear mi rutina gratis</Link>
      </Button>
    </div>
    <div>
      <p className="type-headline">Desde el primer día puedes:</p>
      <ul className="mt-5 grid gap-4">
        {free.features.map((f) => <li key={f} className="flex gap-3 type-body"><Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />{f}</li>)}
      </ul>
      {free.notIncluded.length > 0 && <p className="mt-6 border-t border-border/60 pt-5 type-footnote text-muted-foreground">No incluye: {free.notIncluded.join(" · ").toLowerCase()}. {plans.plus || plans.coach ? "Puedes pasarte a un plan de pago cuando quieras." : ""}</p>}
    </div>
  </div>;
}
