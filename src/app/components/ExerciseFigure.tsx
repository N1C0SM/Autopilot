import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { FIGURE_VIEWBOX, figureProgress, poseAt, type FigureSpec } from "@/shared/lib/exerciseFigure";
import { cn } from "@/shared/lib/utils";

/**
 * La silueta haciendo la repetición en bucle, sobre negro. Con «reducir
 * movimiento» queda quieta en el punto de máxima tensión.
 */
export const ExerciseFigure = ({ spec, label, className }: { spec: FigureSpec; label: string; className?: string }) => {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) { setProgress(1); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setProgress(figureProgress((now - start) / 1000 / spec.duration, spec.hold));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, spec.duration, spec.hold]);

  const p = poseAt(spec, progress);
  const line = (a: [number, number], b: [number, number]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
  const arms = `${line(p.neck, p.elbow)}${line(p.elbow, p.hand)}`;
  const legs = `${line(p.hip, p.knee)}${line(p.knee, p.foot)}`;
  const torso = line(p.neck, p.hip);
  const work = spec.working;

  return (
    <svg viewBox={FIGURE_VIEWBOX} className={cn("h-full w-full", className)} role="img" aria-label={`Animación de ${label}`}>
      {spec.props.includes("floor") && <path d="M8 108H112" className="stroke-muted-foreground/30" strokeWidth="1.5" strokeLinecap="round" />}
      {spec.props.includes("pullbar") && <path d="M36 14H84" className="stroke-muted-foreground/60" strokeWidth="2.5" strokeLinecap="round" />}
      {spec.props.includes("bench") && <path d="M30 81H82M38 81V106M74 81V106" className="stroke-muted-foreground/40" strokeWidth="3" strokeLinecap="round" />}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6">
        <path d={legs} className={work === "legs" || work === "body" ? "stroke-primary" : "stroke-foreground/70"} />
        <path d={torso} className={work === "body" ? "stroke-primary" : "stroke-foreground/80"} strokeWidth="7" />
        <path d={arms} className={work === "arms" ? "stroke-primary" : "stroke-foreground/70"} />
      </g>
      <circle cx={p.head[0]} cy={p.head[1]} r="6.5" className="fill-foreground/85" />
      {spec.props.includes("barbell") && (
        <g>
          <circle cx={p.hand[0]} cy={p.hand[1]} r="7" className="fill-none stroke-muted-foreground/70" strokeWidth="2.5" />
          <circle cx={p.hand[0]} cy={p.hand[1]} r="2" className="fill-muted-foreground/70" />
        </g>
      )}
    </svg>
  );
};

export default ExerciseFigure;
