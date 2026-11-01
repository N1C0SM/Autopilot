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
      title="Tu rutina está protegida"
      description="La has creado tú. El piloto automático no la cambia sin tu permiso."
      desktopClassName="sm:max-w-md"
    >
      <div className="flex flex-1 flex-col justify-end gap-3 pb-4 md:justify-start md:pb-0">
        <div className="mb-2 flex items-center gap-3 rounded-media border border-primary/30 bg-primary/10 p-4">
          <ShieldCheck className="h-6 w-6 shrink-0 text-primary" aria-hidden />
          <p className="type-subhead text-muted-foreground">Elige qué hacer. Si guardas una copia, la recuperas cuando quieras desde «Editar mi rutina».</p>
        </div>
        <Button size="lg" variant="hero" className="min-h-12 w-full" onClick={() => choose("keep")}>Conservar mi rutina</Button>
        <Button size="lg" variant="outline" className="min-h-12 w-full" onClick={() => choose("backup")}>Guardar copia y usar la automática</Button>
        <Button size="lg" variant="ghost" className="min-h-12 w-full text-muted-foreground" onClick={() => choose("replace")}>Sustituir sin copia</Button>
      </div>
    </ResponsiveSheet>
  );
};

export default PlanShieldDialog;
