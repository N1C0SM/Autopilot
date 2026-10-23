import { useScrollProgress } from "@/hooks/useScrollProgress";

/**
 * Texto que se enciende palabra a palabra al entrar en pantalla, ligado al scroll.
 * Termina de encenderse cuando el texto llega a la mitad superior del viewport.
 */
export default function ScrollWords({ text, accent }: { text: string; accent?: string }) {
  const [ref, p] = useScrollProgress<HTMLSpanElement>(1);
  const words = [...text.split(" ").map((w) => ({ w, a: false })), ...(accent ? accent.split(" ").map((w) => ({ w, a: true })) : [])];
  // p≈0 al asomar por abajo; ≈0.35 cuando ya está a media pantalla.
  const lit = Math.min(1, Math.max(0, (p - 0.05) / 0.3)) * words.length;
  return <span ref={ref}>
    {words.map(({ w, a }, i) => <span key={i} className={`transition-opacity duration-150 ${a ? "text-primary" : ""}`} style={{ opacity: 0.15 + Math.min(1, Math.max(0, lit - i)) * 0.85 }}>{w}{i < words.length - 1 ? " " : ""}</span>)}
  </span>;
}
