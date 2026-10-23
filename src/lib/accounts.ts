import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
    return Array.isArray(raw) ? raw.filter((a): a is SavedAccount => !!a && typeof a.id === "string" && typeof a.refreshToken === "string") : [];
  } catch {
    return [];
  }
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
  const list = listAccounts();
  const i = list.findIndex((a) => a.id === account.id);
  // El nombre y la foto del perfil ganan a los del registro (que a menudo no los traen).
  if (i >= 0) list[i] = { ...account, name: list[i].name || account.name, avatar: list[i].avatar ?? account.avatar, requirePassword: list[i].requirePassword, expired: false };
  else list.push(account);
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
}

export type SwitchResult = "ok" | "offline" | "expired";

/**
 * Entra en otra cuenta guardada. Las cuentas no caducan solas: sin conexión no se
 * toca nada, y si la sesión ya no vale la cuenta se queda en la lista para volver a entrar.
 */
export async function switchToAccount(id: string): Promise<SwitchResult> {
  const target = listAccounts().find((a) => a.id === id);
  if (!target) return "expired";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  const { data: current } = await supabase.auth.getSession();
  if (current.session) rememberSession(current.session);
  try {
    const { data, error } = await supabase.auth.setSession({ access_token: target.accessToken, refresh_token: target.refreshToken });
    if (data.session && !error) {
      rememberSession(data.session);
      return "ok";
    }
    // Solo un rechazo del servidor (4xx) significa que la sesión ya no vale; lo demás es la red.
    const status = (error as { status?: number } | null)?.status ?? 0;
    if (status >= 400 && status < 500) {
      markExpired(id);
      return "expired";
    }
    return "offline";
  } catch {
    return "offline";
  }
}

export function setRequirePassword(id: string, value: boolean) {
  save(listAccounts().map((a) => (a.id === id ? { ...a, requirePassword: value } : a)));
}

/** Entra en una cuenta protegida con su contraseña. */
export async function signInSavedAccount(id: string, password: string): Promise<SwitchResult | "wrong"> {
  const target = listAccounts().find((a) => a.id === id);
  if (!target) return "expired";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  const { data: current } = await supabase.auth.getSession();
  if (current.session && current.session.user.id !== id) rememberSession(current.session);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: target.email, password });
    if (data.session && !error) { rememberSession(data.session); return "ok"; }
    return "wrong";
  } catch {
    return "offline";
  }
}

function markExpired(id: string) {
  save(listAccounts().map((a) => (a.id === id ? { ...a, expired: true } : a)));
}

/** Deja la cuenta activa guardada y sale solo en este dispositivo, sin revocar su sesión. */
export async function prepareAnotherAccount() {
  const { data } = await supabase.auth.getSession();
  if (data.session) rememberSession(data.session);
  await supabase.auth.signOut({ scope: "local" });
}

/** Abre «¿Quién entrena?» desde cualquier sitio (avatar mantenido, menú del Mac). */
export const OPEN_ACCOUNT_PICKER = "autopilot:open-account-picker";
export function openAccountPicker() {
  window.dispatchEvent(new Event(OPEN_ACCOUNT_PICKER));
}
