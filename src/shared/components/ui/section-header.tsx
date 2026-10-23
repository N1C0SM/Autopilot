import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface SectionHeaderProps {
  title: React.ReactNode;
  /** Texto pequeño bajo el título (recuentos, contexto). */
  hint?: React.ReactNode;
  /** Nodo alineado a la derecha (botón, filtro, acción). */
  action?: React.ReactNode;
  /** lg = sección principal (22), md = sección (20), sm = subsección (17). */
  size?: "lg" | "md" | "sm";
  className?: string;
}

const TITLE: Record<NonNullable<SectionHeaderProps["size"]>, string> = {
  lg: "type-title2",
  md: "type-title3",
  sm: "type-headline",
};

/** Título de sección único de la app. */
const SectionHeader = ({ title, hint, action, size = "md", className }: SectionHeaderProps) => (
  <div className={cn("flex items-end justify-between gap-3", className)}>
    <div className="min-w-0">
      <h2 className={TITLE[size]}>{title}</h2>
      {hint ? <p className="mt-0.5 type-footnote text-muted-foreground">{hint}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

export { SectionHeader };
