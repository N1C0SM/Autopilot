import { supabase } from "@/integrations/supabase/client";

/** Admin-only list of accounts excluded from metrics (founder test accounts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("metrics_excluded_users");

export async function listTestAccountIds(): Promise<Set<string>> {
  const { data } = await table().select("user_id");
  return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
}

export async function isTestAccount(userId: string): Promise<boolean> {
  const { data } = await table().select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function setTestAccount(userId: string, on: boolean): Promise<{ error: unknown }> {
  return on ? table().insert({ user_id: userId }) : table().delete().eq("user_id", userId);
}
