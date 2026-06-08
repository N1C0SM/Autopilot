import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";

export default function StickyConversionBar({ onCta }: { onCta: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const pct = (window.scrollY + window.innerHeight) / doc.scrollHeight;
      setShow(pct > 0.45 && pct < 0.97);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-xl"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-primary/40 rounded-2xl shadow-2xl shadow-primary/20 p-2.5 pl-4 flex items-center gap-3">
            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate">Tu plan personalizado · 7 días gratis</div>
              <div className="text-[10px] text-muted-foreground truncate">19€/mes · cancela cuando quieras</div>
            </div>
            <button
              onClick={onCta}
              className="flex-shrink-0 inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              Empezar
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}