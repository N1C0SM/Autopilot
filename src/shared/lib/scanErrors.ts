import { errorMessage, errorStatus, functionErrorMessage } from "@/shared/lib/runtimeValues";

/**
 * Avisos del scan, iguales en la web y en la app (`ScanView.swift`). El motivo técnico del
 * servidor solo elige el aviso: nunca se enseña tal cual.
 */
export const SCAN_ERRORS = {
  rateLimit: "Has hecho muchos análisis seguidos. Espera un rato y vuelve a intentarlo.",
  noCredit: "El análisis con IA está pausado: el servicio no tiene saldo. Estamos en ello; inténtalo más tarde.",
  offline: "Sin conexión. Comprueba tu internet e inténtalo de nuevo.",
  generic: "No hemos podido analizar las fotos. Inténtalo de nuevo en unos segundos.",
} as const;

export async function scanErrorMessage(error: unknown): Promise<string> {
  const msg = await functionErrorMessage(error, errorMessage(error));
  if (errorStatus(error) === 429 || /too many|429/i.test(msg)) return SCAN_ERRORS.rateLimit;
  if (/payment/i.test(msg)) return SCAN_ERRORS.noCredit;
  if (typeof navigator !== "undefined" && !navigator.onLine) return SCAN_ERRORS.offline;
  return SCAN_ERRORS.generic;
}
