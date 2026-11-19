import type { DayPlan } from "@/shared/types/training";

/**
 * Escudo de rutinas propias. generate-plan nunca pierde ni reescribe una rutina tuya (`custom: true`,
 * `supabase/functions/_shared/planMerge.ts`): el piloto automático solo adapta sus propias sesiones,
 * en los días libres, y responde cuántas rutinas respetó (`kept_custom`). Ya no hay nada que elegir
 * ni que avisar de que se pierda: se dice «Hemos respetado tus N rutinas».
 */

/** Una rutina es tuya si algún día lo marcó el editor. El servidor aplica la misma regla. */
export const isManualPlan = (plans: DayPlan[] | null | undefined): boolean =>
  Array.isArray(plans) && plans.some((p) => p?.custom === true);

export const markManual = (plans: DayPlan[]): DayPlan[] => plans.map((p) => ({ ...p, custom: true }));

// Copias que se guardaban en este dispositivo antes de sustituir un plan entero (ya no se sustituye):
// el editor las sigue ofreciendo con «Recuperar mi copia» hasta que se usan.
const backupKey = (userId: string) => `autopilot:rutina-guardada:${userId}`;

export function readBackup(userId: string): { at: number; plans: DayPlan[] } | null {
  try {
    const raw = localStorage.getItem(backupKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Array.isArray(parsed.plans) && parsed.plans.length ? parsed : null;
  } catch { return null; }
}

export const clearBackup = (userId: string) => { try { localStorage.removeItem(backupKey(userId)); } catch { /* */ } };

/** «Hemos respetado tus 2 rutinas» / «Hemos respetado tu rutina». Igual en la app (`PlanShield.keptTitle`). */
export const keptRoutinesTitle = (count: number): string =>
  count === 1 ? "Hemos respetado tu rutina" : `Hemos respetado tus ${count} rutinas`;

/**
 * Textos del escudo. El título y `description` son los mismos en la app (`PlanShield` en
 * `native/Autopilot/Core/Training.swift`); la hoja con `body`/`full` solo existe en la web.
 */
export const SHIELD_COPY = {
  description: "El piloto automático solo adapta sus propias sesiones.",
  body: "Tus rutinas siguen en tu plan tal cual y en su orden. El piloto automático prepara sus sesiones en los días libres hasta completar tus días de entreno.",
  // Cierto también cuando el piloto quita sus sesiones viejas porque tus rutinas ya llenan tus días.
  full: "Tus rutinas ya cubren tus días de entreno, así que tu semana se hace con ellas.",
  done: "Entendido",
} as const;

/** Lo que respetó el piloto automático al preparar el plan. */
export type KeptRoutines = { count: number; full: boolean };

/** Lee `kept_custom` y `custom_full` de la respuesta de generate-plan. */
export function keptRoutines(data: unknown): KeptRoutines {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  // Un servidor anterior respondía `protected` con el plan sin tocar.
  if (d.protected === true) {
    const current = Array.isArray(d.current) ? (d.current as DayPlan[]) : [];
    return { count: current.filter((p) => p?.custom === true).length, full: false };
  }
  const kept = typeof d.kept_custom === "number" && Number.isFinite(d.kept_custom) ? Math.max(0, Math.floor(d.kept_custom)) : 0;
  return { count: kept, full: kept > 0 && d.custom_full === true };
}

// Una única hoja global (`PlanShieldDialog`): la primera vez que el piloto automático prepara sus
// sesiones alrededor de tus rutinas, en este dispositivo, se explica; después basta el aviso de cada pantalla.
type Listener = (notice: KeptRoutines) => void;
let listener: Listener | null = null;
export const registerShield = (l: Listener | null) => { listener = l; };

const seenKey = (userId: string) => `autopilot:escudo-visto:${userId}`;

/** Enseña la hoja del escudo si aún no se vio en este dispositivo. Devuelve true si la enseñó. */
export function showShieldOnce(userId: string, notice: KeptRoutines): boolean {
  if (!listener || notice.count === 0) return false;
  try {
    if (localStorage.getItem(seenKey(userId))) return false;
    localStorage.setItem(seenKey(userId), String(Date.now()));
  } catch { /* Sin almacenamiento se enseña igual. */ }
  listener(notice);
  return true;
}

type Invoker = { functions: { invoke: (name: string, opts: { body: Record<string, unknown> }) => Promise<{ data: any; error: any }> } };

export type GuardedPlanResult = {
  data: any;
  error: any;
  /** El servidor (anterior a la mezcla) dejó el plan sin tocar porque tenía rutinas tuyas. */
  kept?: boolean;
  /** Rutinas tuyas que se han respetado. */
  keptCustom: number;
  /** Tus rutinas ya cubren tus días de entreno: el piloto automático no ha añadido nada. */
  customFull: boolean;
};

/**
 * Llama a generate-plan una sola vez y nunca con `force`: el servidor respeta tus rutinas y solo
 * adapta las sesiones del piloto automático. Con `userId` (tu propio plan), la primera vez se
 * explica con la hoja del escudo.
 */
export async function generatePlanGuarded(
  client: Invoker,
  body: Record<string, unknown>,
  opts: { userId?: string } = {},
): Promise<GuardedPlanResult> {
  const res = await client.functions.invoke("generate-plan", { body });
  const notice = keptRoutines(res.data);
  const legacy = res.data?.protected === true;
  // Cuenta gratis con su rutina inicial ya hecha (`existing`): no se ha adaptado nada.
  if (!res.error && !legacy && !res.data?.existing && opts.userId) showShieldOnce(opts.userId, notice);
  return { ...res, ...(legacy ? { kept: true } : {}), keptCustom: notice.count, customFull: notice.full };
}
