import { cn } from "@/shared/lib/utils";

/**
 * Geometría única del monograma AP (desde el 12-11-2026, el de la propuesta de ChatGPT): la pata
 * derecha de la «A» hace de palo de la «P». Coordenadas del dibujo original; caja `BRAND_VIEWBOX`.
 * La misma en nativo (`BrandMark` en Components.swift), en los PNG (scripts/gen-icon.mjs) y en las
 * tarjetas para compartir.
 */
export const BRAND_A = "M35 520L382 50Q396 34 411 52L680 515H548L390 235L203 510Q197 520 185 520Z";
export const BRAND_P = "M460 45H775A166.5 166.5 0 0 1 775 378H655L600 272H770A62 62 0 0 0 770 148H520Z";
/** Caja del monograma con un margen mínimo: x 30–946, y 30–530 (ancho 1,832 veces el alto). */
export const BRAND_VIEWBOX = { x: 30, y: 30, width: 916, height: 500 } as const;

/**
 * Firma de Autopilot: el monograma AP. Es el logo, la marca de agua y el loader.
 * Una sola por vista (.claude/design/marca.md). `size` es el ancho; el alto sale de su
 * proporción. Hereda el color del texto; con `beat` la «P» late (y queda quieta con
 * «reducir movimiento»).
 */
export function BrandMark({ size = 24, beat = false, className, label }: {
  size?: number;
  beat?: boolean;
  className?: string;
  label?: string;
}) {
  const { x, y, width, height } = BRAND_VIEWBOX;
  return (
    <svg
      viewBox={`${x} ${y} ${width} ${height}`}
      width={size}
      height={Math.round((size * height) / width)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 text-primary", className)}
    >
      <path d={BRAND_A} fill="currentColor" />
      <path d={BRAND_P} fill="currentColor" className={cn(beat && "origin-center motion-safe:animate-brand-beat")} style={{ transformBox: "fill-box" }} />
    </svg>
  );
}
