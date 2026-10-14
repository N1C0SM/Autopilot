import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FeatureRowProps {
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: ReactNode;
  description?: ReactNode;
  /** Acción en texto bajo la descripción (Button variant="plain"). */
  action?: ReactNode;
  className?: string;
}

/**
 * El patrón de la bienvenida (la lista de novedades de Apple): icono dorado de 28 px a
 * la izquierda, título 17 semibold y descripción 15 gris a la derecha, sin caja.
 */
export const FeatureRow = ({ icon: Icon, title, description, action, className }: FeatureRowProps) => (
  <div className={cn("flex items-start gap-4", className)}>
    <div aria-hidden="true" className="flex w-10 shrink-0 items-center justify-center pt-0.5">
      <Icon className="h-7 w-7 text-primary" strokeWidth={1.75} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="type-headline">{title}</p>
      {description ? <p className="mt-1 type-subhead text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  </div>
);

export default FeatureRow;
