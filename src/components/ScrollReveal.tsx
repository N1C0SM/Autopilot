import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  /** Kept for existing call sites; content no longer animates in. */
  delay?: number;
  /** Kept for existing call sites; content no longer animates in. */
  direction?: "up" | "left" | "right";
}

/**
 * Content appears as it is: the native language has no entrance animations.
 * The wrapper stays so existing call sites keep their markup.
 */
const ScrollReveal = ({ children, className = "" }: Props) => <div className={className}>{children}</div>;

export default ScrollReveal;
