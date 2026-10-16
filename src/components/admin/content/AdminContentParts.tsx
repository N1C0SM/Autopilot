import { useState, type ComponentType, type ImgHTMLAttributes, type ReactNode } from "react";
import { ChevronLeft, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/native";

/**
 * Valores técnicos (URLs, slug, Markdown) dentro de un campo: monoespaciada de 13 pt.
 * `.field` fija 17 pt, así que el tamaño del tipo lleva `!` para ganarle.
 */
export const MONO_FIELD = "font-mono !type-footnote";

interface ImageWithFallbackProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> {
  src?: string | null;
  /** Icono gris del hueco compuesto (`ImageIcon` por defecto). */
  fallbackIcon?: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  iconClassName?: string;
  /** Hueco propio (p. ej. con texto) en lugar del icono. Hereda `className` del contenedor si es `null`. */
  fallback?: ReactNode;
}

/**
 * Imagen de contenido con respaldo compuesto: si falta la URL o falla la carga se pinta
 * un hueco `bg-secondary` con un icono gris, nunca el icono de imagen rota del navegador.
 */
export const ImageWithFallback = ({
  src,
  alt = "",
  className,
  fallbackIcon: Icon = ImageIcon,
  iconClassName = "h-5 w-5",
  fallback,
  ...props
}: ImageWithFallbackProps) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className={cn("flex items-center justify-center bg-secondary text-muted-foreground", className)} aria-hidden="true">
        <Icon className={iconClassName} strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <img
      loading="lazy"
      decoding="async"
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
      {...props}
    />
  );
};

interface InlineBackProps {
  /** Nombre de la pantalla anterior ("Blog", "Drive"). */
  label: string;
  onClick: () => void;
  className?: string;
}

/**
 * Botón de volver con el aspecto del de la barra de navegación (`‹` + nombre de la pantalla
 * anterior) para subvistas que viven dentro de una sección y no pueden tocar la barra del host.
 */
export const InlineBack = ({ label, onClick, className }: InlineBackProps) => (
  <button
    type="button"
    onClick={() => {
      void hapticTap();
      onClick();
    }}
    className={cn("-ml-2 inline-flex h-11 items-center gap-0.5 pl-0 pr-2 text-primary transition-opacity active:opacity-60", className)}
  >
    <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden="true" />
    <span className="type-body">{label}</span>
  </button>
);
