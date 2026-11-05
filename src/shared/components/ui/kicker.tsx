import * as React from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Etiqueta de sección — igual que en la landing: 11px bold uppercase tracking-[0.2em] dorado.
 * Úsala antes de cada titular de bloque en landing y app para mantener la identidad única.
 *
 * @example
 * <Kicker>La experiencia</Kicker>
 * <h2>Todo tu progreso, en todos tus dispositivos.</h2>
 */
export const Kicker = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("kicker", className)}
      {...props}
    />
  ),
);
Kicker.displayName = "Kicker";
