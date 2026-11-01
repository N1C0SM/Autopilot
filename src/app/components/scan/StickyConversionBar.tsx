import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isIOSNative } from "@/shared/lib/platform";
import { hapticTap } from "@/shared/lib/native";
import { Button } from "@/shared/components/ui/button";

function StickyBar({ onCta }: { onCta: () => void }) {
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
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          // Centrada con inset + mx-auto: framer-motion escribe su propio transform y anularía un -translate-x-1/2.
          className="fixed inset-x-4 mx-auto z-40 max-w-xl"
          style={{ bottom: "calc(var(--safe-bottom, 0px) + 12px)" }}
        >
          <div className="material rounded-media shadow-2xl p-2 pl-4 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="type-headline truncate">Tu rutina a medida</div>
              <div className="type-footnote text-muted-foreground truncate">Gratis · Sin tarjeta</div>
            </div>
            <Button
              className="shrink-0 rounded-full px-5"
              onClick={() => {
                void hapticTap();
                onCta();
              }}
            >
              Crear cuenta
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function StickyConversionBar({ onCta }: { onCta: () => void }) {
  // iOS v1 (App Store §3.1.1: sin venta de bienes digitales; §3.1.3(a) no cubre fitness): no sticky upsell inside the native build.
  if (isIOSNative()) return null;
  return <StickyBar onCta={onCta} />;
}
