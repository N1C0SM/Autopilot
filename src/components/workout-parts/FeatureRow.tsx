import type { ComponentType, ReactNode } from "react";
import { IconTile } from "@/components/ui/icon-tile";
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
 * Fila de novedades: icono en su cuadrado tintado a la izquierda, título 17 semibold y
 * descripción 15 gris a la derecha.
 */
export const FeatureRow = ({ icon: Icon, title, description, action, className }: FeatureRowProps) => (
  <div className={cn("flex items-start gap-4", className)}>
    <IconTile icon={Icon} />
    <div className="min-w-0 flex-1">
      <p className="type-headline">{title}</p>
      {description ? <p className="mt-1 type-subhead text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  </div>
);

export default FeatureRow;
