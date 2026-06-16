import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Daily cron. Sends lifecycle emails to unpaid users at D+1 / D+3 / D+5 after signup.
// Idempotent via profiles.lifecycle_emails_sent (text[]) so a user receives each at most once.
const BUCKETS: { days: number; template: string; marker: string }[] = [
  { days: 1, template: "lifecycle-d1", marker: "d1" },
  { days: 3, template: "lifecycle-d3", marker: "d3" },
  { days: 5, template: "lifecycle-d5", marker: "d5" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const now = Date.now();
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("user_id, email, name, created_at, payment_status, lifecycle_emails_sent")
      .eq("payment_status", "unpaid")
      .gte("created_at", new Date(now - 8 * 24 * 3600 * 1000).toISOString());
    if (error) throw error;

    const results: any[] = [];
    let sent = 0;

    for (const p of rows ?? []) {
      if (!p.email) continue;
      const ageDays = (now - new Date(p.created_at as string).getTime()) / 86_400_000;
      const already: string[] = (p as any).lifecycle_emails_sent ?? [];

      for (const b of BUCKETS) {
        // Send when the user has crossed the bucket day mark (with ~24h window) and hasn't received it yet
        if (ageDays < b.days || ageDays >= b.days + 1.1) continue;
        if (already.includes(b.marker)) continue;

        const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: b.template,
            recipientEmail: p.email,
            idempotencyKey: `${b.template}-${p.user_id}`,
            templateData: {
              name: p.name || "",
              ctaUrl: "https://autopilotplan.com/dashboard?section=settings",
            },
          },
        });

        if (!sendErr) {
          sent++;
          await supabase
            .from("profiles")
            .update({ lifecycle_emails_sent: [...already, b.marker] } as any)
            .eq("user_id", p.user_id);
          already.push(b.marker);
        }
        results.push({ email: p.email, marker: b.marker, ok: !sendErr, err: sendErr?.message });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, candidates: rows?.length ?? 0, sent, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});