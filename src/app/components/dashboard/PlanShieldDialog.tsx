import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import ResponsiveSheet from "@/app/components/dashboard/ResponsiveSheet";
import { registerShield, type ShieldChoice } from "@/shared/lib/planShield";
import { hapticTap } from "@/shared/lib/native";

/** Se monta una vez en la app y responde a cualquier intento de sustituir una rutina hecha a mano. */
const PlanShieldDialog = () => {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((c: ShieldChoice) => void) | null>(null);

  useEffect(() => {
    registerShield((resolve) => { resolver.current = resolve; setOpen(true); });
    return () => registerShield(null);
  }, []);

  const choose = (c: ShieldChoice) => {
    void hapticTap();
    resolver.current?.(c);
    resolver.current = null;
    setOpen(false);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => { if (!o) choose("keep"); }}
      title="Tu plan tiene rutinas tuyas"
      description="El piloto automático no cambia un plan con rutinas tuyas sin tu permiso."
      desktopClassName="sm:max-w-md"
    >
      <div className="flex flex-1 flex-col justify-end gap-3 pb-4 md:justify-start md:pb-0">
        {/* Lo que pasa de verdad (generate-plan): no adapta solo una parte; o se conserva todo o se cambia entero. */}
        <div className="mb-2 flex items-start gap-3 rounded-card bg-primary/10 p-4">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
          <p className="type-subhead text-foreground/85">
            Puedes conservar tu plan tal cual o cambiarlo entero por uno nuevo del piloto automático. Si lo cambias, tus rutinas salen del plan; con una copia, las recuperas desde «Editar mi rutina» en este dispositivo.
          </p>
        </div>
        <Button size="lg" variant="hero" className="min-h-12 w-full" onClick={() => choose("keep")}>Conservar mi plan</Button>
        <Button size="lg" variant="secondary" className="min-h-12 w-full" onClick={() => choose("backup")}>Guardar copia y usar el nuevo</Button>
        <Button size="lg" variant="ghost" className="min-h-12 w-full text-muted-foreground" onClick={() => choose("replace")}>Cambiarlo sin copia</Button>
      </div>
    </ResponsiveSheet>
  );
};

export default PlanShieldDialog;
