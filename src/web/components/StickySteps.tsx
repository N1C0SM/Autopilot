import type { LucideIcon } from "lucide-react";
import { useScrollProgress } from "@/shared/hooks/useScrollProgress";

export type Step = { icon: LucideIcon; title: string; text: string; visual?: React.ReactNode };

/**
 * Un paso por pantalla mientras la sección está fijada: el scroll cambia de paso.
 * Sin movimiento (reducir movimiento, prerender) se muestran todos en lista.
 */
export default function StickySteps({ eyebrow, steps }: { eyebrow: string; steps: Step[] }) {
  const [ref, p, pin] = useScrollProgress<HTMLElement>(-1);
  const still = p < 0;
  // Una pantalla de scroll por paso, contada solo mientras está fijada.
  const t = Math.min(0.999, pin) * steps.length;
  const current = Math.floor(t);
  if (still) return <section ref={ref} aria-label={eyebrow} className="px-5 py-20 sm:px-8">
    <ol className="mx-auto grid max-w-3xl gap-12 text-center">
      {steps.map(({ icon: I, title, text, visual }, i) => <li key={title}><span className="block type-figure text-[96px] font-bold leading-none tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</span><I className="mx-auto mt-2 h-8 w-8 text-muted-foreground" aria-hidden="true" /><h3 className="mt-4 font-rounded text-[40px] font-bold leading-tight">{title}</h3><p className="mx-auto mt-2 max-w-md type-body text-muted-foreground">{text}</p>{visual && <div className="mx-auto mt-6 max-w-xs">{visual}</div>}</li>)}
    </ol>
  </section>;
  return <section ref={ref} aria-label={eyebrow} style={{ height: `${Math.max(1.5, steps.length - 1.5) * 100}vh` }} data-pinned className="relative">
    <ol className="sr-only">{steps.map((s, i) => <li key={s.title}><h3>{i + 1}. {s.title}</h3><p>{s.text}</p></li>)}</ol>
    <div aria-hidden="true" className="sticky top-0 flex h-screen flex-col items-center justify-center px-5 text-center sm:px-8">
      <p className="type-subhead text-primary">{eyebrow}</p>
      <div className="relative mt-4 h-[460px] w-full max-w-5xl sm:h-[620px] md:h-[460px]">
        {steps.map(({ icon: I, title, text, visual }, i) => {
          const local = t - i; // 0..1 mientras este paso está activo
          const on = i === current;
          const opacity = on ? Math.min(1, local * 7 + (i === 0 ? 1 : 0),(1 - local) * 7 + (i === steps.length - 1 ? 1 : 0)) : 0;
          return <div key={title} aria-hidden={!on} className="absolute inset-0 grid items-center gap-6 md:grid-cols-2 md:gap-14 md:text-left" style={{ opacity, transform: `translateY(${(1 - opacity) * 20}px)` }}>
            <div className="flex flex-col items-center md:items-start">
              <span className="type-figure text-[clamp(80px,min(18vw,18vh),180px)] font-bold leading-none tracking-tighter tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 font-rounded text-[44px] font-bold leading-[1.05] tracking-tight sm:text-[64px]">{title}</h3>
              <p className="mt-3 max-w-sm type-body text-muted-foreground md:text-[21px] md:leading-[28px]">{text}</p>
            </div>
            {visual ? <div className="mx-auto hidden w-full max-w-sm sm:block" style={{ transform: `scale(${0.94 + opacity * 0.06})` }}>{visual}</div> : <I className="mx-auto h-16 w-16 text-muted-foreground" aria-hidden="true" />}
          </div>;
        })}
      </div>
      <div className="mt-8 flex gap-2" aria-hidden="true">
        {steps.map((s, i) => <span key={s.title} className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />)}
      </div>
    </div>
  </section>;
}
