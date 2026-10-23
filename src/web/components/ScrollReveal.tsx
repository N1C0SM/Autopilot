import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  /** Retraso en ms para escalonar elementos vecinos. */
  delay?: number;
  direction?: "up" | "left" | "right";
}

const offset = { up: "translate-y-8", left: "-translate-x-8", right: "translate-x-8" };

/**
 * Aparece al entrar en pantalla. Con «reducir movimiento» o sin
 * IntersectionObserver (prerender, tests) se muestra tal cual.
 */
const ScrollReveal = ({ children, className = "", delay = 0, direction = "up" }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setState("hidden");
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setState("shown"); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const motion = state === "static" ? "" : `transition-all duration-700 ease-out ${state === "hidden" ? `opacity-0 ${offset[direction]}` : "opacity-100 translate-x-0 translate-y-0"}`;
  return <div ref={ref} className={`${motion} ${className}`} style={state === "static" ? undefined : { transitionDelay: `${delay}ms` }}>{children}</div>;
};

export default ScrollReveal;
