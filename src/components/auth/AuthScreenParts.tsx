import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Piezas comunes de las pantallas de acceso (login, registro, recuperar y
 * restablecer contraseña), con la composición de la bienvenida: protagonista
 * arriba, campos en una lista agrupada y una sola acción dorada abajo.
 */

/** El icono de la app, con la misma silueta y acabado que en la bienvenida. */
export const AuthAppMark = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "mx-auto flex h-16 w-16 items-center justify-center rounded-[22%] border border-primary/20 bg-background shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.4)]",
      className,
    )}
  >
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-[62%] w-[62%] text-primary" fill="none">
      <path d="M14 86 L50 14 L86 86" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M56 46 L36 66 L48 66 L44 86 L62 60 L50 60 L55 46 Z" fill="currentColor" />
    </svg>
  </div>
);

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number | string }>;

/** Símbolo en squircle para lo que no es la app en sí (recuperar, enviado, hecho). */
export const AuthSymbol = ({ icon: Icon, size = "md" }: { icon: IconComponent; size?: "md" | "lg" }) => (
  <div
    className={cn(
      "mx-auto flex items-center justify-center rounded-[22%] bg-card",
      size === "lg" ? "h-[72px] w-[72px]" : "h-16 w-16",
    )}
  >
    <Icon className={cn("text-primary", size === "lg" ? "h-8 w-8" : "h-7 w-7")} strokeWidth={1.75} />
  </div>
);

/** Protagonista: símbolo, titular `type-title1` y una línea gris. */
export const AuthHero = ({
  mark,
  title,
  description,
  children,
}: {
  mark: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) => (
  <div className="text-center">
    {mark}
    <h1 className="mt-6 type-title1">{title}</h1>
    {description ? (
      <p className="mx-auto mt-2 max-w-[34ch] type-subhead text-muted-foreground">{description}</p>
    ) : null}
    {children}
  </div>
);

/** Campos de un formulario en una lista agrupada, con hairlines entre filas. */
export const AuthFieldGroup = ({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <div className="overflow-hidden rounded-2xl bg-card">{children}</div>
    {footer}
  </div>
);

/** Una fila de la lista: etiqueta solo para lectores de pantalla, campo y control opcional. */
export const AuthFieldRow = ({
  label,
  htmlFor,
  trailing,
  children,
}: {
  label: string;
  htmlFor: string;
  trailing?: ReactNode;
  children: ReactNode;
}) => (
  <div className="group/field pl-4 transition-colors duration-150 md:focus-within:bg-secondary">
    <label htmlFor={htmlFor} className="sr-only">
      {label}
    </label>
    <div className="flex items-center group-[:not(:last-child)]/field:sep-b">
      {children}
      {trailing}
    </div>
  </div>
);

/** Texto bajo la lista: error en rojo (anunciado) o ayuda en gris. */
export const AuthFieldNote = ({
  id,
  tone = "muted",
  children,
}: {
  id?: string;
  tone?: "muted" | "error";
  children: ReactNode;
}) => (
  <p
    id={id}
    role={tone === "error" ? "alert" : undefined}
    className={cn("px-4 pt-2 type-footnote", tone === "error" ? "text-destructive" : "text-muted-foreground")}
  >
    {children}
  </p>
);

/** Aviso con el patrón de la bienvenida: icono dorado, título y descripción, sin caja. */
export const AuthNotice = ({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex items-start gap-4 text-left", className)}>
    <div className="flex w-10 shrink-0 justify-center pt-0.5 [&>svg]:h-7 [&>svg]:w-7 [&>svg]:text-primary">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="type-headline">{title}</p>
      {children ? <div className="mt-1 type-subhead text-muted-foreground">{children}</div> : null}
    </div>
  </div>
);
