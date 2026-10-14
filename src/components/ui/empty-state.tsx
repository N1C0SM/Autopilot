import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icono (componente de lucide o nodo propio). */
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  description?: React.ReactNode;
  /** CTA opcional bajo el texto. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Estado vacío único de la app, con la misma composición que la bienvenida: el icono
 * en un squircle como el de la app, título y una línea, sin caja ni borde.
 */
const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
    {Icon ? (
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22%] bg-card">
        <Icon className="h-8 w-8 text-primary" strokeWidth={1.75} />
      </div>
    ) : null}
    <p className={cn("type-title2", Icon && "mt-5")}>{title}</p>
    {description ? <p className="mt-1.5 max-w-[32ch] type-subhead text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-6">{action}</div> : null}
  </div>
);

export { EmptyState };
