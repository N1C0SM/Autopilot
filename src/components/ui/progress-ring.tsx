import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  /** 0–100. */
  value: number;
  /** Diámetro en px. */
  size?: number;
  /** Grosor del trazo en px. */
  stroke?: number;
  /** Clase de color del anillo (`text-primary` por defecto); la pista usa el mismo color al 20 %. */
  className?: string;
  /** Contenido centrado dentro del anillo (cifra, icono). */
  children?: React.ReactNode;
  label?: string;
}

/**
 * Anillo de progreso al estilo de Actividad: trazo redondeado sobre una pista del mismo
 * color atenuado. Se llena al montar salvo con movimiento reducido.
 */
const ProgressRing = ({ value, size = 44, stroke = 6, className, children, label }: ProgressRingProps) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = React.useState(0);

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center text-primary", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
          style={{ opacity: shown > 0 ? 1 : 0 }}
        />
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  );
};

export { ProgressRing };
