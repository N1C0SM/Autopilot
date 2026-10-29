import { Check, LockKeyhole } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { hapticTap } from "@/shared/lib/native";
import { isIOSNative } from "@/shared/lib/platform";

/**
 * Scan básico (Free y visitantes): lo que se desbloquea con Plus, en una sola tarjeta.
 * La lista llega del servidor (`locked_sections`), que es quien recorta el análisis.
 */
export default function ScanPlusCard({ sections, onUpgrade }: { sections?: string[]; onUpgrade?: () => void }) {
  const items = sections?.length ? sections : ["Composición corporal", "Puntuación por músculo", "Postura y proporciones", "Protocolo personalizado", "Tu yo futuro"];
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-card p-5">
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.18),transparent)]" />
      <div className="relative">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <LockKeyhole className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </span>
        <p className="mt-4 font-rounded text-[28px] font-bold leading-tight tracking-tight">Tu scan avanzado, con Plus</p>
        <p className="mt-1 type-subhead text-muted-foreground">Este es tu scan básico. Con Plus ves el análisis entero de tu físico:</p>
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2.5 type-subhead">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        {onUpgrade && !isIOSNative()
          ? <Button size="lg" className="mt-5 w-full" onClick={() => { void hapticTap(); onUpgrade(); }}>Ver mi scan avanzado con Plus</Button>
          : <p className="mt-5 type-footnote font-semibold text-primary">Incluido en Plus</p>}
      </div>
    </section>
  );
}
