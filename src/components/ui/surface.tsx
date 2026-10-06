import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Superficie base de la app: tarjeta plana, sin sombras.
 * Radios y elevación cerrados: `rounded-xl border border-border bg-card`.
 */
const PADDING: Record<"none" | "sm" | "md", string> = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
};

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md";
}

const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, padding = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl border border-border bg-card", PADDING[padding], className)}
      {...props}
    />
  ),
);
Surface.displayName = "Surface";

export { Surface };
