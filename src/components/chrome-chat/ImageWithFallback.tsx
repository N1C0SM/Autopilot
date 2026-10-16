import { useState, type ImgHTMLAttributes, type VideoHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Hueco compuesto para contenido que falta: cuadrado gris con un icono de sistema. */
export const MediaPlaceholder = ({ icon: Icon = ImageIcon, className, iconClassName }: { icon?: LucideIcon; className?: string; iconClassName?: string }) => (
  <div aria-hidden="true" className={cn("flex items-center justify-center bg-secondary text-muted-foreground", className)}>
    <Icon className={cn("h-6 w-6", iconClassName)} strokeWidth={1.75} />
  </div>
);

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  /** Clases del hueco que sustituye a la imagen si falta la URL o falla la carga. */
  fallbackClassName?: string;
  fallbackIcon?: LucideIcon;
  fallbackIconClassName?: string;
}

/** `<img>` que nunca enseña el icono de imagen rota: sin URL o con error de carga pinta el hueco. */
export const ImageWithFallback = ({ src, fallbackClassName, fallbackIcon, fallbackIconClassName, className, onError, alt = "", ...rest }: Props) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return <MediaPlaceholder icon={fallbackIcon} iconClassName={fallbackIconClassName} className={cn(className, fallbackClassName)} />;
  }
  return (
    <img
      loading="lazy"
      decoding="async"
      {...rest}
      src={src}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailedSrc(src);
        onError?.(event);
      }}
    />
  );
};

interface VideoProps extends Omit<VideoHTMLAttributes<HTMLVideoElement>, "src"> {
  src?: string | null;
  fallbackClassName?: string;
}

/** `<video>` con el mismo respaldo compuesto: sin URL o con error de carga pinta el hueco, nunca una caja negra. */
export const VideoWithFallback = ({ src, fallbackClassName, className, onError, ...rest }: VideoProps) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return <MediaPlaceholder icon={VideoIcon} className={cn(className, fallbackClassName)} />;
  }
  return (
    <video
      {...rest}
      src={src}
      className={className}
      onError={(event) => {
        setFailedSrc(src);
        onError?.(event);
      }}
    />
  );
};
