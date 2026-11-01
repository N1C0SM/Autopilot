import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import BookCover from "@/web/components/BookCover";
import ScrollWords from "@/web/components/ScrollWords";
import { usePublicBooks, type PublicBook } from "@/shared/hooks/usePublicBooks";
import { useScrollProgress } from "@/shared/hooks/useScrollProgress";
import { track } from "@/shared/lib/analytics";
import { hapticTap } from "@/shared/lib/native";

type ShowBook = PublicBook;

/**
 * Escaparate de las guías reales en la portada. Solo muestra y enlaza a
 * /recursos?guia=<id>, que abre la ficha y el pago de siempre: la compra no pasa por aquí.
 */
export default function BookShowcase() {
  const books = usePublicBooks();
  const [ref, p, pin] = useScrollProgress<HTMLElement>(-1);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(min-width: 768px)");
    if (!mq) return;
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  if (books && books.length === 0) return null;
  const open = (b: ShowBook) => { void hapticTap(); track("cta_click", { cta: "guide_cover", source: "home", book: b.title }); };
  const still = p < 0;
  // Abanico solo en escritorio con movimiento: en móvil, fila deslizable.
  const fan = wide && !still && !!books && books.length > 1;
  const SCREENS = 3;
  const t = fan ? pin : 1;

  const isPack = (b: ShowBook) => Boolean(b.is_pack || /pack/i.test(b.title));

  const info = (b: ShowBook) => {
    const pack = isPack(b);
    // Título con dos líneas reservadas, precio y una acción con forma de botón: así las
    // tarjetas de la fila alinean precio y CTA aunque el título ocupe una línea o dos.
    return <div className="mt-4 flex flex-1 flex-col">
      {/* Sin distintivo «Pack» aquí: la portada y el título ya lo dicen, y el hueco
          hacía que el propio título se cortara en dos líneas. */}
      <div className="flex min-h-[3.1rem] items-start">
        <h3 className="line-clamp-2 type-headline">{b.title}</h3>
      </div>
      <p className="mt-1 type-subhead text-muted-foreground"><span className="font-semibold text-foreground">{b.price || "Gratis"}</span>{pack ? " · Todas las guías" : b.pages ? ` · ${b.pages} págs.` : ""}</p>
      <span className="mt-auto inline-flex h-9 w-fit items-center rounded-full bg-primary/15 px-4 pt-0 type-footnote font-semibold text-primary transition-colors group-hover:bg-primary/20">{pack ? "Ver pack" : "Ver guía"}</span>
    </div>;
  };
  // La portada del pack ya viene rotulada: no se repite el distintivo encima.
  const cover = (b: ShowBook) => (
    <div className="transition-transform duration-500 ease-out group-hover:-translate-y-2 group-active:scale-[0.97]">
      <div className="relative shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
        <BookCover title={b.title} src={b.cover} />
      </div>
    </div>
  );

  const header = <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
    <p className="type-subhead text-primary">Guías en PDF</p>
    <h2 id="guias-titulo" className="mt-2 type-display"><ScrollWords text="El método, en tus manos." /></h2>
    <p className="mx-auto mt-5 max-w-xl type-body text-muted-foreground md:text-[21px] md:leading-[28px]">Fuerza, calistenia, nutrición y periodización. Pago único, sin suscripción.</p>
  </div>;
  const footer = <div className="mt-8 text-center">
    <Button variant="hero" size="lg" asChild className="sm:px-10"><Link to="/recursos" onClick={() => { void hapticTap(); track("cta_click", { cta: "guides", source: "home" }); }}>Ver todas las guías</Link></Button>
    <p className="mt-3 type-footnote text-muted-foreground">Pago seguro con Stripe</p>
  </div>;

  if (fan && books) {
    // El pack va en el centro del abanico: es el que queda delante de la pila.
    const pack = books.find((bk) => bk.is_pack);
    const rest = books.filter((bk) => bk !== pack);
    const ordered = pack ? [...rest.slice(0, Math.floor(rest.length / 2)), pack, ...rest.slice(Math.floor(rest.length / 2))] : books;
    const n = ordered.length;
    // 0→0.5: de pila a abanico · 0.5→0.85: de abanico a fila · >0.85: aparecen títulos y precios.
    const a = Math.min(1, t / 0.4), b = Math.min(1, Math.max(0, (t - 0.4) / 0.32));
    const infoO = Math.min(1, Math.max(0, (t - 0.75) / 0.12));
    const W = 190, GAP = 28;
    return <section ref={ref} aria-labelledby="guias-titulo" data-pinned className="relative" style={{ height: `${SCREENS * 100}vh` }}>
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        {header}
        <div className="relative mx-auto mt-10 h-[380px] w-full" style={{ perspective: "1600px" }}>
          {ordered.map((bk, i) => {
            const c = i - (n - 1) / 2;
            const stackX = c * 6, fanX = c * 70, rowX = c * (W + GAP);
            const x = stackX + (fanX - stackX) * a + (rowX - fanX) * b;
            const rot = c * 9 * a * (1 - b);
            const y = Math.abs(c) * 14 * a * (1 - b) - (1 - a) * c * 4;
            return <Link key={bk.id} to={`/recursos?guia=${encodeURIComponent(bk.id)}`} onClick={() => open(bk)}
              className="group absolute left-1/2 top-0 text-left" style={{ width: W, marginLeft: -W / 2, transform: `translate3d(${x}px,${y}px,0) rotate(${rot}deg)`, zIndex: n - Math.round(Math.abs(c)) }}>
              {cover(bk)}
              <div style={{ opacity: infoO }}>{info(bk)}</div>
            </Link>;
          })}
        </div>
        <div style={{ opacity: infoO }}>{footer}</div>
      </div>
    </section>;
  }

  return <section ref={ref} id="guias" aria-labelledby="guias-titulo" className="overflow-hidden py-24 sm:py-32">
    {header}
    <div className="mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-6 [scrollbar-width:none] sm:justify-center sm:px-8 [&::-webkit-scrollbar]:hidden">
      {(books ?? Array.from({ length: 4 }, () => null)).map((b, i) => b
        ? <Link key={b.id} to={`/recursos?guia=${encodeURIComponent(b.id)}`} onClick={() => open(b)} className="group flex w-[200px] shrink-0 snap-center flex-col text-left sm:w-[220px]">{cover(b)}{info(b)}</Link>
        : <div key={i} aria-hidden="true" className="w-[200px] shrink-0 sm:w-[220px]"><div className="aspect-[3/4] animate-pulse rounded-media bg-card" /></div>)}
    </div>
    {footer}
  </section>;
}
