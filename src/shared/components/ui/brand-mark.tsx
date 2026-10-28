import { cn } from "@/shared/lib/utils";

/** Geometría única de la «A» con rayo (viewBox 0 0 100 100); la misma en nativo y en los PNG. */
export const BRAND_A = "M50 10L88 86H70L50 44L30 86H12Z";
export const BRAND_BOLT = "M52 55L44 70H49.5L47 81L56 65H50.5Z";

/**
 * Firma de Autopilot: la «A» con rayo. Es el logo, la marca de agua y el loader.
 * Una sola por vista (.claude/design/marca.md). Hereda el color del texto; con `beat`
 * el rayo late (y queda quieto con «reducir movimiento»).
 */
export function BrandMark({ size = 24, beat = false, className, label }: {
  size?: number;
  beat?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="10 8 80 80"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 text-primary", className)}
    >
      <path d={BRAND_A} fill="currentColor" />
      <path d={BRAND_BOLT} fill="currentColor" className={cn(beat && "origin-center motion-safe:animate-brand-beat")} style={{ transformBox: "fill-box" }} />
    </svg>
  );
}
