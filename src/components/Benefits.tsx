import type { ReactNode } from "react";
import ScrollReveal from "@/components/ScrollReveal";
import { useScrollProgress } from "@/hooks/useScrollProgress";

type Benefit = { eyebrow: string; title: string; text: string; visual: ReactNode };

// Solo lo que la app hace en el plan Free: material y lesiones, la última vez a la vista, web y móvil.
const BENEFITS: Benefit[] = [
  {
    eyebrow: "Tu material, tu sitio",
    title: "Gimnasio, casa o barra en el parque.",
    text: "La rutina se construye con lo que tienes y evita lo que te molesta.",
    visual: <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
      {["Gimnasio", "Mancuernas", "Barra de dominadas", "Peso corporal"].map((m, i) => <div key={m} className={`flex aspect-[5/3] items-end rounded-[22px] p-4 sm:p-5 type-headline ${i === 0 ? "bg-primary text-primary-foreground" : "bg-card"}`}>{m}</div>)}
    </div>,
  },
  {
    eyebrow: "Memoria de cada sesión",
    title: "Lo que hiciste la última vez, delante.",
    text: "Antes de cada serie ves tu peso y tus repeticiones anteriores. Sin libretas.",
    visual: <div className="rounded-[28px] bg-card p-7">
      <p className="type-subhead text-muted-foreground">Remo con mancuerna</p>
      <p className="mt-2 font-rounded text-[56px] font-bold leading-none tracking-tight tabular-nums">22 kg <span className="text-muted-foreground">× 10</span></p>
      <p className="mt-3 type-subhead text-primary">Última vez · hace 4 días</p>
    </div>,
  },
  {
    eyebrow: "Contigo en todas partes",
    title: "En el móvil y en el ordenador.",
    text: "Tu rutina y tu historial se sincronizan. Empieza en uno, revisa en otro.",
    visual: <div className="flex items-end justify-center gap-4">
      <div className="h-48 w-72 rounded-[20px] bg-card p-4 ring-1 ring-white/5"><div className="h-2 w-16 rounded-full bg-primary/60" /><div className="mt-4 grid grid-cols-3 gap-2">{[60, 80, 45].map((h, i) => <div key={i} className="rounded-md bg-primary/25" style={{ height: h }} />)}</div></div>
      <div className="h-56 w-28 rounded-[24px] bg-card p-3 ring-1 ring-white/5"><div className="h-2 w-10 rounded-full bg-primary/60" /><div className="mt-4 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-6 rounded-md bg-primary/20" />)}</div></div>
    </div>,
  },
];

/** Beneficios en bloques editoriales a pantalla ancha; el visual se acerca suavemente con el scroll. */
function Row({ b, i }: { b: Benefit; i: number }) {
  const [ref, p] = useScrollProgress<HTMLDivElement>(0.5);
  const s = 0.92 + Math.min(1, p / 0.5) * 0.08;
  return <div ref={ref} className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-10 py-16 md:grid-cols-2 md:gap-20">
    <ScrollReveal className={i % 2 ? "md:order-2" : ""}>
      <p className="type-subhead font-semibold text-primary">{b.eyebrow}</p>
      <h3 className="mt-3 font-rounded text-[36px] font-bold leading-[1.05] tracking-tight sm:text-[52px]">{b.title}</h3>
      <p className="mt-4 max-w-md type-body text-muted-foreground md:text-[21px] md:leading-[29px]">{b.text}</p>
    </ScrollReveal>
    <div aria-hidden="true" className="will-change-transform" style={{ transform: `scale(${s})`, opacity: 0.4 + (s - 0.92) / 0.08 * 0.6 }}>{b.visual}</div>
  </div>;
}

export default function Benefits() {
  return <section aria-label="Ventajas de Autopilot" className="px-5 py-12 sm:px-8">
    {BENEFITS.map((b, i) => <Row key={b.title} b={b} i={i} />)}
  </section>;
}
