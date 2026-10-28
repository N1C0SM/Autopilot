/**
 * Borrador del configurador de onboarding.
 *
 * Se guarda mientras el usuario hace el quiz sin cuenta y se recupera al volver
 * del alta para no repetir las respuestas. Antes se restauraba siempre y se
 * saltaba al último paso, incluso con borradores viejos o incompletos; ahora se
 * lee aquí con caducidad y el Configurator decide a qué paso reanudar.
 */
export const CONFIGURATOR_DRAFT_KEY = "autopilot_config";
export const CONFIGURATOR_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface ConfiguratorDraft<T> {
  data: T;
  createdAt: number;
}

export function saveConfiguratorDraft<T>(data: T): void {
  try {
    localStorage.setItem(
      CONFIGURATOR_DRAFT_KEY,
      JSON.stringify({ data, createdAt: Date.now() } satisfies ConfiguratorDraft<T>),
    );
  } catch {
    /* best-effort: sin storage el quiz se puede rehacer */
  }
}

export function readConfiguratorDraft<T>(now: number = Date.now()): ConfiguratorDraft<T> | null {
  try {
    const raw = localStorage.getItem(CONFIGURATOR_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConfiguratorDraft<T>>;
    const valid =
      typeof parsed.createdAt === "number" &&
      parsed.data !== null &&
      typeof parsed.data === "object";
    if (!valid || now - (parsed.createdAt as number) > CONFIGURATOR_DRAFT_TTL_MS) {
      localStorage.removeItem(CONFIGURATOR_DRAFT_KEY);
      return null;
    }
    return { data: parsed.data as T, createdAt: parsed.createdAt as number };
  } catch {
    return null;
  }
}

export function clearConfiguratorDraft(): void {
  try {
    localStorage.removeItem(CONFIGURATOR_DRAFT_KEY);
  } catch {
    /* noop */
  }
}
