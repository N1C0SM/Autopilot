import { useReducedMotion } from "framer-motion";
import { MOTION_FLOOR, MOTION_VIEWBOX, motionKeyTimes, type MotionSpec } from "@/shared/lib/exerciseMotion";
import { cn } from "@/shared/lib/utils";

/**
 * Huella de movimiento: la repetición del ejercicio dibujada con sus datos
 * (patrón, estímulo y carga). Un solo gesto ámbar sobre negro, sin foto y sin
 * IA. El punto sube rápido, baja despacio y descansa, como una serie de verdad.
 *
 * Con «reducir movimiento» se ve el mismo dibujo quieto, con el punto en la
 * posición de mayor tensión.
 */
export const ExerciseMotion = ({ spec, className }: { spec: MotionSpec; className?: string }) => {
  const reduced = useReducedMotion();
  const { keyPoints, keyTimes } = motionKeyTimes(spec);

  return (
    <svg
      viewBox={MOTION_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className={cn("h-full w-full text-primary", className)}
      role="img"
      aria-label={`Ritmo de ${spec.label}`}
    >
      {/* El suelo: da referencia de espacio sin dibujar un gimnasio. */}
      <line x1="4" y1={MOTION_FLOOR} x2="96" y2={MOTION_FLOOR} stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.8" strokeLinecap="round" />
      {/* La trayectoria que recorre cada repetición. */}
      <path d={spec.d} fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth={spec.stroke} strokeLinecap="round" />
      {/* Reposo (inicio) y tensión máxima (final): los dos extremos del gesto. */}
      <circle cx={spec.start.x} cy={spec.start.y} r="1.3" fill="currentColor" fillOpacity="0.35" />
      <circle cx={spec.end.x} cy={spec.end.y} r="2.6" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.9" />
      {/* El punto que entrena: halo suave + núcleo. */}
      <g transform={reduced ? `translate(${spec.end.x} ${spec.end.y})` : undefined}>
        <circle r="9" fill="currentColor" fillOpacity="0.09" />
        <circle r="3.2" fill="currentColor" />
        {!reduced && (
          <animateMotion
            dur={`${spec.duration}s`}
            repeatCount="indefinite"
            path={spec.d}
            calcMode="linear"
            keyPoints={keyPoints}
            keyTimes={keyTimes}
          />
        )}
      </g>
    </svg>
  );
};

/**
 * La misma huella en miniatura: sin animación ni texto, para las filas de las
 * listas. Se lee en 48 px y no baja una sola foto.
 */
export const ExerciseMotionGlyph = ({ spec, className }: { spec: MotionSpec; className?: string }) => (
  <svg viewBox={MOTION_VIEWBOX} preserveAspectRatio="xMidYMid meet" aria-hidden className={cn("h-full w-full text-primary", className)}>
    <path d={spec.d} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth={spec.stroke + 0.8} strokeLinecap="round" />
    <circle cx={spec.start.x} cy={spec.start.y} r="1.6" fill="currentColor" fillOpacity="0.4" />
    <circle cx={spec.end.x} cy={spec.end.y} r="3.6" fill="currentColor" />
  </svg>
);
