import { useState, type ComponentType, type ReactNode } from "react";
import { AppIconMark } from "@/shared/components/ui/app-icon-mark";
import { cn } from "@/shared/lib/utils";

/**
 * Piezas comunes de las pantallas de acceso (login, registro, recuperar y
 * restablecer contraseña), con la composición de la bienvenida: protagonista
 * arriba, campos en una lista agrupada y una sola acción dorada abajo.
 */

/** Logo de la app: el icono con relieve y la palabra AUTOPILOT debajo (igual en iPhone y Mac). */
export const AuthAppMark = ({ className }: { className?: string }) => (
  <div className={cn("mx-auto flex flex-col items-center", className)}>
    <AppIconMark size={64} />
    <span className="mt-3.5 text-[20px] font-bold leading-none tracking-[0.06em] text-foreground">AUTOPILOT</span>
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

/** Protagonista: símbolo, titular `type-title1` y una línea gris. Sin `kicker` cuando el símbolo ya es el logo. */
export const AuthHero = ({
  mark,
  title,
  description,
  kicker = true,
  children,
}: {
  mark: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  kicker?: boolean;
  children?: ReactNode;
}) => (
  <div className="relative text-center">
    {/* Kicker — idéntico a la landing */}
    {kicker ? <p className="kicker mb-6">AUTOPILOT</p> : null}
    {mark}
    {/* Titular — mismo tracking que la landing */}
    <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
    {description ? (
      <p className="mx-auto mt-2 max-w-[34ch] text-[15px] text-foreground/75">{description}</p>
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

/** Una fila de la lista: icono gris opcional, etiqueta solo para lectores de pantalla, campo y control opcional. */
export const AuthFieldRow = ({
  label,
  htmlFor,
  icon: Icon,
  trailing,
  children,
}: {
  label: string;
  htmlFor: string;
  icon?: IconComponent;
  trailing?: ReactNode;
  children: ReactNode;
}) => (
  <div className="group/field rounded-full border border-border bg-background/40 pl-5 transition-colors duration-150 focus-within:border-primary">
    <label htmlFor={htmlFor} className="sr-only">
      {label}
    </label>
    <div className="flex min-h-14 items-center">
      {Icon ? (
        <Icon aria-hidden="true" strokeWidth={1.75} className="mr-3 h-5 w-5 shrink-0 text-muted-foreground transition-colors group-focus-within/field:text-primary" />
      ) : null}
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
