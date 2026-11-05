import * as React from "react";
import { cn } from "@/shared/lib/utils";

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
  /** Foto de marca de fondo (src/shared/lib/brandPhotos): tarjeta alta con el texto abajo, como la landing. */
  photo?: string;
  /** Tarjeta alta de noche (luna grande y halo), para el descanso: sin fotos de ejercicio. */
  rest?: boolean;
  /** Tarjeta alta temática de nutrición (halo dorado y plato estilizado) cuando aún no hay comidas. */
  nutrition?: boolean;
}

/**
 * Estado vacío único de la app: icono en su cuadrado tintado, título y una línea,
 * sin caja ni borde.
 */
const EmptyState = ({ icon: Icon, title, description, action, className, card, photo, rest, nutrition }: EmptyStateProps) => photo || rest || nutrition ? (
  <div className={cn("relative overflow-hidden rounded-[22px] border border-border bg-card", className)}>
    {photo ? <>
      <img src={photo} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_25%] opacity-90" />
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-transparent" />
    </> : rest ? <>
      <span aria-hidden="true" className="absolute right-8 top-8 h-16 w-16 rounded-full border border-foreground/15 [mask-image:radial-gradient(circle_at_30%_35%,transparent_42%,#000_43%)] bg-foreground/[0.06]" />
    </> : <>
      <div aria-hidden="true" className="absolute right-8 top-8 flex h-20 w-20 items-center justify-center rounded-full border border-foreground/10">
        <span className="h-10 w-10 rounded-full border border-foreground/15" />
      </div>
    </>}
    <div className={cn("relative flex min-h-[18rem] flex-col justify-end p-5 text-left", (rest || nutrition) && !photo && "pt-36")}>
      {Icon && photo ? <Icon aria-hidden="true" className="h-6 w-6 text-primary" strokeWidth={1.5} /> : null}
      <p className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">{title}</p>
      {description ? <p className="mt-1 type-subhead text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5 [&>*]:w-full">{action}</div> : null}
    </div>
  </div>
) : (
  <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", card && "rounded-[22px] border border-border bg-card py-10", className)}>
    {Icon ? (
      <Icon aria-hidden="true" className="h-7 w-7 text-muted-foreground" strokeWidth={1.25} />
    ) : null}
    <p className={cn("type-title2", Icon && "mt-5")}>{title}</p>
    {description ? <p className="mt-1.5 max-w-[32ch] type-subhead text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-6">{action}</div> : null}
  </div>
);

export { EmptyState };
