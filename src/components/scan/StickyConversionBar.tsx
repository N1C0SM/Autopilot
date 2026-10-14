import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { euro, usePlanAvailability } from "@/lib/planCatalog";
import { isIOSNative } from "@/lib/platform";
import { hapticTap } from "@/lib/native";
import { Button } from "@/components/ui/button";

function StickyBar({ onCta }: { onCta: () => void }) {
  const [show, setShow] = useState(false);
  const plans = usePlanAvailability();

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
          className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl"
          style={{ bottom: "calc(var(--safe-bottom, 0px) + 12px)" }}
        >
          <div className="material rounded-2xl shadow-2xl p-2 pl-4 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="type-headline truncate">Tu plan, adaptado a ti · 7 días de prueba</div>
              <div className="type-footnote text-muted-foreground truncate">{[plans.plus && `${plans.plusName} desde ${euro(plans.plusPrice)}/mes`, plans.coach && `Nicolás en ${plans.coachName}`, "no se cobra hasta el día 8"].filter(Boolean).join(" · ")}</div>
            </div>
            <Button
              size="sm"
              className="shrink-0 min-h-[44px] px-5"
              onClick={() => {
                void hapticTap();
                onCta();
              }}
            >
              Elegir plan
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function StickyConversionBar({ onCta }: { onCta: () => void }) {
  // iOS v1 (reader app, App Store §3.1.3(a)): no sticky upsell inside the native build.
  if (isIOSNative()) return null;
  return <StickyBar onCta={onCta} />;
}
