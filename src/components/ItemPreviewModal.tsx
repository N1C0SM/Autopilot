import { Check, ShoppingBag } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { hapticTap } from "@/lib/native";
import { track, type EventName } from "@/lib/analytics";
import { ImageWithFallback } from "@/components/chrome-chat/ImageWithFallback";
import { skipAutoFocusOnTouch } from "@/components/chrome-chat/skipAutoFocusOnTouch";

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
      <DialogContent className="max-w-md" onOpenAutoFocus={skipAutoFocusOnTouch}>
        <div className="flex flex-col items-center text-center">
          <ImageWithFallback
            src={item.image_url}
            alt={item.title}
            className="h-28 w-28 rounded-[22%] object-cover"
            fallbackIcon={ShoppingBag}
            fallbackIconClassName="h-10 w-10"
          />
          <p className="mt-5 type-subhead text-primary">{item.badge || variant.label}</p>
          <DialogTitle className="mt-1 type-title1">{item.title}</DialogTitle>
          {intro && <DialogDescription className="mt-2 type-subhead text-muted-foreground">{intro}</DialogDescription>}
        </div>

        {bullets.length > 0 && (
          <div>
            <p className="type-headline mb-3">{variant.bulletsTitle}</p>
            <ul className="space-y-3">
              {bullets.map((b, i) => (
                <li key={i} className="flex gap-3 type-subhead">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          {item.price && <p className="text-center type-large-title font-rounded tabular-nums">{item.price}</p>}
          {item.url ? (
            <Button asChild variant="hero" size="lg" className="w-full">
              <a href={item.url} target="_blank" rel="noreferrer sponsored" onClick={() => { void hapticTap(); track(variant.event, { item: item.title }); }}>
                {variant.cta}
              </a>
            </Button>
          ) : (
            <p className="text-center type-subhead text-muted-foreground">Disponible próximamente</p>
          )}
          {variant.note && <p className="text-center type-footnote text-muted-foreground">{variant.note}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
