import { useId } from "react";
import { BRAND_A, BRAND_P, BRAND_VIEWBOX } from "@/shared/components/ui/brand-mark";
import { cn } from "@/shared/lib/utils";

/**
 * El icono de la app dibujado en vector desde la geometría única de la marca (`BRAND_A`/`BRAND_P`):
 * cuadro dorado con luz arriba y el monograma AP negro, igual que scripts/gen-icon.mjs. Esquinas del
 * iPhone (size * 0.2237) y sombra suave; igual que `AppIconMark` en la app nativa.
 */
export const AppIconMark = ({ size = 64, className }: { size?: number; className?: string }) => {
  const id = useId().replace(/:/g, "");
  const { x, y, width, height } = BRAND_VIEWBOX;
  // El monograma ocupa el 64 % del ancho del cuadro, centrado.
  const markW = 1024 * 0.64;
  const scale = markW / width;
  const tx = (1024 - markW) / 2 - x * scale;
  const ty = (1024 - height * scale) / 2 - y * scale;
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0 select-none shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8)]", className)}
      style={{ width: size, height: size, borderRadius: size * 0.2237 }}
    >
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E6C574" /><stop offset=".5" stopColor="#D8B25E" /><stop offset="1" stopColor="#C9A04E" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" /><stop offset=".3" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill={`url(#${id}t)`} />
      <rect width="1024" height="1024" fill={`url(#${id}l)`} />
      <g transform={`translate(${tx} ${ty}) scale(${scale})`} fill="#0B0A0A">
        <path d={BRAND_A} />
        <path d={BRAND_P} />
      </g>
    </svg>
  );
};
