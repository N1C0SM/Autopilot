import { useScrollProgress } from "@/hooks/useScrollProgress";

// Solo cifras comprobables en el producto: 3 pasos del onboarding, plan Free real,
// y pago único de las guías (Payment Links de un solo cobro). Nada de usuarios ni resultados.
const FACTS = [
  { n: "3", unit: "pasos", text: "Objetivo, rutina y a entrenar. Así de simple empieza." },
  { n: "0", unit: "€", text: "Para empezar. El plan Free no pide tarjeta ni caduca." },
  { n: "1", unit: "pago", text: "Las guías en PDF se pagan una vez. Sin suscripción." },
];

/** Una cifra gigante por escena, mientras la sección está fijada. */
export default function BigNumbers() {
  const [ref, p, pin] = useScrollProgress<HTMLElement>(-1);
  const still = p < 0;
  const SCREENS = FACTS.length;
  const t = still ? 0 : pin * FACTS.length;
  const current = Math.min(FACTS.length - 1, Math.floor(t));

  if (still) return <section ref={ref} aria-label="En cifras" className="space-y-16 px-5 py-20 text-center">
    {FACTS.map((f) => <div key={f.unit}><p className="font-rounded text-[120px] font-bold leading-none tracking-tighter">{f.n}<span className="text-primary"> {f.unit}</span></p><p className="mx-auto mt-4 max-w-sm type-body text-muted-foreground">{f.text}</p></div>)}
  </section>;

  return <section ref={ref} aria-label="En cifras" data-pinned className="relative" style={{ height: `${SCREENS * 100}vh` }}>
    <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-5">
      {FACTS.map((f, i) => {
        const local = t - i;
        const o = i === current ? Math.min(1, local * 5 + (i === 0 ? 1 : 0), (1 - local) * 5 + (i === FACTS.length - 1 ? 1 : 0)) : 0;
        return <div key={f.unit} aria-hidden={i !== current} className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ opacity: o, transform: `scale(${0.92 + o * 0.08})` }}>
          <p className="font-rounded text-[clamp(120px,32vw,320px)] font-bold leading-none tracking-tighter tabular-nums">{f.n}<span className="text-[0.35em] text-primary"> {f.unit}</span></p>
          <p className="mx-auto mt-6 max-w-md type-body text-muted-foreground md:text-[21px] md:leading-[28px]">{f.text}</p>
        </div>;
      })}
    </div>
  </section>;
}
