/**
 * Reglas del ejercicio en movimiento (el bucle corto de técnica que genera `exercise-video`,
 * guardado en `site-assets/exercise-videos/`). Puras y sin DOM: las usan `ExerciseLoop.tsx`
 * en la web y, con los mismos valores, `ExerciseLoopView.swift` en el iPhone y el Mac.
 *
 * Qué se ve, siempre en este orden: la foto al instante → el bucle encima cuando su primer
 * fotograma está listo (mudo, en bucle, sin controles). Sin vídeo, la foto con la huella dorada
 * del ejercicio; sin foto, la huella a su tamaño. Nunca un hueco ni una espera.
 */

/** Solo archivos de vídeo directos (nuestros clips): nunca GIF, YouTube ni imágenes de terceros. */
export const LOOP_EXTENSIONS = ["mp4", "mov", "m4v"] as const;

/** Bucles vivos a la vez como mucho: una lista larga nunca crea docenas de vídeos (el resto enseña la foto). */
export const MAX_LIVE_LOOPS = 6;

/** Vídeos precargados en reserva (el siguiente ejercicio del entreno), además de los vivos. */
export const MAX_WARM_LOOPS = 2;

/** Lo que una miniatura espera en pantalla antes de arrancar: al hacer scroll rápido no se descarga nada. */
export const LOOP_START_DELAY_MS = 150;

/** La URL del bucle si es un clip propio reproducible en línea; `null` si no (se queda la foto). */
export const loopUrl = (url: string | null | undefined): string | null => {
  const value = (url ?? "").trim();
  if (!/^https?:\/\//i.test(value)) return null;
  const path = value.split(/[?#]/)[0].toLowerCase();
  const extension = path.slice(path.lastIndexOf(".") + 1);
  return (LOOP_EXTENSIONS as readonly string[]).includes(extension) ? value : null;
};

/** Lo que decide si se mueve o se queda la foto fija. */
export type LoopEnvironment = {
  /** «Reducir movimiento» del sistema. */
  reducedMotion: boolean;
  /** Ahorro de datos (`navigator.connection.saveData`, `prefers-reduced-data`; «Modo de datos reducidos» en iOS). */
  saveData: boolean;
  /** Modo de bajo consumo (solo lo sabe la app nativa; en la web el navegador ya bloquea el autoplay). */
  lowPower?: boolean;
};

/** ¿Pueden moverse los ejercicios? Con cualquiera de los tres, la foto fija. */
export const loopsAllowed = ({ reducedMotion, saveData, lowPower = false }: LoopEnvironment): boolean =>
  !reducedMotion && !saveData && !lowPower;

/** El ejercicio que se precarga en el entreno: el siguiente al actual (null en el último). */
export const nextLoopIndex = (current: number, total: number): number | null =>
  current >= 0 && current + 1 < total ? current + 1 : null;
