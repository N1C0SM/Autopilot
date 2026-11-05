import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { animate, motion, useDragControls, useMotionValue, useReducedMotion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { hapticNotify } from "@/shared/lib/native";

const REVEAL = 88;
const FULL_SWIPE = 180;

interface Props {
  /** Texto del botón para lectores de pantalla, p. ej. «Quitar serie». */
  label: string;
  enabled?: boolean;
  onRemove: () => void;
  children: ReactNode;
}

/**
 * Deslizar a la izquierda descubre «Quitar» y deslizar del todo quita la fila, como Hevy y el
 * iPhone (`swipeToRemove` en `Components.swift`). Solo cuenta el gesto horizontal: el scroll
 * vertical sigue igual. Con ratón no arranca encima de un campo, para poder seleccionar texto.
 */
const SwipeToRemove = ({ label, enabled = true, onRemove, children }: Props) => {
  const x = useMotionValue(0);
  const controls = useDragControls();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const startX = useRef(0);

  // Si la fila deja de poder quitarse (queda una sola serie), se cierra: si no, quedaría abierta.
  useEffect(() => {
    if (enabled) return;
    setOpen(false);
    x.set(0);
  }, [enabled, x]);

  const settle = (target: number) => {
    setOpen(target !== 0);
    if (reduceMotion) x.set(target);
    else void animate(x, target, { type: "spring", stiffness: 520, damping: 42 });
  };

  const remove = () => {
    void hapticNotify("warning");
    setOpen(false);
    x.set(0);
    onRemove();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const target = event.target as HTMLElement;
    if (event.pointerType === "mouse" && target.closest("input, textarea, button, select")) return;
    controls.start(event);
  };

  return (
    <div className="relative overflow-hidden">
      {enabled && <button
        type="button"
        onClick={remove}
        aria-label={label}
        // Con teclado también se llega: al enfocarlo, la fila se aparta y lo deja a la vista.
        onFocus={() => { if (!open) settle(-REVEAL); }}
        onBlur={() => settle(0)}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-destructive text-destructive-foreground"
      >
        <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>}
      <motion.div
        drag="x"
        dragListener={false}
        dragControls={controls}
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        onPointerDown={onPointerDown}
        onDragStart={() => { startX.current = x.get(); }}
        onDragEnd={(_, info) => {
          const travelled = startX.current + info.offset.x;
          if (travelled < -FULL_SWIPE) { remove(); return; }
          settle(travelled < -REVEAL / 2 ? -REVEAL : 0);
        }}
        style={{ x, touchAction: "pan-y" }}
        className="relative bg-card"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeToRemove;
