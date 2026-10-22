import * as React from "react";
import { IconTile } from "@/components/ui/icon-tile";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressInlineStateProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Inside a sheet or card (`bg-card`): the squircle goes one tone up so it stays visible. */
  inset?: boolean;
  className?: string;
}

/**
 * Estado dentro de una pantalla que ya tiene protagonista (gráfica sin datos suficientes,
 * comparación sin fotos): la composición de la bienvenida a una escala menor.
 */
const ProgressInlineState = ({ icon: Icon, title, description, action, inset, className }: ProgressInlineStateProps) => (
  <div className={cn("flex flex-col items-center justify-center px-6 text-center", className)}>
    <IconTile icon={Icon} size="md" />
    <p className="mt-4 type-title3">{title}</p>
    {description ? <p className="mt-1 max-w-[32ch] type-subhead text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-2">{action}</div> : null}
  </div>
);

export { ProgressInlineState };
