import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icono (componente de lucide o nodo propio). */
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  description?: string;
  /** CTA opcional bajo el texto. */
  action?: React.ReactNode;
  className?: string;
}

/** Estado vacío único de la app: icono grande, título y una línea, sin caja ni borde. */
const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
    {Icon ? <Icon className="h-12 w-12 text-muted-foreground/60" strokeWidth={1.5} /> : null}
    <p className={cn("type-title2", Icon && "mt-4")}>{title}</p>
    {description ? <p className="mt-1.5 max-w-[32ch] type-subhead text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export { EmptyState };
