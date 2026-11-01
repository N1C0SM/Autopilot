import { Check, ChevronRight, Package, Share } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import BookCover from "@/web/components/BookCover";
import { rememberBookPurchase } from "@/shared/lib/buyLink";
import { track } from "@/shared/lib/analytics";
import { hapticTap } from "@/shared/lib/native";
import { skipAutoFocusOnTouch } from "@/app/components/chrome-chat/skipAutoFocusOnTouch";
import { isIOSNative } from "@/shared/lib/platform";

export interface PreviewBook {
  id?: string;
  title: string;
  description: string;
  cover_url: string;
  url: string;
  price: string;
  is_pack?: boolean;
}

/** Splits the admin description into an intro paragraph and "qué incluye" bullet points. */
function parseDescription(text: string) {
  const lines = (text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[-•*·]\s*/.test(l)).map((l) => l.replace(/^[-•*·]\s*/, ""));
  const intro = lines.filter((l) => !/^[-•*·]\s*/.test(l)).join(" ");
  return { intro, bullets };
}

export default function BookPreviewModal({
  book,
  pack,
  onClose,
}: {
  book: PreviewBook | null;
  pack?: PreviewBook | null;
  onClose: () => void;
}) {
  if (!book) return null;
  const ios = isIOSNative();
  // En iOS no se muestra ningún bien digital de pago (§3.1.1).
  const purchaseBlocked = ios && (!!(book.price || "").trim() || /^https?:/i.test(book.url || ""));
  const { intro, bullets } = parseDescription(book.description);
  const showPack = !ios && pack && pack.url && pack.id !== book.id && !book.is_pack;

  const buy = (item: PreviewBook, source: string) => {
    void hapticTap();
    rememberBookPurchase(item.id);
    track("book_buy_click", { book: item.title, source });
  };

  // Enlace directo a esta guía (abre /recursos con la ficha ya desplegada).
  const share = async () => {
    void hapticTap();
    if (!book.id) return;
    const url = `https://autopilotplan.com/recursos?guia=${encodeURIComponent(book.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: book.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      // cancelado por el usuario
    }
  };

  return (
    <Dialog open={!!book} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" onOpenAutoFocus={skipAutoFocusOnTouch}>
        <div className="flex flex-col items-center text-center">
          <div className="w-36">
            <BookCover title={book.title} src={book.cover_url} />
          </div>
          <p className="mt-5 type-subhead text-primary">{book.is_pack ? "Pack de guías" : "Guía en PDF"}</p>
          <DialogTitle className="mt-1 type-title1">{book.title}</DialogTitle>
          {intro && <DialogDescription className="mt-2 type-subhead text-muted-foreground">{intro}</DialogDescription>}
        </div>

        {bullets.length > 0 && (
          <div>
            <p className="type-headline mb-3">Qué vas a aprender</p>
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

        <ListGroup inset>
          <ListRow title="Formato" value="PDF descargable" />
          <ListRow title="Dónde leerlo" value="Móvil y ordenador" />
          <ListRow title="Entrega" value="Tras el pago" />
          <ListRow title="Acceso" value="Para siempre" />
        </ListGroup>

        <div className="space-y-2">
          {purchaseBlocked ? (
            <p className="text-center type-subhead text-muted-foreground">
              Esta guía no está disponible desde la app.
            </p>
          ) : book.url ? (
            <>
              <p className="text-center type-large-title font-rounded tabular-nums">{book.price || "Gratis"}</p>
              <Button asChild variant="hero" size="lg" className="w-full">
                <a href={book.url} target="_blank" rel="noreferrer" onClick={() => buy(book, "preview_modal")}>
                  {book.is_pack || /pack/i.test(book.title) ? "Comprar pack" : "Comprar ahora"}
                </a>
              </Button>
            </>
          ) : (
            <p className="text-center type-subhead text-muted-foreground">Disponible próximamente</p>
          )}
          {!purchaseBlocked && book.url && (
            <p className="text-center type-footnote text-muted-foreground">Pago seguro con Stripe. Material autodidacta, no incluye entrenador.</p>
          )}
          {book.id && (
            <Button type="button" variant="ghost" className="w-full" onClick={() => void share()}>
              <Share className="mr-2 h-4 w-4" aria-hidden="true" />
              {book.is_pack || /pack/i.test(book.title) ? "Compartir pack" : "Compartir guía"}
            </Button>
          )}
        </div>

        {showPack && (
          <a
            href={pack!.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => buy(pack!, "preview_modal_pack")}
            className="flex min-h-[44px] items-center gap-3 rounded-media bg-secondary p-3 transition-colors active:bg-accent"
          >
            <Package className="h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="type-headline">¿Quieres todas las guías?</p>
              <p className="truncate type-footnote text-muted-foreground">{pack!.title}{pack!.price ? ` · ${pack!.price}` : ""}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
