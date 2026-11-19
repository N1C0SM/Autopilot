/**
 * Espera del scan, igual en la web y en la app (`ScanView.swift`): la foto que se analiza, los
 * mismos pasos, los mismos mensajes, el mismo ritmo y la misma pausa antes del resultado.
 * Sin porcentajes inventados: cada paso se marca cuando de verdad ha terminado.
 */
export const SCAN_LOADING_MESSAGES = [
  "Analizando postura…",
  "Detectando prioridades físicas…",
  "Calculando margen de mejora…",
  "Evaluando proporciones y simetría…",
  "Evaluando tu punto de partida…",
  "Generando tu diagnóstico personalizado…",
] as const;

/** Cada cuánto cambia el mensaje del paso activo. */
export const SCAN_MESSAGE_MS = 1600;

/** Con todo hecho, cuánto se ve el último check antes de pasar al resultado. */
export const SCAN_REVEAL_MS = 600;

/** En qué punto real está el scan: la IA responde, se guarda en el historial, listo. */
export type ScanStage = "analyzing" | "saving" | "done";
export type ScanStepState = "done" | "active" | "pending";

export const SCAN_STEP_LABELS = {
  photos: "Fotos preparadas",
  analysis: "Análisis con IA",
  saving: "Guardado en tu historial",
  result: "Tu resultado",
} as const;

/** Nota bajo los pasos (la misma promesa que la nota de privacidad: menos de 1 minuto). */
export const SCAN_WAIT_NOTE = "Suele tardar menos de un minuto.";

/**
 * Pasos de la espera con su estado. `saves`: el scan con cuenta guarda en el historial antes de
 * enseñar el resultado (Progreso → Scan); el público no tiene ese paso.
 */
export function scanSteps(stage: ScanStage, saves: boolean): { label: string; state: ScanStepState }[] {
  const at = stage === "analyzing" ? 0 : stage === "saving" ? 1 : 2;
  const steps: { label: string; state: ScanStepState }[] = [
    { label: SCAN_STEP_LABELS.photos, state: "done" },
    { label: SCAN_STEP_LABELS.analysis, state: at === 0 ? "active" : "done" },
  ];
  if (saves) steps.push({ label: SCAN_STEP_LABELS.saving, state: at === 0 ? "pending" : at === 1 ? "active" : "done" });
  steps.push({ label: SCAN_STEP_LABELS.result, state: at === 2 ? "done" : "pending" });
  return steps;
}
