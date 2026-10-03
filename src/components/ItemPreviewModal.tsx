import { Check, ArrowRight, ShoppingBag } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { track, type EventName } from "@/lib/analytics";

/**
 * Ficha de vista previa genérica para cualquier sección de la landing (recomendaciones y futuras).
 * Las líneas de la descripción que empiezan por «- » salen como lista de puntos.
 */
export interface PreviewItem {
  id?: string;
  title: string;
  description: string;
  image_url?: string;
  url?: string;
  badge?: string;
  price?: string;
}

export interface PreviewVariant {
  label: string;        // p. ej. «Recomendación»
  bulletsTitle: string; // p. ej. «Por qué lo recomiendo»
  cta: string;          // p. ej. «Ver producto»
  note?: string;        // texto pequeño bajo el botón
  event: EventName;     // evento de analítica al pulsar el botón
}

export const RECOMMENDATION_VARIANT: PreviewVariant = {
  label: "Recomendación",
  bulletsTitle: "Por qué lo recomiendo",
  cta: "Ver producto",
  note: "Te lleva a la tienda del producto. Puede ser un enlace de afiliado.",
  event: "reco_buy_click",
};

export function previewIntro(text: string) {
  return (text || "").split(/\n+/).map((l) => l.trim()).filter((l) => l && !/^[-•*·]\s*/.test(l)).join(" ");
}

export default function ItemPreviewModal({ item, variant, onClose }: { item: PreviewItem | null; variant: PreviewVariant; onClose: () => void }) {
  if (!item) return null;
  const lines = (item.description || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[-•*·]\s*/.test(l)).map((l) => l.replace(/^[-•*·]\s*/, ""));
  const intro = previewIntro(item.description);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="grid gap-0 sm:grid-cols-[0.8fr_1.2fr]">
          <div className="bg-secondary p-6 flex items-center justify-center">
            {item.image_url ? (
              <img src={item.image_url} alt={item.title} className="w-full max-w-[240px] aspect-square rounded-xl object-cover" />
            ) : (
              <ShoppingBag className="w-16 h-16 text-primary/50" />
            )}
          </div>
          <div className="p-6 flex flex-col">
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-2">{item.badge || variant.label}</p>
            <DialogTitle className="font-display text-2xl font-bold leading-tight">{item.title}</DialogTitle>
            {intro && <DialogDescription className="mt-3 text-sm leading-relaxed text-muted-foreground">{intro}</DialogDescription>}
            {bullets.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold mb-2">{variant.bulletsTitle}</p>
                <ul className="space-y-2">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 pt-5 border-t border-border">
              <div className="flex items-center justify-between gap-3">
                {item.price ? <span className="font-display text-2xl font-bold">{item.price}</span> : <span />}
                {item.url ? (
                  <Button asChild variant="hero" size="lg">
                    <a href={item.url} target="_blank" rel="noreferrer sponsored" onClick={() => track(variant.event, { item: item.title })}>
                      {variant.cta} <ArrowRight className="w-4 h-4" />
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Disponible próximamente</span>
                )}
              </div>
              {variant.note && <p className="mt-2 text-[11px] text-muted-foreground">{variant.note}</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
