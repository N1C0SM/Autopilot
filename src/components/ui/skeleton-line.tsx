import * as React from "react";
import { cn } from "@/lib/utils";

export type SkeletonLineProps = React.HTMLAttributes<HTMLDivElement>;

/** Único gris de carga de la app. */
const SkeletonLine = ({ className, ...props }: SkeletonLineProps) => (
  <div className={cn("h-4 animate-pulse rounded-lg bg-secondary/40", className)} {...props} />
);

/** Fila de lista en carga: misma altura (56px) que una fila real. */
const SkeletonRow = ({ className }: { className?: string }) => (
  <div className={cn("flex h-14 items-center gap-3 px-3", className)} aria-hidden>
    <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-secondary/40" />
    <div className="min-w-0 flex-1 space-y-2">
      <SkeletonLine className="h-3.5 w-1/3" />
      <SkeletonLine className="h-3 w-1/2" />
    </div>
    <SkeletonLine className="h-5 w-16 rounded-full" />
  </div>
);

export { SkeletonLine, SkeletonRow };
