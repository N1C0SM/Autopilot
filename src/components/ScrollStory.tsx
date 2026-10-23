import { useScrollProgress } from "@/hooks/useScrollProgress";

const LINES = ["Tu rutina.", "Cada serie.", "Cada récord.", "En piloto automático."];
const WORDS = LINES.flatMap((line, l) => line.split(" ").map((w, i) => ({ w, last: l === LINES.length - 1, key: `${l}-${i}` })));

/** Texto gigante que se enciende palabra a palabra mientras la sección está fijada. */
export default function ScrollStory() {
  const [ref, p] = useScrollProgress<HTMLElement>(1);
  // La sección mide 130vh; el tramo útil es el del medio, cuando el texto está fijado.
  const lit = Math.min(1, Math.max(0, (p - 0.15) / 0.35)) * WORDS.length;
  return <section ref={ref} aria-label="En piloto automático" data-pinned className="relative h-[130vh]">
    <div className="sticky top-0 flex h-screen items-center justify-center px-5 sm:px-8">
      <p className="mx-auto max-w-5xl text-center font-rounded text-[44px] font-bold leading-[1.05] tracking-tight sm:text-[72px] md:text-[96px]">
        {WORDS.map(({ w, last, key }, i) => {
          const on = Math.min(1, Math.max(0, lit - i));
          return <span key={key} className={`inline-block transition-opacity duration-150 ${last ? "text-primary" : ""}`} style={{ opacity: 0.15 + on * 0.85 }}>{w}&nbsp;</span>;
        })}
      </p>
    </div>
  </section>;
}
