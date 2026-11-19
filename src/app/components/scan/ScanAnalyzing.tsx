import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Spinner } from "@/shared/components/ui/spinner";
import { cn } from "@/shared/lib/utils";
import { SCAN_LOADING_MESSAGES, SCAN_MESSAGE_MS, SCAN_WAIT_NOTE, scanSteps, type ScanStage } from "@/shared/lib/scanLoading";

/**
 * Espera del scan: la foto que se analiza (con una línea dorada que la recorre), «Analizando tu
 * físico» y los pasos reales, cada uno marcado cuando termina de verdad; el paso activo lleva el AP
 * latiendo y los mensajes que rotan. Sin porcentajes inventados. La comparten el scan público y
 * Progreso → Scan; la app la calca en `ScanAnalyzingView` (ScanView.swift).
 */
export default function ScanAnalyzing({ photo, stage, saves = false, navTitle }: {
  photo?: string | null;
  stage: ScanStage;
  /** El scan con cuenta guarda en el historial antes del resultado (un paso más). */
  saves?: boolean;
  navTitle?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [msg, setMsg] = useState(0);
  useEffect(() => {
    if (stage !== "analyzing") return;
    const id = window.setInterval(() => setMsg((i) => (i + 1) % SCAN_LOADING_MESSAGES.length), SCAN_MESSAGE_MS);
    return () => window.clearInterval(id);
  }, [stage]);
  const steps = scanSteps(stage, saves);
  const active = steps.find((s) => s.state === "active");

  return (
    <div className="flex w-full flex-col gap-[18px]">
      {photo && (
        <div className="relative h-[320px] overflow-hidden rounded-sheet bg-card" aria-hidden="true">
          <img src={photo} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
          {!reduceMotion && stage !== "done" && (
            <motion.div
              className="absolute inset-x-0 top-0 h-16"
              initial={{ y: -62 }}
              animate={{ y: 256 }}
              transition={{ duration: 2.4, ease: [0.45, 0, 0.55, 1], repeat: Infinity, repeatType: "reverse" }}
            >
              <div className="h-full w-full bg-gradient-to-b from-transparent to-primary/20" />
              <div className="h-[2px] w-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.8)]" />
            </motion.div>
          )}
        </div>
      )}

      <header className="flex flex-col gap-1">
        <h2 data-nav-title={navTitle || undefined} className="type-title1">Analizando tu físico</h2>
        <p className="type-subhead text-muted-foreground">{SCAN_WAIT_NOTE}</p>
      </header>

      <ol aria-label="Pasos del análisis" className="overflow-hidden rounded-card bg-card">
        {steps.map((step, i) => (
          <li
            key={step.label}
            aria-current={step.state === "active" ? "step" : undefined}
            className={cn("flex min-h-[60px] items-center gap-3.5 px-4 py-3", i > 0 && "sep-t")}
          >
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center">
              {step.state === "done" ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              ) : step.state === "active" ? (
                <Spinner size="md" label="Analizando" className="text-primary" />
              ) : (
                <span className="h-6 w-6 rounded-full border-[1.5px] border-muted-foreground/40" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block type-headline", step.state === "pending" && "text-muted-foreground")}>{step.label}</span>
              {step.state === "active" && i === 1 && (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={msg}
                    aria-hidden="true"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-0.5 block type-footnote text-muted-foreground"
                  >
                    {SCAN_LOADING_MESSAGES[msg]}
                  </motion.span>
                </AnimatePresence>
              )}
            </span>
            <span className="sr-only">{step.state === "done" ? "hecho" : step.state === "active" ? "en curso" : "pendiente"}</span>
          </li>
        ))}
      </ol>
      {/* VoiceOver oye el paso cuando cambia, no cada mensaje que rota (serían avisos cada 1,6 s). */}
      <p role="status" className="sr-only">{active ? `${active.label}: en curso` : "Análisis terminado"}</p>
    </div>
  );
}
