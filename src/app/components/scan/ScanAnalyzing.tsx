import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProgressRing } from "@/shared/components/ui/progress-ring";
import { Spinner } from "@/shared/components/ui/spinner";
import { SCAN_LOADING_MESSAGES, SCAN_MESSAGE_MS } from "@/shared/lib/scanLoading";

/**
 * Pantalla de espera del scan (la «ruedecita»): anillo dorado con el porcentaje y mensajes que
 * rotan. La comparten el scan público y Progreso → Scan; la app la calca en `ScanView.swift`.
 */
export default function ScanAnalyzing({ progress, navTitle }: { progress: number; navTitle?: boolean }) {
  const [msg, setMsg] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMsg((i) => (i + 1) % SCAN_LOADING_MESSAGES.length), SCAN_MESSAGE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
      <div className="relative mb-8">
        <span aria-hidden className="pointer-events-none absolute -inset-16 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.14),transparent)]" />
        <ProgressRing value={progress} size={160} stroke={12} label="Progreso del análisis">
          <span className="type-figure text-[34px] font-bold leading-none tabular-nums">
            {Math.round(progress)}
            <span className="type-headline text-muted-foreground">%</span>
          </span>
        </ProgressRing>
      </div>
      <h2 data-nav-title={navTitle || undefined} className="type-title1">Analizando tu físico</h2>
      <AnimatePresence mode="wait">
        <motion.div
          key={msg}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-3 flex items-center justify-center gap-2 type-callout text-muted-foreground"
        >
          <Spinner size="sm" />
          {SCAN_LOADING_MESSAGES[msg]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
