import { useEffect, useState } from "react";
import { scanProgressAt } from "@/shared/lib/scanLoading";

/** Anillo del análisis: avanza con la curva compartida y llega al 100 % cuando `done`. */
export function useScanProgress(active: boolean, done = false) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    setProgress(0);
    const id = window.setInterval(() => setProgress(scanProgressAt(performance.now() - start)), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return done ? 100 : progress;
}
