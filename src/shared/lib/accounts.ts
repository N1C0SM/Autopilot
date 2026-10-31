import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/shared/integrations/supabase/client";

/**
 * Varias cuentas en el mismo dispositivo, como los usuarios de un Mac: cada una
 * guarda aquí su sesión (lo mismo que Supabase ya guarda para la cuenta activa)
 * y cambiar de cuenta carga la sesión de la otra. Solo en las apps nativas.
 */
export interface SavedAccount {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  accessToken: string;
  refreshToken: string;
  /** La sesión dejó de valer (contraseña cambiada, sesión cerrada en otro sitio): hay que volver a entrar. */
  expired?: boolean;
  /** Pedir la contraseña al entrar en esta cuenta desde «¿Quién entrena?». Por defecto, no. */
  requirePassword?: boolean;
}

const KEY = "autopilot.accounts.v1";

export function listAccounts(): SavedAccount[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? uniqueAccounts(raw.filter((a): a is SavedAccount => !!a && typeof a.id === "string" && typeof a.refreshToken === "string")) : [];
  } catch {
    return [];
  }
}

const mailOf = (a: SavedAccount) => (a.email ?? "").trim().toLowerCase();

/**
 * Una persona, una tarjeta. El correo es único en Supabase: dos entradas con el mismo
 * correo (o el mismo id) son la misma persona, p. ej. una cuenta borrada y vuelta a crear.
 * Se queda la que sigue valiendo (la más reciente si empatan), en el sitio de la primera,
 * y conserva la contraseña opcional si cualquiera de las dos la pedía.
 */
function uniqueAccounts(list: SavedAccount[]): SavedAccount[] {
  const out: SavedAccount[] = [];
  for (const a of list) {
    const j = out.findIndex((b) => b.id === a.id || (!!mailOf(a) && mailOf(b) === mailOf(a)));
    if (j < 0) { out.push(a); continue; }
    const keep = a.expired && !out[j].expired ? out[j] : a;
    out[j] = { ...keep, requirePassword: out[j].requirePassword || a.requirePassword };
  }
  return out;
}

function save(list: SavedAccount[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* sin almacenamiento: solo la cuenta activa */ }
}

/** Guarda o actualiza la sesión de la cuenta activa (los tokens rotan al refrescarse). */
export function rememberSession(session: Session) {
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const account: SavedAccount = {
    id: u.id,
    email: u.email ?? "",
    name: text(meta.full_name) || text(meta.name) || (u.email ?? "").split("@")[0],
    avatar: text(meta.avatar_url) || null,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
  // Otra tarjeta con este correo y otro id es esta misma persona con una cuenta que ya no
  // existe: pasa a ser esta (mismo sitio, misma contraseña opcional), nunca una segunda.
  const all = listAccounts();
  const replaced = all.filter((a) => a.id !== account.id && !!mailOf(account) && mailOf(a) === mailOf(account)).map((a) => a.id);
  const list = uniqueAccounts(all.map((a) => (replaced.includes(a.id) ? { ...a, id: account.id } : a)));
  if (replaced.includes(getDefaultAccountId() ?? "")) setDefaultAccountId(account.id);
  const i = list.findIndex((a) => a.id === account.id);
  // El nombre y la foto del perfil ganan a los del registro (que a menudo no los traen).
  if (i >= 0) list[i] = { ...account, name: list[i].name || account.name, avatar: list[i].avatar ?? account.avatar, requirePassword: list[i].requirePassword, expired: false };
  else list.push(account);
  const lock = takePendingLock(account.id);
  if (lock !== undefined) list[i >= 0 ? i : list.length - 1].requirePassword = lock;
  save(list);
  // Fuera del callback de auth: Supabase no admite consultas dentro de onAuthStateChange.
  setTimeout(() => { void syncProfile(account.id); }, 0);
}

/** Nombre y foto de la ficha del perfil, los mismos que se ven en la app. */
async function syncProfile(id: string) {
  try {
    const { data } = await supabase.from("profiles").select("name, avatar_url").eq("user_id", id).maybeSingle();
    if (!data) return;
    const list = listAccounts();
    const i = list.findIndex((a) => a.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], name: data.name?.trim() || list[i].name, avatar: data.avatar_url || list[i].avatar };
    save(list);
  } catch { /* sin conexión: se queda el nombre del registro */ }
}

export function forgetAccount(id: string) {
  save(listAccounts().filter((a) => a.id !== id));
  // Si era la predeterminada, la marca se va con ella: al abrir, picker limpio.
  if (getDefaultAccountId() === id) setDefaultAccountId(null);
}

export type SwitchResult = "ok" | "offline" | "expired";

