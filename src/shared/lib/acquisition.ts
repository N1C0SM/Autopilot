import { supabase } from "@/shared/integrations/supabase/client";

/**
 * Atribución de primer contacto (Admin → Captación).
 *
 * Al llegar a la web pública guardamos de dónde viene el visitante
 * (utm_source / utm_medium / utm_campaign, `ref` o, si no hay, el dominio que lo
 * envió) durante 30 días. Al crear la cuenta viaja en los metadatos del alta y,
 * como respaldo (Google/Apple, otro dispositivo), se reclama con
 * `claim_acquisition` en la primera sesión. Sin datos personales: solo la fuente.
 */

export interface FirstTouch {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landing: string;
  at: number;
}

export type AcquisitionEventKind = "visit" | "scan";

const STORAGE_KEY = "autopilot_acq";
const CLAIMED_KEY = "autopilot_acq_claimed";
const STAFF_KEY = "autopilot_acq_staff";
export const FIRST_TOUCH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OWN_HOSTS = /(^|\.)autopilotplan\.com$|^localhost$|^127\.0\.0\.1$|lovable\.(app|dev)$|lovableproject\.com$/i;

const clean = (value: string | null | undefined, max = 64): string | null => {
  const v = (value ?? "").trim().toLowerCase().slice(0, max);
  return v ? v : null;
};

const storage = (): Storage | null => {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
};

/**
 * Navegador del equipo: sus visitas y scans no cuentan. Se marca al abrir Admin
 * o al entrar una vez con `?no_contar=1` (para los navegadores de Instagram/TikTok
 * del móvil, donde no hay sesión de admin).
 */
export function markStaffDevice(): void {
  try { storage()?.setItem(STAFF_KEY, "1"); } catch { /* Sin almacenamiento: no se puede marcar. */ }
}

export function isStaffDevice(search = typeof window !== "undefined" ? window.location.search : ""): boolean {
  if (new URLSearchParams(search).get("no_contar") === "1") markStaffDevice();
  try { return storage()?.getItem(STAFF_KEY) === "1"; } catch { return false; }
}

/** Lee la URL y el referrer y devuelve el contacto que describen (sin guardarlo). */
export function parseTouch(search: string, pathname: string, referrer: string, now = Date.now()): FirstTouch {
  const params = new URLSearchParams(search);
  let source = clean(params.get("utm_source")) ?? clean(params.get("ref"));
  let medium = clean(params.get("utm_medium"));
  const campaign = clean(params.get("utm_campaign"), 100);
  if (!source && referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
      if (host && !OWN_HOSTS.test(host)) {
        source = clean(host);
        medium = medium ?? "referral";
      }
    } catch { /* Referrer inválido: se trata como directo. */ }
  }
  return { source, medium, campaign, landing: pathname.slice(0, 120) || "/", at: now };
}

export function readFirstTouch(now = Date.now()): FirstTouch | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const touch = JSON.parse(raw) as FirstTouch;
    if (typeof touch?.at !== "number" || now - touch.at > FIRST_TOUCH_TTL_MS) {
      store.removeItem(STORAGE_KEY);
      return null;
    }
    return touch;
  } catch {
    return null;
  }
}

/**
 * Guarda el primer contacto si no hay uno vigente. Una visita directa se
 * mejora si después llega con fuente (p. ej. abre la web y luego el enlace de
 * la bio); una fuente ya guardada nunca se sobrescribe.
 * `isNew` indica un visitante nuevo en este navegador.
 */
export function captureFirstTouch(
  location: { search: string; pathname: string } = window.location,
  referrer = typeof document !== "undefined" ? document.referrer : "",
  now = Date.now(),
): { touch: FirstTouch; isNew: boolean } {
  const existing = readFirstTouch(now);
  const incoming = parseTouch(location.search, location.pathname, referrer, now);
  if (existing && (existing.source || !incoming.source)) return { touch: existing, isNew: false };
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify(incoming)); } catch { /* Sin almacenamiento: cuenta como directo. */ }
  return { touch: incoming, isNew: !existing };
}

/** Metadatos del alta (`signUp`): el trigger de la base de datos los guarda en `user_acquisition`. */
export function acquisitionMetadata(touch: FirstTouch | null = readFirstTouch()): Record<string, string> {
  if (!touch || isStaffDevice()) return {};
  const meta: Record<string, string> = { acq_landing: touch.landing };
  if (touch.source) meta.acq_source = touch.source;
  if (touch.medium) meta.acq_medium = touch.medium;
  if (touch.campaign) meta.acq_campaign = touch.campaign;
  return meta;
}

/** Admin: borra visitas y scans registrados hasta ahora para medir desde cero (las cuentas no se tocan). */
export async function resetAcquisitionEvents(): Promise<number> {
  const { data, error } = await rpc("admin_reset_acquisition_events", {});
  if (error) throw error;
  return Number(data) || 0;
}

// Las funciones nuevas aún no están en los tipos generados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args) as Promise<{ data: unknown; error: unknown }>;

/** Registra una visita nueva o un scan con la fuente del primer contacto. Nunca rompe la experiencia. */
export async function recordAcquisitionEvent(kind: AcquisitionEventKind, touch: FirstTouch | null = readFirstTouch()): Promise<void> {
  if (isStaffDevice()) return;
  try {
    await rpc("record_acquisition_event", {
      _kind: kind,
      _source: touch?.source ?? null,
      _medium: touch?.medium ?? null,
      _campaign: touch?.campaign ?? null,
    });
  } catch { /* La medición nunca bloquea al usuario. */ }
}

/**
 * Respaldo para altas sin metadatos (Google/Apple): la base de datos solo
 * acepta la fila de la propia cuenta, una vez y si se creó hace menos de 7 días.
 */
export async function claimAcquisition(userId: string, touch: FirstTouch | null = readFirstTouch()): Promise<void> {
  const store = storage();
  if (!touch || !store || isStaffDevice()) return;
  try {
    if (store.getItem(CLAIMED_KEY) === userId) return;
    const { error } = await rpc("claim_acquisition", {
      _source: touch.source,
      _medium: touch.medium,
      _campaign: touch.campaign,
      _landing: touch.landing,
    });
    if (!error) store.setItem(CLAIMED_KEY, userId);
  } catch { /* Se reintenta en la próxima sesión. */ }
}
