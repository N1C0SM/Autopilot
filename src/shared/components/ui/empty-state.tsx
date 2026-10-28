import * as React from "react";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { BrandMark } from "./brand-mark";
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
  <div className={cn("relative overflow-hidden rounded-[28px] bg-card", className)}>
    {photo ? <>
      <img src={photo} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_25%] opacity-90" />
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-transparent" />
    </> : rest ? <>
      {/* Descanso con la firma de marca (no un dibujo): la «A» grande y tenue con su halo. */}
      <span aria-hidden="true" className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.18),transparent)]" />
      <BrandMark size={132} className="absolute -right-4 -top-4 text-primary/30" />
    </> : <>
      <span aria-hidden="true" className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.25),transparent)]" />
      <div aria-hidden="true" className="absolute right-8 top-8 flex h-28 w-28 items-center justify-center rounded-full border border-primary/20 bg-primary/10 shadow-[0_0_60px_hsl(var(--primary)/0.35)]">
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/15">
          <span className="h-10 w-10 rounded-full border-2 border-primary/50 shadow-inner" />
        </span>
      </div>
      {[[22, 28], [38, 62], [16, 76], [50, 36], [30, 48]].map(([t, l]) => (
        <span key={`${t}-${l}`} aria-hidden="true" className="absolute h-1 w-1 rounded-full bg-primary/40" style={{ top: `${t}%`, left: `${l}%` }} />
      ))}
    </>}
    <div className={cn("relative flex min-h-[18rem] flex-col justify-end p-5 text-left", (rest || nutrition) && !photo && "pt-36")}>
      {Icon && photo ? <Icon aria-hidden="true" className="h-6 w-6 text-primary" strokeWidth={2.25} /> : null}
      <p className="mt-2 font-rounded text-[28px] font-bold leading-tight tracking-tight">{title}</p>
      {description ? <p className="mt-1 type-subhead text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5 [&>*]:w-full">{action}</div> : null}
    </div>
  </div>
) : (
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
