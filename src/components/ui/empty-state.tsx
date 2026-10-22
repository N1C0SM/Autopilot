import * as React from "react";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icono (componente de lucide o nodo propio). */
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  description?: React.ReactNode;
  /** CTA opcional bajo el texto. */
  action?: React.ReactNode;
  className?: string;
  /** Dentro de su propia tarjeta, como el resto de bloques de la pantalla. */
  card?: boolean;
}

/**
 * Estado vacío único de la app: icono en su cuadrado tintado, título y una línea,
 * sin caja ni borde.
 */
const EmptyState = ({ icon: Icon, title, description, action, className, card }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", card && "rounded-2xl bg-card py-10", className)}>
    {Icon ? (
      <IconTile icon={Icon} size="lg" />
    ) : null}
    <p className={cn("type-title2", Icon && "mt-5")}>{title}</p>
    {description ? <p className="mt-1.5 max-w-[32ch] type-subhead text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-6">{action}</div> : null}
  </div>
);

export { EmptyState };
