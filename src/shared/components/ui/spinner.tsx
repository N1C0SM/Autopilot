import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { BrandMark } from "./brand-mark";

const SIZE = { sm: 16, md: 20, lg: 28 } as const;

export interface SpinnerProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  size?: keyof typeof SIZE;
  /** Texto accesible. */
  label?: string;
}

/**
 * Indicador de actividad con la firma de Autopilot: las tres barras 2-1-2 latiendo.
 * Hereda el color del texto; por defecto, gris secundario.
 */
const Spinner = ({ size = "md", label = "Cargando", className, style, ...props }: SpinnerProps) => (
  <span
    role="status"
    aria-label={label}
    className={cn("inline-flex shrink-0 items-center justify-center text-muted-foreground", className)}
    style={{ width: SIZE[size], height: SIZE[size], ...style }}
    {...props}
  >
    <BrandMark size={Math.round(SIZE[size] * 0.8)} beat className="text-current" />
  </span>
);

export { Spinner };
