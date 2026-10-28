import { cn } from "@/shared/lib/utils";

/**
 * Firma de Autopilot («Ritmo»): tres barras 2-1-2, la cadencia excéntrica-pausa-concéntrica.
 * Es el logo sin texto, la marca de agua y el loader. Una sola por vista (.claude/design/marca.md).
 * Hereda el color del texto; con `beat` late (y se queda quieta con «reducir movimiento»).
 */
export function BrandMark({ size = 24, beat = false, className, label }: {
  size?: number;
  beat?: boolean;
  className?: string;
  label?: string;
}) {
  const bar = Math.max(2, Math.round(size * 0.2));
  const heights = [size, size / 2, size];
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 items-end text-primary", className)}
      style={{ height: size, gap: bar * 0.7 }}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn("block origin-bottom rounded-full bg-current", beat && "motion-safe:animate-brand-beat")}
          style={{ width: bar, height: h, animationDelay: beat ? `${i * 0.12}s` : undefined }}
        />
      ))}
    </span>
  );
}
