import type { DayPlan } from "@/types/training";

export type ShieldChoice = "keep" | "backup" | "replace";

/** Una rutina es tuya si algún día lo marcó el editor. El servidor aplica la misma regla. */
export const isManualPlan = (plans: DayPlan[] | null | undefined): boolean =>
  Array.isArray(plans) && plans.some((p) => p?.custom === true);

export const markManual = (plans: DayPlan[]): DayPlan[] => plans.map((p) => ({ ...p, custom: true }));

const backupKey = (userId: string) => `autopilot:rutina-guardada:${userId}`;

export function saveBackup(userId: string, plans: DayPlan[]) {
  try { localStorage.setItem(backupKey(userId), JSON.stringify({ at: Date.now(), plans })); } catch { /* sin almacenamiento */ }
}

export function readBackup(userId: string): { at: number; plans: DayPlan[] } | null {
  try {
    const raw = localStorage.getItem(backupKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Array.isArray(parsed.plans) && parsed.plans.length ? parsed : null;
  } catch { return null; }
}

export const clearBackup = (userId: string) => { try { localStorage.removeItem(backupKey(userId)); } catch { /* */ } };

// Un único diálogo global: cualquier pantalla puede pedir permiso antes de sustituir la rutina.
type Listener = (resolve: (c: ShieldChoice) => void) => void;
let listener: Listener | null = null;
export const registerShield = (l: Listener | null) => { listener = l; };
export const askShield = (): Promise<ShieldChoice> =>
  new Promise((resolve) => (listener ? listener(resolve) : resolve("keep")));

type Invoker = { functions: { invoke: (name: string, opts: { body: Record<string, unknown> }) => Promise<{ data: any; error: any }> } };

/**
 * Llama a generate-plan respetando el escudo: si la rutina es manual, el servidor no la toca
 * y aquí se pregunta al usuario. Devuelve `kept: true` si decidió conservarla.
 */
export async function generatePlanGuarded(
  client: Invoker,
  body: Record<string, unknown>,
  opts: { userId?: string; currentPlans?: DayPlan[] } = {},
): Promise<{ data: any; error: any; kept?: boolean }> {
  const first = await client.functions.invoke("generate-plan", { body });
  if (!first.data?.protected) return first;
  const choice = await askShield();
  if (choice === "keep") return { ...first, kept: true };
  if (choice === "backup" && opts.userId) {
    const plans = opts.currentPlans ?? (first.data.current as DayPlan[] | undefined) ?? [];
    if (plans.length) saveBackup(opts.userId, plans);
  }
  return client.functions.invoke("generate-plan", { body: { ...body, force: true } });
}
