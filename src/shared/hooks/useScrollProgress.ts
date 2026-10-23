import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce), (prefers-contrast: more)").matches;

/**
 * Progreso 0→1 del elemento mientras cruza la pantalla: 0 cuando su borde
 * superior toca el fondo del viewport, 1 cuando su borde inferior llega arriba.
 * Con «reducir movimiento» o «aumentar contraste» devuelve siempre `still`
 * (HIG: el movimiento es opcional y el texto atenuado no debe perder contraste).
 */
export function useScrollProgress<T extends HTMLElement>(still = 1) {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(still);
  // 0→1 solo mientras un hijo sticky está fijado, medido con el alto real de la sección.
  const [pinned, setPinned] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height + window.innerHeight;
      setProgress(Math.min(1, Math.max(0, (window.innerHeight - r.top) / total)));
      setPinned(Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight))));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);
  return [ref, progress, pinned] as const;
}

