/**
 * Espera del scan, igual en la web y en la app (`ScanView.swift`): mismos mensajes, mismo ritmo
 * y misma curva del anillo.
 */
export const SCAN_LOADING_MESSAGES = [
  "Analizando postura…",
  "Detectando prioridades físicas…",
  "Calculando margen de mejora…",
  "Evaluando proporciones y simetría…",
  "Evaluando tu punto de partida…",
  "Generando tu diagnóstico personalizado…",
] as const;

/** Cada cuánto cambia el mensaje. */
export const SCAN_MESSAGE_MS = 1600;

/** Avance del anillo mientras responde la IA: rápido al principio y sin pasar del 95 % hasta tener el resultado. */
export function scanProgressAt(elapsedMs: number): number {
  return 95 * (1 - Math.exp(-Math.max(0, elapsedMs) / 6000));
}
