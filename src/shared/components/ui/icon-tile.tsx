import type { ComponentType } from "react";
import { cn } from "@/shared/lib/utils";

type IconType = ComponentType<{ className?: string; strokeWidth?: number | string }>;

const SIZES = {
  sm: { box: "h-8 w-8 rounded-[9px]", icon: "h-[18px] w-[18px]" },
  md: { box: "h-10 w-10 rounded-[11px]", icon: "h-[22px] w-[22px]" },
  lg: { box: "h-16 w-16 rounded-[18px]", icon: "h-8 w-8" },
} as const;

/**
 * Icono sobre un cuadrado redondeado con el color tenue (como los de Ajustes o Salud):
 * trazo grueso y fondo tintado en vez de un dibujo de línea fina suelto.
 */
export function IconTile({
  icon: Icon,
  size = "sm",
  tone = "primary",
  className,
}: {
  icon: IconType;
  size?: keyof typeof SIZES;
  tone?: "primary" | "success" | "destructive" | "muted";
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        s.box,
        tone === "primary" && "bg-primary/15 text-primary",
        tone === "success" && "bg-success/15 text-success",
        tone === "destructive" && "bg-destructive/15 text-destructive",
        tone === "muted" && "bg-foreground/10 text-muted-foreground",
        className,
      )}
    >
      <Icon className={s.icon} strokeWidth={2.25} />
    </span>
  );
}