/**
 * Entra en otra cuenta guardada. Las cuentas no caducan solas: sin conexión no se
 * toca nada, y si la sesión ya no vale la cuenta se queda en la lista para volver a entrar.
 */
export async function switchToAccount(id: string): Promise<SwitchResult> {
  const target = listAccounts().find((a) => a.id === id);
  if (!target) return "expired";
  const { data: current } = await supabase.auth.getSession();
  if (current.session) rememberSession(current.session);
  try {
    const { data, error } = await supabase.auth.setSession({ access_token: target.accessToken, refresh_token: target.refreshToken });
    if (data.session && !error) {
      rememberSession(data.session);
      return "ok";
    }
    // Solo un fallo real de red es "sin conexión"; cualquier otro rechazo pide volver a entrar.
    if (isNetworkError(error)) return "offline";
    markExpired(id);
    return "expired";
  } catch (e) {
    if (isNetworkError(e)) return "offline";
    markExpired(id);
    return "expired";
  }
}

/** navigator.onLine miente en Safari/macOS tras el reposo: solo cuenta un fetch que no llega. */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; message?: string; status?: number };
  if (e.name === "AuthRetryableFetchError") return true;
  if (e instanceof TypeError || e.name === "TypeError") return /fetch|network|load failed/i.test(e.message ?? "");
  return /failed to fetch|networkerror|load failed|network request failed/i.test(e.message ?? "");
}

const PENDING_LOCK_KEY = "autopilot.accounts.pending-lock";

export function setRequirePassword(id: string, value: boolean) {
  const list = listAccounts();
  if (list.some((a) => a.id === id)) {
    save(list.map((a) => (a.id === id ? { ...a, requirePassword: value } : a)));
    return;
  }
  // La sesión aún no se ha guardado: rememberSession lo aplica en cuanto llegue.
  try { localStorage.setItem(PENDING_LOCK_KEY, JSON.stringify({ id, value })); } catch { /* sin almacenamiento */ }
}

function takePendingLock(id: string): boolean | undefined {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_LOCK_KEY) || "null") as { id?: string; value?: boolean } | null;
    if (pending?.id !== id) return undefined;
    localStorage.removeItem(PENDING_LOCK_KEY);
    return !!pending.value;
  } catch { return undefined; }
}

/** Entra en una cuenta protegida con su contraseña. */
export async function signInSavedAccount(id: string, password: string): Promise<SwitchResult | "wrong"> {
  const target = listAccounts().find((a) => a.id === id);
  if (!target) return "expired";
  const { data: current } = await supabase.auth.getSession();
  if (current.session && current.session.user.id !== id) rememberSession(current.session);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: target.email, password });
    if (data.session && !error) { rememberSession(data.session); return "ok"; }
    return isNetworkError(error) ? "offline" : "wrong";
  } catch (e) {
    return isNetworkError(e) ? "offline" : "wrong";
  }
}

function markExpired(id: string) {
  save(listAccounts().map((a) => (a.id === id ? { ...a, expired: true } : a)));
}

/**
 * Deja la cuenta activa guardada y la aparta solo de la pantalla. No llama a signOut:
 * incluso con scope "local", Supabase revoca esa sesión en el servidor y la cuenta
 * guardada volvería a pedir contraseña. Se borra la copia local y se recarga la app.
 */
export async function prepareAnotherAccount() {
  const { data } = await supabase.auth.getSession();
  if (data.session) rememberSession(data.session);
  try {
    for (const key of Object.keys(localStorage)) {
      if (/^sb-.+-auth-token$/.test(key)) localStorage.removeItem(key);
    }
  } catch { /* sin almacenamiento: no había sesión guardada */ }
}

/** Abre «¿Quién entrena?» desde cualquier sitio (avatar mantenido, menú del Mac). */
export const OPEN_ACCOUNT_PICKER = "autopilot:open-account-picker";
export function openAccountPicker() {
  window.dispatchEvent(new Event(OPEN_ACCOUNT_PICKER));
}

// ── Cuenta predeterminada ──────────────────────────────────────────────

const DEFAULT_KEY = "autopilot.accounts.default-id";

/** ID de la cuenta marcada como predeterminada en este dispositivo, o null. */
export function getDefaultAccountId(): string | null {
  try { return localStorage.getItem(DEFAULT_KEY); } catch { return null; }
}

/** Marca (o desmarca con null) una cuenta como predeterminada. */
export function setDefaultAccountId(id: string | null) {
  try {
    if (id) localStorage.setItem(DEFAULT_KEY, id);
    else localStorage.removeItem(DEFAULT_KEY);
  } catch { /* sin almacenamiento */ }
}
