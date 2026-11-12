import { LockKeyhole } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/**
 * Insignia «Plus» con candado: marca una función bloqueada del plan gratis.
 * Píldora dorada tenue, texto de 11 px y candado de 12 px (igual que `PlusBadge` en nativo).
 */
export function PlusBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-[11px] font-semibold leading-none text-primary",
        className,
      )}
    >
      <LockKeyhole className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
      Plus
    </span>
  );
}

/**
 * Insignia del plan en Ajustes → Mi plan (igual que `PlanBadge` en nativo): dorada si es de pago,
 * gris si es gratis.
 */
export function PlanBadge({ name, paid, className }: { name: string; paid: boolean; className?: string }) {
  return (
    <span
      aria-label={`Plan ${name}`}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none",
        paid ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
        className,
      )}
    >
      {name}
    </span>
  );
}
