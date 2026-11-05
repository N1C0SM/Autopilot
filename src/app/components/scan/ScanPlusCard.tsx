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
    <section className="relative overflow-hidden rounded-[22px] border border-border bg-card p-5">
      <div className="relative">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 text-primary">
          <LockKeyhole className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[28px] font-bold leading-tight tracking-tight">Tu scan completo, con Plus</p>
        <p className="mt-1 type-subhead text-muted-foreground">Este es tu scan básico. Con Plus ves el análisis entero de tu físico:</p>
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2.5 type-subhead">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        {onUpgrade && !isIOSNative()
          ? <Button size="lg" className="mt-5 w-full" onClick={() => { void hapticTap(); onUpgrade(); }}>Ver mi scan completo con Plus</Button>
          : <p className="mt-5 type-footnote font-semibold text-primary">Incluido en Plus</p>}
      </div>
    </section>
  );
}
