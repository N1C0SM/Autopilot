import type { ReactNode } from "react";
import { useScrollProgress } from "@/hooks/useScrollProgress";

/** Inclina el teléfono hacia atrás y lo endereza y acerca a medida que se baja. */
export default function HeroPhoneMotion({ children }: { children: ReactNode }) {
  // still = 0.5 deja el teléfono recto y a tamaño normal sin movimiento.
  const [ref, p] = useScrollProgress<HTMLDivElement>(0.5);
  const t = Math.min(1, p / 0.5);
  return <div ref={ref} style={{ perspective: "1400px" }}>
    <div className="will-change-transform" style={{ transform: `rotateX(${(1 - t) * 10}deg) scale(${0.95 + t * 0.05})`, transformOrigin: "50% 100%" }}>
      {children}
    </div>
  </div>;
}
