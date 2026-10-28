import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import ScrollWords from "@/web/components/ScrollWords";
import { track } from "@/shared/lib/analytics";
import { hapticTap } from "@/shared/lib/native";

/** Cierre común de las páginas públicas: un titular y una sola acción. */
const FinalCta = forwardRef<HTMLDivElement, { source: string }>(({ source }, ref) =>
  <div ref={ref} className="mx-auto max-w-4xl px-5 py-28 text-center sm:px-8 sm:py-40">
    <h2 className="type-display"><ScrollWords text="Empieza a entrenar con" accent="Autopilot" /></h2>
    <p className="mt-4 type-body text-muted-foreground md:text-[21px]">Gratis y sin tarjeta.</p>
    <Button variant="hero" size="lg" asChild className="mt-8 w-full max-w-sm sm:w-auto sm:px-12">
      <Link to="/onboarding" onClick={() => { void hapticTap(); track("cta_click", { cta: "free_signup", source }); }}>Crear mi rutina gratis</Link>
    </Button>
  </div>);
FinalCta.displayName = "FinalCta";

export default FinalCta;
