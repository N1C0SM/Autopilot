import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/shared/lib/utils";
import { LOOP_START_DELAY_MS, MAX_LIVE_LOOPS, MAX_WARM_LOOPS, loopUrl, loopsAllowed } from "@/shared/lib/exerciseLoop";

/**
 * Ejercicio en movimiento (como un GIF, pero nuestro clip de técnica): un `<video>` mudo, en bucle,
 * en línea y sin controles, encima de la foto. Única pieza para toda la web: miniaturas de las
 * listas, el visor del entreno y la ficha. Es `ExerciseLoopView` en la app (iPhone y Mac).
 *
 * - La foto va debajo y se ve al instante; el vídeo aparece con un fundido solo cuando su primer
 *   fotograma está listo (nunca un negro ni una espera).
 * - Solo se mueven los que se ven: fuera de pantalla se para y se descarga (IntersectionObserver).
 * - Como mucho `MAX_LIVE_LOOPS` a la vez; el resto enseña la foto hasta que quede un hueco.
 * - Con «reducir movimiento» o ahorro de datos, la foto fija.
 */

/* ── Política: reducir movimiento y ahorro de datos ─────────────────────────────────────── */

type NetworkInformationLike = EventTarget & { saveData?: boolean };
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const REDUCED_DATA = "(prefers-reduced-data: reduce)";

const query = (q: string): MediaQueryList | null =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(q) : null;
const connection = (): NetworkInformationLike | undefined =>
  typeof navigator === "undefined" ? undefined : (navigator as Navigator & { connection?: NetworkInformationLike }).connection;

const readAllowed = () =>
  loopsAllowed({
    reducedMotion: query(REDUCED_MOTION)?.matches ?? false,
    saveData: connection()?.saveData === true || (query(REDUCED_DATA)?.matches ?? false),
  });

const subscribePolicy = (notify: () => void) => {
  const lists = [query(REDUCED_MOTION), query(REDUCED_DATA)].filter((l): l is MediaQueryList => Boolean(l));
  lists.forEach((l) => l.addEventListener?.("change", notify));
  const net = connection();
  net?.addEventListener?.("change", notify);
  return () => {
    lists.forEach((l) => l.removeEventListener?.("change", notify));
    net?.removeEventListener?.("change", notify);
  };
};

/** ¿Pueden moverse los ejercicios? (sin «reducir movimiento» ni ahorro de datos). */
export const useLoopsAllowed = () => useSyncExternalStore(subscribePolicy, readAllowed, () => false);

/* ── Huecos: como mucho seis bucles vivos ──────────────────────────────────────────────── */

const live = new Set<object>();
const waiting = new Set<() => void>();

const takeSlot = (token: object, priority: boolean) => {
  if (live.has(token)) return true;
  if (!priority && live.size >= MAX_LIVE_LOOPS) return false;
  live.add(token);
  return true;
};
const freeSlot = (token: object) => {
  if (!live.delete(token)) return;
  const next = waiting.values().next().value as (() => void) | undefined;
  if (next) { waiting.delete(next); next(); }
};

/* ── Visibilidad: un solo IntersectionObserver para toda la página ──────────────────────── */

const watchers = new WeakMap<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | null = null;
const observe = (element: Element, onChange: (visible: boolean) => void) => {
  if (typeof IntersectionObserver === "undefined") return () => undefined;
  observer ??= new IntersectionObserver(
    (entries) => entries.forEach((entry) => watchers.get(entry.target)?.(entry.isIntersecting)),
    { threshold: 0.25 },
  );
  watchers.set(element, onChange);
  observer.observe(element);
  return () => {
    watchers.delete(element);
    observer?.unobserve(element);
  };
};

/* ── Precarga: el siguiente ejercicio del entreno ya tiene datos al cambiar ─────────────── */

const warm = new Map<string, HTMLVideoElement>();

/** Descarga el principio del clip (y lo deja en caché) sin pintarlo. Respeta la política. */
export const preloadExerciseLoop = (src: string | null | undefined) => {
  const url = loopUrl(src);
  if (!url || warm.has(url) || typeof document === "undefined" || !readAllowed()) return;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  video.load();
  warm.set(url, video);
  while (warm.size > MAX_WARM_LOOPS) {
    const [oldest, element] = warm.entries().next().value as [string, HTMLVideoElement];
    element.removeAttribute("src");
    element.load();
    warm.delete(oldest);
  }
};

/** Arranca el clip mudo (iOS exige el atributo `muted` antes de `play()`); si no puede, se queda la foto. */
const startMuted = (video: HTMLVideoElement | null) => {
  if (!video) return;
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute("muted", "");
  void video.play().catch(() => undefined);
};

type LoopProps = {
  /** `video_url` del ejercicio. Sin un clip propio reproducible, no se pinta nada (queda la foto). */
  src?: string | null;
  /** La foto del ejercicio, la misma URL que la `<img>` de debajo (sale de la caché). */
  poster?: string | null;
  /** Visor del entreno y ficha: siempre tiene hueco, arranca sin espera y precarga entero. */
  priority?: boolean;
  /** Pausado sin descargarlo (p. ej. un ejercicio ya hecho). */
  paused?: boolean;
  /** «Ver vídeo» pulsado con «reducir movimiento»: se mueve porque se ha pedido. */
  force?: boolean;
  className?: string;
};

/**
 * La capa de vídeo. Va dentro de un contenedor `relative` que ya pinta la foto (o la huella):
 * ocupa todo el hueco, no recibe toques y la lee VoiceOver como parte de la imagen.
 */
export const ExerciseLoop = ({ src, poster, priority = false, paused = false, force = false, className }: LoopProps) => {
  const url = loopUrl(src);
  const allowed = useLoopsAllowed() || force;
  const frame = useRef<HTMLSpanElement>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [slot, setSlot] = useState(false);
  const [ready, setReady] = useState(false);
  const wants = Boolean(url) && allowed && !paused && visible;
  const attach = useCallback((element: HTMLVideoElement | null) => {
    video.current = element;
    startMuted(element);
  }, []);

  // Solo se mueve lo que se ve.
  useEffect(() => {
    const element = frame.current;
    if (!element || !url || !allowed || paused) return;
    return observe(element, setVisible);
  }, [url, allowed, paused]);

  // Al entrar en pantalla, espera un instante (scroll rápido = nada que descargar) y pide hueco.
  useEffect(() => {
    if (!wants) return;
    const token = {};
    let retry: (() => void) | null = null;
    const ask = () => {
      if (takeSlot(token, priority)) { setSlot(true); return; }
      retry = ask;
      waiting.add(ask);
    };
    const timer = window.setTimeout(ask, priority ? 0 : LOOP_START_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      if (retry) waiting.delete(retry);
      freeSlot(token);
      setSlot(false);
      setReady(false);
    };
  }, [wants, priority]);

  // Pestaña oculta: el bucle se para y vuelve al volver.
  useEffect(() => {
    if (!slot) return;
    const sync = () => {
      const element = video.current;
      if (!element) return;
      if (document.hidden) element.pause();
      else startMuted(element);
    };
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [slot]);

  if (!url || !allowed) return null;

  return (
    <span ref={frame} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 block", className)}>
      {slot && (
        <video
          key={url}
          ref={attach}
          src={url}
          poster={poster ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload={priority ? "auto" : "metadata"}
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          draggable={false}
          onPlaying={() => setReady(true)}
          onError={() => setReady(false)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300 ease-ios motion-reduce:transition-none",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
};

export default ExerciseLoop;
