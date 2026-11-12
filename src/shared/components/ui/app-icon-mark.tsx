import appIcon from "@/shared/assets/autopilot-logo.png";
import { cn } from "@/shared/lib/utils";

/**
 * El icono de la app (cuadro dorado y el AP negro, de scripts/gen-icon.mjs) para
 * el acceso, el registro, la bienvenida y «¿Quién entrena?». Esquinas del iPhone (22,37 %) y
 * sombra suave; igual que `AppIconMark` en la app nativa.
 */
export const AppIconMark = ({ size = 64, className }: { size?: number; className?: string }) => (
  <img
    src={appIcon}
    alt=""
    aria-hidden="true"
    width={size}
    height={size}
    decoding="async"
    draggable={false}
    className={cn("shrink-0 select-none shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8)]", className)}
    style={{ width: size, height: size, borderRadius: size * 0.2237 }}
  />
);
