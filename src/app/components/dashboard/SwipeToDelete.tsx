import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { hapticSelection } from "@/shared/lib/native";

const REVEAL = 84;
const FULL = 190;

interface Props {
  children: ReactNode;
  /** Sin permiso (p. ej. la única serie) no se desliza ni aparece el botón. */
  enabled: boolean;
  onDelete: () => void;
  /** Nombre accesible del botón de borrar, p. ej. «Quitar la serie 2 de Press banca». */
  label: string;
}

/**
 * Deslizar a la izquierda para borrar (como Hevy y la app nativa): a medias deja ver
 * «Borrar»; del todo, borra. Con teclado, el botón queda detrás de la fila y al
 * enfocarlo la fila se abre.
 */
export default function SwipeToDelete({ children, enabled, onDelete, label }: Props) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const armed = useRef(false);
  const justDragged = useRef(false);

  const settle = (next: boolean) => {
    setOpen(next);
    setOffset(next ? -REVEAL : 0);
  };
  const remove = () => {
    settle(false);
    onDelete();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.horizontal === null) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      s.horizontal = Math.abs(dx) > Math.abs(dy) * 1.4;
      if (!s.horizontal) {
        start.current = null;
        return;
      }
      setDragging(true);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
    const next = Math.min(0, Math.max((open ? -REVEAL : 0) + dx, -FULL - 40));
    if ((next <= -FULL) !== armed.current) {
      armed.current = next <= -FULL;
      void hapticSelection();
    }
    setOffset(next);
  };

  const onPointerEnd = () => {
    const s = start.current;
    start.current = null;
    if (!s?.horizontal) return;
    setDragging(false);
    armed.current = false;
    justDragged.current = true;
    window.setTimeout(() => { justDragged.current = false; }, 0);
    if (offset <= -FULL) remove();
    else settle(offset < -REVEAL / 2);
  };

  // Tras deslizar no se dispara el clic de debajo; con la fila abierta, un toque solo la cierra.
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (justDragged.current || open) {
      e.preventDefault();
      e.stopPropagation();
      if (open && !justDragged.current) settle(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: dragging ? "none" : "transform 200ms ease" }}
        className="relative z-10 bg-card [touch-action:pan-y]"
      >
        {children}
      </div>
      {enabled && (
        <button
          type="button"
          onClick={remove}
          onFocus={() => settle(true)}
          onBlur={() => { if (!dragging) settle(false); }}
          aria-label={label}
          style={{ width: Math.max(REVEAL, -offset) }}
          className="absolute inset-y-0 right-0 z-0 flex flex-col items-center justify-center gap-0.5 rounded-[10px] bg-destructive type-caption1 font-semibold text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Borrar
        </button>
      )}
    </div>
  );
}
