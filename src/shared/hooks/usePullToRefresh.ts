import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { hapticImpact, hapticTap } from "@/shared/lib/native";

/** Distancia a la que el gesto cuenta como «refrescar» (pt). */
export const PULL_THRESHOLD = 64;

const MAX_PULL = 96;
const HOLD = 52;
const MIN_SPIN = 450;
const EDGE_RESISTANCE = 0.55;

interface Options {
  onRefresh: () => Promise<unknown> | unknown;
  enabled?: boolean;
}

export interface PullToRefreshState {
  offset: number;
  refreshing: boolean;
  dragging: boolean;
  /** 0..1, para la opacidad del indicador y el giro de la flecha. */
  progress: number;
  style: CSSProperties;
}

/**
 * Pull-to-refresh con el tacto de `UIRefreshControl`.
 *
 * Solo se activa con el contenido arriba del todo y con un gesto vertical; un
 * deslizamiento horizontal se deja pasar para que lo maneje el gesto de borde o
 * el scroll horizontal de una gráfica. Mientras se tira, el contenedor se
 * desplaza con el dedo y se resiste; al pasar el umbral hay un háptico ligero y,
 * al soltar, el refresco se mantiene visible un mínimo de 450 ms para que no
 * parpadee en conexiones rápidas.
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement>,
  { onRefresh, enabled = true }: Options,
): PullToRefreshState {
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const offsetRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const pull = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  const run = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setDragging(false);
    pull(HOLD);
    const started = Date.now();
    try {
      await onRefreshRef.current();
    } catch {
      // Un refresco fallido no debe dejar la pantalla bloqueada; el aviso de
      // error lo da quien hizo la petición.
    }
    const wait = Math.max(0, MIN_SPIN - (Date.now() - started));
    window.setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
      pull(0);
      void hapticImpact("light");
    }, wait);
  }, [pull]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pulling = false;
    let crossed = false;

    const reset = () => {
      tracking = false;
      pulling = false;
      crossed = false;
      setDragging(false);
      if (!refreshingRef.current) pull(0);
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || refreshingRef.current) return;
      if (element.scrollTop > 0) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      pulling = false;
      crossed = false;
    };

    const onMove = (event: TouchEvent) => {
      if (!tracking || refreshingRef.current || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!pulling) {
        // Horizontal o hacia arriba: no es un refresco. Se suelta el gesto para
        // no secuestrar el scroll de la lista ni el gesto de borde.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          if (dy < -8 || Math.abs(dx) > 8) tracking = false;
          return;
        }
        if (dy < 8) return;
        if (element.scrollTop > 0) {
          reset();
          return;
        }
        pulling = true;
        setDragging(true);
      }

      if (element.scrollTop > 0) {
        reset();
        return;
      }
      if (event.cancelable) event.preventDefault();

      const next = Math.min(MAX_PULL, Math.max(0, (dy - 8) * EDGE_RESISTANCE));
      pull(next);

      const over = next >= PULL_THRESHOLD;
      if (over && !crossed) {
        crossed = true;
        void hapticTap();
      } else if (!over && crossed && next < PULL_THRESHOLD - 12) {
        crossed = false;
      }
    };

    const onEnd = () => {
      if (!tracking) return;
      const wasPulling = pulling;
      tracking = false;
      pulling = false;
      crossed = false;
      setDragging(false);
      if (!wasPulling) return;
      if (offsetRef.current >= PULL_THRESHOLD) void run();
      else pull(0);
    };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("touchcancel", onEnd);

    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, pull, ref, run]);

  return {
    offset,
    refreshing,
    dragging,
    progress: Math.min(1, offset / PULL_THRESHOLD),
    style: {
      transform: offset ? `translate3d(0, ${offset}px, 0)` : undefined,
      transition: dragging ? "none" : "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
    },
  };
}
