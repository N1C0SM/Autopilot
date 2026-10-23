import { useState, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Piezas comunes de las pantallas de acceso (login, registro, recuperar y
 * restablecer contraseña), con la composición de la bienvenida: protagonista
 * arriba, campos en una lista agrupada y una sola acción dorada abajo.
 */

/** El icono de la app: la misma silueta, tamaño y acabado que en la bienvenida. */
export const AuthAppMark = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.6)]",
      className,
    )}
  >
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-[52%] w-[52%] text-primary-foreground" fill="none">
      <path d="M14 86 L50 14 L86 86" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M56 46 L36 66 L48 66 L44 86 L62 60 L50 60 L55 46 Z" fill="currentColor" />
    </svg>
  </div>
);

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number | string }>;

/** Símbolo en squircle (recuperar, enviado, hecho): mismo tamaño que el icono de la app. */
export const AuthSymbol = ({ icon: Icon }: { icon: IconComponent }) => (
  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-card">
    <Icon className="h-9 w-9 text-primary" strokeWidth={1.75} />
  </div>
);

/** Imagen de contenido con respaldo compuesto si falta la URL o falla la carga. */
export const AuthImage = ({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" onError={() => setFailedSrc(src)} />;
};

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
  <div className="relative text-center">
    {/* Halo dorado, como «¿Quién entrena?» y la landing: el mismo ecosistema. */}
    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-10 -z-10 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.14),transparent)]" />
    <p className="mb-5 type-headline text-primary">Autopilot</p>
    {mark}
    <h1 className="mt-6 font-rounded text-[32px] font-bold leading-tight tracking-tight">{title}</h1>
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
    {/* Cada campo es una píldora, como en «¿Quién entrena?». */}
    <div className="flex flex-col gap-3">{children}</div>
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
  <div className="group/field rounded-full bg-card pl-5 ring-2 ring-transparent transition-shadow duration-150 focus-within:ring-primary">
    <label htmlFor={htmlFor} className="sr-only">
      {label}
    </label>
    <div className="flex min-h-12 items-center">
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
    className={cn("px-5 pt-2 type-footnote", tone === "error" ? "text-destructive" : "text-muted-foreground")}
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
