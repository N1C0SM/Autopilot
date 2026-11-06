import { LockKeyhole } from "lucide-react";
import { PlusBadge } from "@/shared/components/ui/plus-badge";
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
    // Maqueta de ChatGPT: «Análisis completo (Plus)» con cada sección bloqueada en su tarjeta.
    <section aria-labelledby="scan-plus-title">
      <h3 id="scan-plus-title" className="type-title2">Análisis completo (Plus)</h3>
      <p className="mt-0.5 type-subhead text-muted-foreground">Este es tu scan básico. Desbloquea el análisis avanzado de tu físico con recomendaciones personalizadas:</p>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex min-h-14 items-center gap-3 rounded-[22px] border border-border bg-card px-4 py-3">
            <LockKeyhole className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
            <span className="min-w-0 flex-1 type-subhead font-medium">{item}</span>
            <PlusBadge />
          </li>
        ))}
      </ul>
      {onUpgrade && !isIOSNative()
        ? <Button size="lg" className="mt-4 w-full" onClick={() => { void hapticTap(); onUpgrade(); }}>Ver mi scan completo con Plus</Button>
        : <p className="mt-4 type-footnote font-semibold text-primary">Incluido en Plus</p>}
    </section>
  );
}
