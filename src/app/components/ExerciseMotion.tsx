import type { MotionSpec } from "@/shared/lib/exerciseMotion";
import { cn } from "@/shared/lib/utils";

/**
 * La huella de movimiento dibujada se retiró a petición del producto: los ejercicios
 * solo se enseñan con su foto o su animación real. Estos componentes se conservan para
 * no romper las llamadas (y la paridad con `ExerciseMotion.swift`), pero solo dejan un
 * hueco neutro sin dibujo.
 */
export const ExerciseMotion = ({ className }: { spec: MotionSpec; className?: string }) => (
  <div aria-hidden="true" className={cn("h-full w-full", className)} />
);

export const ExerciseMotionGlyph = ({ className }: { spec: MotionSpec; className?: string }) => (
  <div aria-hidden="true" className={cn("h-full w-full", className)} />
);

export const ExerciseMotionBadge = (_props: { spec: MotionSpec; className?: string }) => null;
