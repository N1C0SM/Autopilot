import { createClient } from "npm:@supabase/supabase-js@2";

/** Devuelve el usuario autenticado (id, email) o null si la petición no trae una sesión válida. */
export async function getAuthedUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (anon && token === anon) return null;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, anon || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
