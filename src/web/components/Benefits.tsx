import type { ReactNode } from "react";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";
import ScrollReveal from "@/web/components/ScrollReveal";
import { useScrollProgress } from "@/shared/hooks/useScrollProgress";

const MATERIAL = [
  { label: "Gimnasio", photo: BRAND_PHOTOS.gym },
  { label: "Mancuernas", photo: BRAND_PHOTOS.dumbbells },
  { label: "En casa", photo: BRAND_PHOTOS.home },
  { label: "Barra de dominadas", photo: BRAND_PHOTOS.pullupBar },
];

type Benefit = { eyebrow: string; title: string; text: string; visual: ReactNode };

// Solo lo que la app hace en el plan Free: material y lesiones, y la última vez a la vista.
// Web y móvil tiene su propia sección (DeviceShowcase).
const BENEFITS: Benefit[] = [
  {
    eyebrow: "Tu material, tu sitio",
    title: "Gimnasio, casa o barra en el parque.",
    text: "La rutina se construye con lo que tienes y evita lo que te molesta.",
    visual: <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
      {MATERIAL.map(({ label, photo }) => <div key={label} className="relative flex aspect-[5/4] items-end overflow-hidden rounded-[22px] bg-card p-4 sm:p-5">
        {photo && <><img src={photo} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_35%]" /><span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" /></>}
        <span className="relative type-headline text-white">{label}</span>
      </div>)}
    </div>,
  },
  {
    eyebrow: "Memoria de cada sesión",
    title: "Lo que hiciste la última vez, delante.",
    text: "Antes de cada serie ves tu peso y tus repeticiones anteriores. Sin libretas.",
    visual: <div className="rounded-[28px] bg-card p-7">
      <p className="type-subhead text-muted-foreground">Remo con mancuerna</p>
      <p className="mt-2 type-figure text-[56px] font-bold leading-none tracking-tight tabular-nums">22 kg <span className="text-muted-foreground">× 10</span></p>
      <p className="mt-3 type-subhead text-primary">Última vez · hace 4 días</p>
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
