import { useEffect, useRef, useState } from "react";
import { Apple, BookOpen, Dumbbell, LineChart, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { usePlanAvailability } from "@/lib/planCatalog";

type Card = { icon: LucideIcon; title: string; text: string; tag?: string };

/**
 * Galería horizontal fija: el scroll vertical la desplaza en horizontal. La distancia
 * sale del ancho real de la fila; solo se mide al cargar y al cambiar el tamaño.
 * Sin movimiento queda como fila deslizable normal.
 */
export default function FeatureGallery() {
  const plans = usePlanAvailability();
  // Solo funciones que existen; las de pago dicen en qué plan están.
  const paid = plans.campaign ? undefined : plans.plus ? `En ${plans.plusName}` : null;
  const cards: Card[] = [
    { icon: SlidersHorizontal, title: "Entrenamiento personalizado.", text: "Según tu objetivo, nivel, días, lesiones y material." },
    ...(paid !== null ? [
      { icon: LineChart, title: "Progresión de cargas.", text: "La siguiente carga se calcula con tus registros.", tag: paid },
      { icon: Apple, title: "Nutrición guiada.", text: "Calorías y macros del día, ajustados a ti.", tag: paid },
    ] : []),
    { icon: BookOpen, title: "Guías en PDF.", text: "Fuerza, calistenia, nutrición y periodización. Pago único." },
  ];

  const [ref, p] = useScrollProgress<HTMLElement>(-1);
  const rowRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  useEffect(() => {
    const measure = () => { const row = rowRef.current; if (row) setDistance(Math.max(0, row.scrollWidth - window.innerWidth)); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [cards.length]);
  const still = p < 0;
  // Alto = una pantalla + el recorrido horizontal, así 1 px de scroll ≈ 1 px de galería.
  const height = `calc(100vh + ${distance}px)`;
  const el = ref.current;
  const pinned = el && !still ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / Math.max(1, distance))) : 0;

  const row = <div ref={rowRef} className={`flex w-max gap-5 px-5 sm:px-8 md:gap-8 md:px-[8vw] ${still ? "" : "will-change-transform"}`} style={still ? undefined : { transform: `translate3d(${-pinned * distance}px,0,0)` }}>
    {cards.map(({ icon: I, title, text, tag }, i) => <article key={title} className={`relative flex h-[min(30rem,64vh)] w-[min(80vw,26rem)] shrink-0 flex-col overflow-hidden rounded-[32px] p-7 md:p-10 ${i % 2 ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      {/* El icono es la imagen de la tarjeta: ocupa la mitad superior, en proporción con la caja. */}
      <div className="flex flex-1 items-center justify-center" aria-hidden="true">
        <div className={`flex aspect-square w-[46%] items-center justify-center rounded-[28%] ${i % 2 ? "bg-primary-foreground/10" : "bg-primary/10"}`}>
          <I className={`h-1/2 w-1/2 ${i % 2 ? "" : "text-primary"}`} strokeWidth={1.5} />
        </div>
      </div>
      <div>
        {tag && <p className={`type-footnote font-semibold ${i % 2 ? "opacity-70" : "text-muted-foreground"}`}>{tag}</p>}
        <h3 className="mt-1 font-rounded text-[32px] font-bold leading-[1.05] tracking-tight md:text-[44px]">{title}</h3>
        <p className={`mt-3 type-body ${i % 2 ? "opacity-80" : "text-muted-foreground"}`}>{text}</p>
      </div>
    </article>)}
  </div>;

  const heading = <div className="mx-auto max-w-4xl px-5 pb-10 text-center sm:px-8"><p className="type-subhead text-primary">Descubre Autopilot</p><h2 className="mt-2 type-display-sm">Todo en un sitio.</h2></div>;

  if (still) return <section ref={ref} aria-label="Descubre Autopilot" className="py-20">{heading}<div className="overflow-x-auto pb-4">{row}</div></section>;
  return <section ref={ref} aria-label="Descubre Autopilot" data-pinned className="relative" style={{ height }}>
    <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">{heading}{row}</div>
  </section>;
}
