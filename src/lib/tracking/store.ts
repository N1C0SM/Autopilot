import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import type { Session } from "./model";
type Table<R> = {
  Row: { [K in keyof R]: R[K] };
  Insert: { [K in keyof R]: R[K] };
  Update: Partial<R>;
  Relationships: [];
};
interface TrackingDatabase {
  public: {
    Tables: {
      workout_sessions: Table<Session>;
      training_target_adjustments: Table<{
        id: string;
        user_id: string;
        session_id: string;
        exercise_key: string;
        target_kg: number;
        actor_id: string;
        reason: string;
        created_at: string;
      }>;
      session_adjustments: Table<{
        id: string;
        session_id: string;
        user_id: string;
        actor_id: string;
        reason: string;
        created_at: string;
      }>;
      nutrition_entries: Table<{
        id: string;
        user_id: string;
        local_date: string;
        payload: Json;
      }>;
    };
    Views: Record<never, never>;
    Functions: {
      approve_training_target: {
        Args: {
          p_id: string;
          p_session: string;
          p_exercise_key: string;
          p_kg: number;
          p_reason: string;
        };
        Returns: undefined;
      };
      save_workout_session: {
        Args: {
          p_session: Json;
          p_expected: number;
          p_mutation: string;
          p_reason: string;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
  };
}
// Same authenticated client and storage, schema extension for this additive migration.
export const trackingDb =
  supabase as unknown as SupabaseClient<TrackingDatabase>;
export async function loadSessions(user: string) {
  const rows: Session[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await trackingDb
      .from("workout_sessions")
      .select("*")
      .eq("user_id", user)
      .order("local_date", { ascending: false })
      .order("id")
      .range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export interface Pending {
  session: Session;
  mutation: string;
  reason: string;
}
export const draftKey = (user: string) => `autopilot:session:v1:${user}`;
export function readDraft(user: string): Pending | null {
  const raw = localStorage.getItem(draftKey(user));
  if (!raw) return null;
  const p = JSON.parse(raw) as Pending;
  return p.session?.user_id === user &&
    Array.isArray(p.session.payload?.exercises)
    ? p
    : null;
}
export function writeDraft(p: Pending) {
  localStorage.setItem(draftKey(p.session.user_id), JSON.stringify(p));
}
export async function saveSession(p: Pending): Promise<Session> {
  const { data, error } = await trackingDb.rpc("save_workout_session", {
    p_session: JSON.parse(JSON.stringify(p.session)),
    p_expected: p.session.revision,
    p_mutation: p.mutation,
    p_reason: p.reason,
  });
  if (error) throw error;
  return data as unknown as Session;
}
