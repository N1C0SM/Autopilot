import * as React from "react";
import { cn } from "@/shared/lib/utils";

const SIZE = { sm: 16, md: 20, lg: 28 } as const;
const BLADES = 8;

export interface SpinnerProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  size?: keyof typeof SIZE;
  /** Texto accesible. */
  label?: string;
}

/**
 * El indicador de actividad de iOS: ocho aspas que se apagan por turnos.
 * Hereda el color del texto; por defecto, gris secundario.
 */
const Spinner = ({ size = "md", label = "Cargando", className, style, ...props }: SpinnerProps) => (
  <span
    role="status"
    aria-label={label}
    className={cn("inline-block shrink-0 text-muted-foreground", className)}
    style={{ width: SIZE[size], height: SIZE[size], ...style }}
    {...props}
  >
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
      {Array.from({ length: BLADES }, (_, i) => (
        <rect
          key={i}
          x="11"
          y="2"
          width="2"
          height="6"
          rx="1"
          fill="currentColor"
          transform={`rotate(${i * (360 / BLADES)} 12 12)`}
          className="animate-ios-spinner"
          style={{ animationDelay: `${(i - BLADES) * 0.1}s` }}
        />
      ))}
    </svg>
  </span>
);

export { Spinner };
