import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ShieldCheck } from "lucide-react";

const STORAGE_KEY = "scan_exit_intent_shown";

export default function ExitIntentModal({ onCta }: { onCta: () => void }) {
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
    close();
    onCta();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-lg w-full bg-card border border-primary/30 rounded-3xl p-8 shadow-2xl"
          >
            <button
              onClick={close}
              className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-muted/50 flex items-center justify-center text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-[10px] uppercase tracking-widest text-primary mb-2">Espera</div>
            <h3 className="text-2xl sm:text-3xl font-bold font-display leading-tight mb-3">
              Te llevas el diagnóstico,<br />
              <span className="text-gradient">¿y no el plan que lo arregla?</span>
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              Guardamos tu análisis. Activa tu plan en 60 segundos — 7 días gratis, sin compromiso, cancelas en 1 clic.
            </p>
            <button
              onClick={cta}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-3.5 rounded-xl transition-colors"
            >
              Empezar mi plan por 0€ hoy
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Garantía 30 días · Sin permanencia
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}