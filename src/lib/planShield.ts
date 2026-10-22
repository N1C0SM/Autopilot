import type { DayPlan } from "@/types/training";
import { toast } from "sonner";

export type ShieldChoice = "keep" | "backup" | "replace";

/** Una rutina es tuya si algún día lo marcó el editor. El servidor aplica la misma regla. */
export const isManualPlan = (plans: DayPlan[] | null | undefined): boolean =>
  Array.isArray(plans) && plans.some((p) => p?.custom === true);

export const markManual = (plans: DayPlan[]): DayPlan[] => plans.map((p) => ({ ...p, custom: true }));

const backupKey = (userId: string) => `autopilot:rutina-guardada:${userId}`;

/** Devuelve true solo si la copia quedó escrita y se puede releer. */
export function saveBackup(userId: string, plans: DayPlan[]): boolean {
  try {
    localStorage.setItem(backupKey(userId), JSON.stringify({ at: Date.now(), plans }));
    return readBackup(userId) !== null;
  } catch { return false; }
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
): Promise<{ data: any; error: any; kept?: boolean; backupFailed?: boolean }> {
  const first = await client.functions.invoke("generate-plan", { body });
  if (!first.data?.protected) return first;
  const choice = await askShield();
  if (choice === "keep") return { ...first, kept: true };
  if (choice === "backup") {
    const plans = opts.currentPlans ?? (first.data.current as DayPlan[] | undefined) ?? [];
    // Sin copia verificada no se sustituye nada: la rutina del usuario se conserva.
    if (!opts.userId || !plans.length || !saveBackup(opts.userId, plans)) {
      toast.error("No se pudo guardar la copia en este dispositivo. Tu rutina se ha conservado.");
      return { ...first, kept: true, backupFailed: true };
    }
  }
  return client.functions.invoke("generate-plan", { body: { ...body, force: true } });
}
