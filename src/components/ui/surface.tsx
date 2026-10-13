import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Superficie base de la app: tarjeta plana que se separa del fondo por color,
 * sin borde ni sombra. `rounded-2xl bg-card`.
 */
const PADDING: Record<"none" | "sm" | "md", string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
};

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md";
}

const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, padding = "md", ...props }, ref) => (
    <div ref={ref} className={cn("rounded-2xl bg-card", PADDING[padding], className)} {...props} />
  ),
);
Surface.displayName = "Surface";

export { Surface };
