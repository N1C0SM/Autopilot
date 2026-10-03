import { Check, FileText, Smartphone, Mail, Infinity as InfinityIcon, ArrowRight, Package } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import BookCover from "@/components/BookCover";
import { rememberBookPurchase } from "@/lib/buyLink";
import { track } from "@/lib/analytics";

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
  const { intro, bullets } = parseDescription(book.description);
  const showPack = pack && pack.url && pack.id !== book.id && !book.is_pack;

  const buy = (item: PreviewBook, source: string) => {
    rememberBookPurchase(item.id);
    track("book_buy_click", { book: item.title, source });
  };

  return (
    <Dialog open={!!book} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="grid gap-0 sm:grid-cols-[0.8fr_1.2fr]">
          <div className="bg-secondary p-6 flex items-center justify-center">
            <div className="w-full max-w-[220px]">
              <BookCover title={book.title} src={book.cover_url} />
            </div>
          </div>
          <div className="p-6 flex flex-col">
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-2">
              {book.is_pack ? "Pack de guías" : "Guía en PDF"}
            </p>
            <DialogTitle className="font-display text-2xl font-bold leading-tight">{book.title}</DialogTitle>
            {intro && (
              <DialogDescription className="mt-3 text-sm leading-relaxed text-muted-foreground">{intro}</DialogDescription>
            )}

            {bullets.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold mb-2">Qué vas a aprender</p>
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

            <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-primary" /> PDF descargable</span>
              <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-primary" /> Móvil y ordenador</span>
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-primary" /> Entrega tras el pago</span>
              <span className="flex items-center gap-1.5"><InfinityIcon className="w-3.5 h-3.5 text-primary" /> Tuyo para siempre</span>
            </div>

            <div className="mt-6 pt-5 border-t border-border">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl font-bold">{book.price || "Gratis"}</span>
                {book.url ? (
                  <Button asChild variant="hero" size="lg">
                    <a href={book.url} target="_blank" rel="noreferrer" onClick={() => buy(book, "preview_modal")}>
                      Comprar ahora <ArrowRight className="w-4 h-4" />
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Disponible próximamente</span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Pago seguro con Stripe. Material autodidacta, no incluye entrenador.</p>
            </div>

            {showPack && (
              <a
                href={pack!.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => buy(pack!, "preview_modal_pack")}
                className="mt-4 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/[0.06] p-3 hover:border-primary transition-colors"
              >
                <Package className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">¿Quieres todas las guías?</p>
                  <p className="text-xs text-muted-foreground truncate">{pack!.title}{pack!.price ? ` · ${pack!.price}` : ""}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary shrink-0" />
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
