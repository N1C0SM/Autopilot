import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CYCLE_WEEKS = 12;
const DAY_MS = 86400000;

const weekOf = (cycleStart: string, now: number): number | null => {
  const start = new Date(`${cycleStart}T00:00:00Z`).getTime();
  if (Number.isNaN(start)) return null;
  const days = Math.floor((now - start) / DAY_MS);
  if (days < 0) return null;
  return Math.floor(days / 7) + 1;
};

const endDateOf = (cycleStart: string): Date =>
  new Date(new Date(`${cycleStart}T00:00:00Z`).getTime() + CYCLE_WEEKS * 7 * DAY_MS);

// Daily cron for the 12-week Transformación cycle:
//  - week >= 11 with no decision and prompt shown 3+ days ago -> reminder email (once)
//  - week >= 12 with no decision -> fallback decision "completo" (never auto-renews 299€)
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  // Authorized either with the service role key or with the internal cron token.
  const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const providedSecret = req.headers.get("x-cron-secret") || "";
  let isAuthorized = Boolean(bearer && serviceKey && bearer === serviceKey);
  if (!isAuthorized && providedSecret) {
    const { data: tokenRow } = await supabase
      .from("cron_tokens")
      .select("token")
      .eq("name", "renewal-cycle-check")
      .maybeSingle();
    isAuthorized = Boolean(tokenRow?.token && tokenRow.token === providedSecret);
  }
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const now = Date.now();
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("user_id, email, name, cycle_start_date, renewal_decision, renewal_prompt_shown_at, renewal_reminder_sent_at")
      .eq("subscription_tier", "transform")
      .is("renewal_decision", null)
      .not("cycle_start_date", "is", null);

    if (error) throw error;

    let reminders = 0;
    let fallbacks = 0;
    const results: any[] = [];

    for (const p of rows ?? []) {
      const start = p.cycle_start_date as string;
      const week = weekOf(start, now);
      if (week === null) continue;

      // Fallback at week 12: always Completo, never an unconfirmed 299€ renewal.
      if (week >= CYCLE_WEEKS) {
        const { error: updErr } = await supabase
          .from("profiles")
          .update({
            renewal_decision: "completo",
            renewal_decision_at: new Date().toISOString(),
          })
          .eq("user_id", p.user_id);
        if (!updErr) fallbacks++;
        results.push({ user_id: p.user_id, action: "fallback_completo", ok: !updErr });
        continue;
      }

      if (week < 11 || !p.email) continue;

      const shownAt = p.renewal_prompt_shown_at ? new Date(p.renewal_prompt_shown_at).getTime() : null;
      const noAnswerFor3Days = shownAt !== null && now - shownAt >= 3 * DAY_MS;
      if (!noAnswerFor3Days || p.renewal_reminder_sent_at) continue;

      const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "renewal-no-answer",
          recipientEmail: p.email,
          idempotencyKey: `renewal-no-answer-${p.user_id}-${start}`,
          templateData: {
            name: p.name || "",
            cycleEndDate: endDateOf(start).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            manageUrl: "https://autopilotplan.com/dashboard",
          },
        },
      });

      if (!sendErr) {
        reminders++;
        await supabase
          .from("profiles")
          .update({ renewal_reminder_sent_at: new Date().toISOString() })
          .eq("user_id", p.user_id);
      }
      results.push({ user_id: p.user_id, action: "reminder", ok: !sendErr, err: sendErr?.message });
    }

    return new Response(
      JSON.stringify({ ok: true, candidates: rows?.length ?? 0, reminders, fallbacks, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
