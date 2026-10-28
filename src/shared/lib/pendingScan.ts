/**
 * Contexto de un análisis de scan hecho sin cuenta y guardado en la pestaña.
 *
 * Hasta ahora solo servía para el preview del alta y el prefill del onboarding.
 * Con la verificación por código el usuario no cambia de pestaña, así que al
 * volver a `/scan` podemos restaurar el informe en vez de obligarle a repetir
 * el análisis IA. Caduca a las 24 h, igual que antes.
 */
export const PENDING_SCAN_KEY = "autopilot_scan";
export const PENDING_SCAN_TTL_MS = 24 * 60 * 60 * 1000;

export interface PendingScanContext {
  result: unknown;
  currentImg?: string;
  objectiveImg?: string;
  /** Email que se dejó en el formulario de lead: confirma un scan anónimo. */
  leadEmail?: string;
  /** Ya se restauró una vez: evita repetir el aviso en cada visita. */
  restored?: boolean;
  createdAt: number;
}

export function readPendingScanContext(now: number = Date.now()): PendingScanContext | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SCAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
    if (!createdAt || now - createdAt > PENDING_SCAN_TTL_MS) {
      sessionStorage.removeItem(PENDING_SCAN_KEY);
      return null;
    }
    if (!parsed.result || typeof parsed.result !== "object") return null;
    return {
      result: parsed.result,
      currentImg: typeof parsed.currentImg === "string" ? parsed.currentImg : undefined,
      objectiveImg: typeof parsed.objectiveImg === "string" ? parsed.objectiveImg : undefined,
      leadEmail: typeof parsed.leadEmail === "string" ? parsed.leadEmail : undefined,
      restored: parsed.restored === true,
      createdAt,
    };
  } catch {
    return null;
  }
}

/** Marca el contexto como ya restaurado para no repetir el aviso. */
export function markPendingScanRestored(): void {
  try {
    const raw = sessionStorage.getItem(PENDING_SCAN_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    sessionStorage.setItem(PENDING_SCAN_KEY, JSON.stringify({ ...parsed, restored: true }));
  } catch {
    /* noop */
  }
}

export function clearPendingScanContext(): void {
  try {
    sessionStorage.removeItem(PENDING_SCAN_KEY);
  } catch {
    /* noop */
  }
}
