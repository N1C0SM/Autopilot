import { LockKeyhole } from "lucide-react";
import { PlusBadge } from "@/shared/components/ui/plus-badge";
import { Button } from "@/shared/components/ui/button";
import { hapticTap } from "@/shared/lib/native";
import { isIOSNative } from "@/shared/lib/platform";

/** Lo que recorta el scan básico si el servidor no lo dice (`locked_sections`). */
const SCAN_PLUS_FALLBACK = ["Composición corporal", "Puntuación por músculo", "Postura y proporciones", "Protocolo personalizado", "Tu yo futuro"];

/**
 * Scan básico (Free y visitantes): lo que se desbloquea con Plus, en un solo grupo sin borde con
 * una fila por sección y la insignia Plus (como `plusCard` en ScanView.swift). La lista llega del
 * servidor (`locked_sections`), que es quien recorta el análisis. En iOS no se vende nada.
 */
export default function ScanPlusCard({ sections, onUpgrade }: { sections?: string[] | null; onUpgrade?: () => void }) {
  const items = sections?.length ? sections : SCAN_PLUS_FALLBACK;
  return (
    <section aria-labelledby="scan-plus-title" className="flex flex-col gap-2.5">
      <header>
        <h3 id="scan-plus-title" className="type-title3">Análisis completo (Plus)</h3>
        <p className="mt-0.5 type-subhead text-muted-foreground">Este es tu scan básico. Desbloquea el análisis avanzado de tu físico con recomendaciones personalizadas:</p>
      </header>
      <ul className="overflow-hidden rounded-card bg-card">
        {items.map((item, i) => (
          <li key={item} className={`flex min-h-14 items-center gap-3 px-4 py-3 ${i > 0 ? "sep-t" : ""}`}>
            <LockKeyhole className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
            <span className="min-w-0 flex-1 type-subhead font-medium">{item}</span>
            <PlusBadge />
          </li>
        ))}
      </ul>
      {onUpgrade && !isIOSNative()
        ? <Button size="lg" variant="tinted" className="mt-1.5 w-full" onClick={() => { void hapticTap(); onUpgrade(); }}>Ver mi scan completo con Plus</Button>
        : <p className="type-footnote font-semibold text-primary">Incluido en Plus</p>}
    </section>
  );
}
