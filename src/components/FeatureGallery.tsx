import { useEffect, useRef, useState, type ReactNode } from "react";
import { Apple, BookOpen, Dumbbell, LineChart, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { usePlanAvailability } from "@/lib/planCatalog";
import { usePublicBooks } from "@/hooks/usePublicBooks";
import { ProgressRing } from "@/components/ui/progress-ring";
import BookCover from "@/components/BookCover";

type Card = { icon: LucideIcon; title: string; text: string; tag?: string; photo?: string; visual?: ReactNode };

// Fotos reales de ejercicios de la biblioteca de la app (las mismas que usa la demo).
const IMG = "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/";
const PHOTOS = {
  squat: `${IMG}14988835-a004-49d6-95c5-63978dbce978-1791475887313.png`,
  row: `${IMG}d5e30e05-0791-4886-84a0-7b2695728225-1791475865184.png`,
  press: `${IMG}a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png`,
};

/**
 * Galería horizontal fija: el scroll vertical la desplaza en horizontal. La distancia
 * sale del ancho real de la fila; solo se mide al cargar y al cambiar el tamaño.
 * Sin movimiento queda como fila deslizable normal.
 */
export default function FeatureGallery() {
  const plans = usePlanAvailability();
  const books = usePublicBooks();
  const pack = books?.find((b) => b.is_pack) ?? books?.[0];
  const hasPack = !!pack;
  // Pantalla de nutrición de la app, con los mismos datos de ejemplo que la demo.
  const nutrition = <div className="flex flex-col items-center">
    <ProgressRing value={67} size={150} stroke={12} className="text-current"><span className="text-center"><span className="block font-rounded text-[30px] font-bold leading-none tabular-nums">2.300</span><span className="type-caption1 opacity-70">kcal</span></span></ProgressRing>
    <p className="mt-4 type-subhead opacity-80">2 de 3 comidas</p>
  </div>;
  // La portada real del pack, la misma que en el escaparate de guías.
  const guide = pack ? <div className="w-[52%] -rotate-3 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]"><BookCover title={pack.title} src={pack.cover} /></div> : undefined;
  // Solo funciones que existen; las de pago dicen en qué plan están.
  const paid = plans.campaign ? undefined : plans.plus ? `En ${plans.plusName}` : null;
  const cards: Card[] = [
    { icon: SlidersHorizontal, title: "Entrenamiento personalizado.", text: "Según tu objetivo, nivel, días, lesiones y material.", photo: PHOTOS.squat },
    { icon: Dumbbell, title: "Cada serie, registrada.", text: "Peso y repeticiones de cada serie, con lo que hiciste la última vez.", photo: PHOTOS.row },
    ...(paid !== null ? [
      { icon: LineChart, title: "Progresión de cargas.", text: "La siguiente carga se calcula con tus registros.", tag: paid, photo: PHOTOS.press },
      { icon: Apple, title: "Nutrición guiada.", text: "Calorías y macros del día, ajustados a ti.", tag: paid, visual: nutrition },
    ] : []),
    { icon: BookOpen, title: "Guías en PDF.", text: "Fuerza, calistenia, nutrición y periodización. Pago único.", visual: guide },
  ];

  const [ref, p] = useScrollProgress<HTMLElement>(-1);
  const rowRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  useEffect(() => {
    const measure = () => { const row = rowRef.current; if (row) setDistance(Math.max(0, row.scrollWidth - window.innerWidth)); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [cards.length, hasPack]);
  const still = p < 0;
  // Alto = una pantalla + el recorrido horizontal, así 1 px de scroll ≈ 1 px de galería.
  const height = `calc(100vh + ${distance}px)`;
  const el = ref.current;
  const pinned = el && !still ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / Math.max(1, distance))) : 0;

  const row = <div ref={rowRef} className={`flex w-max gap-5 px-5 sm:px-8 md:gap-8 md:px-[8vw] ${still ? "" : "will-change-transform"}`} style={still ? undefined : { transform: `translate3d(${-pinned * distance}px,0,0)` }}>
    {cards.map(({ icon: I, title, text, tag, photo, visual }, i) => photo ? <article key={title} className="relative flex h-[min(30rem,64vh)] w-[min(80vw,26rem)] shrink-0 flex-col justify-end overflow-hidden rounded-[32px] bg-card p-7 md:p-10">
      {/* Foto a sangre con un degradado hacia abajo para que el texto se lea. */}
      <img src={photo} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_35%]" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="relative">
        {tag && <p className="type-footnote font-semibold text-white/70">{tag}</p>}
        <h3 className="mt-1 font-rounded text-[32px] font-bold leading-[1.05] tracking-tight text-white md:text-[44px]">{title}</h3>
        <p className="mt-3 type-body text-white/75">{text}</p>
      </div>
    </article> : <article key={title} className={`relative flex h-[min(30rem,64vh)] w-[min(80vw,26rem)] shrink-0 flex-col overflow-hidden rounded-[32px] p-7 md:p-10 ${i % 2 ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      {/* Sin foto, el icono es la imagen de la tarjeta, en proporción con la caja. */}
      <div className="flex min-h-0 flex-1 items-center justify-center" aria-hidden="true">
        {visual ?? <div className={`flex aspect-square w-[46%] items-center justify-center rounded-[28%] ${i % 2 ? "bg-primary-foreground/10" : "bg-primary/10"}`}>
          <I className={`h-1/2 w-1/2 ${i % 2 ? "" : "text-primary"}`} strokeWidth={1.5} />
        </div>}
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
