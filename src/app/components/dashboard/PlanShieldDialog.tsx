import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/components/ui/drawer";
import { keptRoutinesTitle, registerShield, SHIELD_COPY, type KeptRoutines } from "@/shared/lib/planShield";
import { hapticTap } from "@/shared/lib/native";

/**
 * Se monta una vez en la app. La primera vez que el piloto automático prepara sus sesiones alrededor
 * de tus rutinas, explica que las tuyas siguen intactas (generate-plan nunca las pierde ni las
 * reescribe). No hay nada que elegir: una hoja corta con un solo botón.
 */
const PlanShieldDialog = () => {
  const [open, setOpen] = useState(false);
  // Se conserva al cerrar para que la hoja no cambie de texto mientras baja.
  const [notice, setNotice] = useState<KeptRoutines>({ count: 0, full: false });

  useEffect(() => {
    registerShield((next) => { setNotice(next); setOpen(true); });
    return () => registerShield(null);
  }, []);

  const close = () => {
    void hapticTap();
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="px-5 pt-4 text-left">
          <DrawerTitle className="type-title3">{keptRoutinesTitle(notice.count)}</DrawerTitle>
          <DrawerDescription>{SHIELD_COPY.description}</DrawerDescription>
        </DrawerHeader>
        <div className="px-5">
          <div className="flex items-start gap-3 rounded-card bg-primary/10 p-4">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
            <p className="type-subhead text-foreground/85">{notice.full ? SHIELD_COPY.full : SHIELD_COPY.body}</p>
          </div>
        </div>
        <DrawerFooter className="px-5 pb-5 pt-4">
          <Button size="lg" variant="hero" className="min-h-12 w-full" onClick={close}>{SHIELD_COPY.done}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default PlanShieldDialog;
