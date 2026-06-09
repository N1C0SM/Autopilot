import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Daily cron. Sends reminder to trialing users whose trial ends in ~2 days or ~1 day.
// Idempotency key encodes user + day-bucket so a user receives at most one email per bucket.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const now = Date.now();
    // Look at all trialing users with a subscription_end in the future
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("user_id, email, name, subscription_end")
      .eq("subscription_status", "trialing")
      .not("subscription_end", "is", null);

    if (error) throw error;

    let sent = 0;
    const results: any[] = [];

    for (const p of rows ?? []) {
      if (!p.email || !p.subscription_end) continue;
      const endMs = new Date(p.subscription_end).getTime();
      const hoursLeft = (endMs - now) / 36e5;
      let daysLeft: number | null = null;
      // Day-2 window: 36-60h left  ·  Day-1 window: 12-36h left
      if (hoursLeft > 36 && hoursLeft <= 60) daysLeft = 2;
      else if (hoursLeft > 12 && hoursLeft <= 36) daysLeft = 1;
      if (daysLeft === null) continue;

      const idempotencyKey = `trial-ending-${p.user_id}-d${daysLeft}`;

      const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "trial-ending",
          recipientEmail: p.email,
          idempotencyKey,
          templateData: {
            name: p.name || "",
            daysLeft,
            manageUrl: "https://autopilotplan.com/dashboard?section=settings",
          },
        },
      });

      results.push({ email: p.email, daysLeft, ok: !sendErr, err: sendErr?.message });
      if (!sendErr) sent++;
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