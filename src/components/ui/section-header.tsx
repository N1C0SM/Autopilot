import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: React.ReactNode;
  /** Texto pequeño bajo el título (recuentos, contexto). */
  hint?: React.ReactNode;
  /** Nodo alineado a la derecha (botón, filtro, acción). */
  action?: React.ReactNode;
  className?: string;
}

/** Título de sección único de la app: 18px, semibold, tracking cerrado. */
const SectionHeader = ({ title, hint, action, className }: SectionHeaderProps) => (
  <div className={cn("flex items-start justify-between gap-3", className)}>
    <div className="min-w-0">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

export { SectionHeader };
