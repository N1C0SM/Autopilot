/**
 * Precarga de fotos y clips para que la primera foto y el primer ejercicio en movimiento salgan al
 * instante. Lo mismo que `MediaPrefetch` en la app (ExerciseLoopView.swift):
 *
 * - Al abrir Hoy: las miniaturas de la sesión de hoy, la foto grande del primer ejercicio (la que
 *   abre el entreno) y su clip.
 * - Al empezar un entreno: todas sus fotos (miniatura y grande) y los dos primeros clips.
 * - En Entrenar y Mis rutinas: las miniaturas de todas las sesiones.
 *
 * Siempre por detrás (cuando el navegador está libre, con prioridad baja y de tres en tres): nunca
 * compite con lo que ya está en pantalla ni bloquea nada. Los clips los precarga `ExerciseLoop`
 * (`preloadExerciseLoop`), que respeta «reducir movimiento» y el ahorro de datos.
 */
import { fastImage, HERO_SIDE, THUMB_SIDE } from "./fastImage";
import { loopUrl } from "./exerciseLoop";

/** Clips que se precargan al abrir Hoy y al empezar un entreno (mismos valores en la app). */
export const TODAY_VIDEOS = 1;
export const WORKOUT_VIDEOS = 2;

/** Lo que pinta un ejercicio: su foto y su clip (los dos opcionales). */
export type ExerciseMediaSource = { image?: string | null; video?: string | null };

/** URLs ya a su tamaño: miniaturas (192 px), fotos grandes (1000 px) y clips. */
export type MediaPlan = { thumbs: string[]; heroes: string[]; videos: string[] };

const unique = (urls: (string | null | undefined)[]) => [...new Set(urls.filter((u): u is string => Boolean(u)))];

/** Hoy: miniaturas de la sesión, la foto grande del primer ejercicio y el primer clip. */
export const todayMedia = (items: ExerciseMediaSource[]): MediaPlan => ({
  thumbs: unique(items.map((i) => fastImage(i.image, THUMB_SIDE))),
  heroes: unique(items.slice(0, 1).map((i) => fastImage(i.image, HERO_SIDE))),
  videos: unique(items.map((i) => loopUrl(i.video))).slice(0, TODAY_VIDEOS),
});

/** Entreno que empieza: todas sus fotos (miniatura y grande) y los dos primeros clips. */
export const workoutMedia = (items: ExerciseMediaSource[]): MediaPlan => ({
  thumbs: unique(items.map((i) => fastImage(i.image, THUMB_SIDE))),
  heroes: unique(items.map((i) => fastImage(i.image, HERO_SIDE))),
  videos: unique(items.map((i) => loopUrl(i.video))).slice(0, WORKOUT_VIDEOS),
});

/** Entrenar y Mis rutinas: solo las miniaturas. */
export const thumbnailMedia = (images: (string | null | undefined)[]): MediaPlan => ({
  thumbs: unique(images.map((image) => fastImage(image, THUMB_SIDE))),
  heroes: [],
  videos: [],
});

/* ── Fotos: por detrás, de tres en tres y una sola vez por URL ─────────────────────────────── */

const requested = new Set<string>();
const queue: string[] = [];
let running = 0;
const PARALLEL = 3;

/** Ejecuta `run` cuando el navegador está libre (o en 200 ms si no sabe decirlo): nunca antes de pintar. */
export const whenIdle = (run: () => void) => {
  const w = typeof window === "undefined" ? undefined : (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number });
  if (w?.requestIdleCallback) w.requestIdleCallback(run, { timeout: 1500 });
  else setTimeout(run, 200);
};

const pump = () => {
  while (running < PARALLEL && queue.length > 0) {
    const url = queue.shift()!;
    running += 1;
    const image = new Image();
    image.decoding = "async";
    (image as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low";
    const done = () => { running -= 1; pump(); };
    image.onload = done;
    image.onerror = done;
    image.src = url;
  }
};

/** Pide estas fotos (ya a su tamaño) cuando el navegador está libre. Las ya pedidas se saltan. */
export function prefetchImages(urls: (string | null | undefined)[]): void {
  if (typeof Image === "undefined") return;
  const fresh = unique(urls).filter((url) => !requested.has(url));
  if (fresh.length === 0) return;
  fresh.forEach((url) => requested.add(url));
  whenIdle(() => { queue.push(...fresh); pump(); });
}

/** Solo para las pruebas: olvida lo ya pedido. */
export function resetPrefetchForTests(): void {
  requested.clear();
  queue.length = 0;
  running = 0;
}
