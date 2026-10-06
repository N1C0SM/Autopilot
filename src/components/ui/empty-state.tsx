import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icono de 24px (componente de lucide o nodo propio). */
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  /** CTA opcional bajo el texto. */
  action?: React.ReactNode;
  className?: string;
}

/** Estado vacío único de la app: bajo (~200px), en una sola línea de texto. */
const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-4 py-10 text-center",
      className,
    )}
  >
    {Icon ? <Icon className="h-6 w-6 text-muted-foreground" /> : null}
    <p className="mt-2 text-sm font-semibold">{title}</p>
    {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-3">{action}</div> : null}
  </div>
);

export { EmptyState };
