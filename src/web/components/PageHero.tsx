import type { ReactNode } from "react";
import ScrollWords from "@/web/components/ScrollWords";

/** Cabecera común de las páginas públicas: antetítulo, titular de display y entradilla, centrados. */
export default function PageHero({ eyebrow, title, accent, children }: { eyebrow?: string; title: string; accent?: string; children?: ReactNode }) {
  return <header className="relative mx-auto max-w-4xl px-5 pb-12 pt-16 text-center animate-in fade-in duration-700 motion-reduce:animate-none sm:px-8 sm:pb-20 sm:pt-28">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-80 max-w-2xl rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.12),transparent)]" />
    {eyebrow && <p className="relative type-subhead font-semibold text-primary">{eyebrow}</p>}
    <h1 className="relative mt-3 type-display"><ScrollWords text={title} accent={accent} /></h1>
    {children && <div className="relative mx-auto mt-5 max-w-2xl type-body text-muted-foreground md:text-[21px] md:leading-[28px]">{children}</div>}
  </header>;
}
