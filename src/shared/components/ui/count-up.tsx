import { useEffect, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Cifra que sube desde 0 al aparecer (como los resúmenes de Fitness). Con «reducir
 * movimiento» activado, o fuera del navegador, muestra el valor final sin animar.
 */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("es-ES"), durationMs = 900 }: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() || typeof requestAnimationFrame !== "function" ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);
  return <>{format(shown)}</>;
}
