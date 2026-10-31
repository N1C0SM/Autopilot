import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface PageTitleProps {
  /** Línea pequeña en dorado sobre el título (contexto: «Nutrición», «Hoy»). */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Una sola línea de apoyo. Si necesitas dos, es copy de sección, no de cabecera. */
  subtitle?: React.ReactNode;
  /** Acción alineada a la derecha (botón pequeño, filtro). */
  action?: React.ReactNode;
  className?: string;
  /** `h1` en pantallas de primer nivel; `h2` dentro de una sección. */
  as?: "h1" | "h2";
}

/**
 * Cabecera de pantalla única del producto: eyebrow dorado opcional, título grande,
 * subtítulo de una línea y acción opcional.
 *
 *   <PageTitle eyebrow="Hoy" title="Buen trabajo, Nicolás." subtitle="3 sesiones esta semana" />
 *
 * No añadas márgenes al usarlo: la pieza ya trae su ritmo y el margen lo pone la
 * pantalla con la escala de espacio (32 en app, 96 en web).
 */
const PageTitle = ({ eyebrow, title, subtitle, action, className, as: Heading = "h1" }: PageTitleProps) => (
  <div className={cn("flex items-start justify-between gap-4", className)}>
    <div className="min-w-0">
      {eyebrow ? (
        <p className="type-footnote font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      ) : null}
      <Heading className={cn("type-large-title", eyebrow && "mt-1")}>{title}</Heading>
      {subtitle ? <p className="mt-1 type-subhead text-muted-foreground">{subtitle}</p> : null}
    </div>
    {action ? <div className="shrink-0 pt-1">{action}</div> : null}
  </div>
);

export { PageTitle };
