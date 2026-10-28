import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { isIOSNative } from "@/shared/lib/platform";
import { hapticTap } from "@/shared/lib/native";

const STORAGE_KEY = "scan_exit_intent_shown";

function ExitIntent({ onCta }: { onCta: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 768px)").matches) return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        sessionStorage.setItem(STORAGE_KEY, "1");
        setOpen(true);
      }
    };
    const t = setTimeout(() => document.addEventListener("mouseleave", onLeave), 4000);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const close = () => setOpen(false);
  const cta = () => {
    void hapticTap();
    close();
    onCta();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="type-title2 text-center">
          Ya tienes el análisis inicial, ahora elige un plan con entrenador
        </DialogTitle>
        <DialogDescription className="type-subhead text-muted-foreground text-center">
          Elige el plan que encaja contigo para que un entrenador real prepare y lleve tu entrenamiento. Pruébalo 7 días antes del primer cobro.
        </DialogDescription>
        <Button size="lg" className="w-full" onClick={cta}>
          Elegir mi plan
        </Button>
        <Button variant="plain" className="w-full" onClick={close}>
          Ahora no
        </Button>
        <div className="flex items-center justify-center gap-2 type-footnote text-muted-foreground">
          <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
          Requiere tarjeta · No se cobra hasta el día 8
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ExitIntentModal({ onCta }: { onCta: () => void }) {
  // iOS v1 (App Store §3.1.1: sin venta de bienes digitales; §3.1.3(a) no cubre fitness): no exit-intent upsell inside the native build.
  if (isIOSNative()) return null;
  return <ExitIntent onCta={onCta} />;
}
