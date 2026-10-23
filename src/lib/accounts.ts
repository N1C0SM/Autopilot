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
  if (i >= 0) list[i] = account; else list.push(account);
  save(list);
}

export function forgetAccount(id: string) {
  save(listAccounts().filter((a) => a.id !== id));
}

/** Entra en otra cuenta guardada. Devuelve false si su sesión ya no vale (hay que volver a entrar). */
export async function switchToAccount(id: string): Promise<boolean> {
  const target = listAccounts().find((a) => a.id === id);
  if (!target) return false;
  const { data: current } = await supabase.auth.getSession();
  if (current.session) rememberSession(current.session);
  const { data, error } = await supabase.auth.setSession({ access_token: target.accessToken, refresh_token: target.refreshToken });
  if (error || !data.session) {
    forgetAccount(id);
    return false;
  }
  rememberSession(data.session);
  return true;
}

/** Deja la cuenta activa guardada y sale solo en este dispositivo, sin revocar su sesión. */
export async function prepareAnotherAccount() {
  const { data } = await supabase.auth.getSession();
  if (data.session) rememberSession(data.session);
  await supabase.auth.signOut({ scope: "local" });
}
