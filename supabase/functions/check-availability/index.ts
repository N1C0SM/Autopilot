import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Per-IP rate limit to prevent email/username enumeration.
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rlKey = `check-availability:${ip}`;
    const WINDOW_SECONDS = 60;
    const LIMIT = 10;
    const sinceIso = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
    const { count } = await supabase
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("key", rlKey)
      .gte("created_at", sinceIso);
    if ((count ?? 0) >= LIMIT) {
      // Fixed-time generic response to avoid signaling.
      await new Promise((r) => setTimeout(r, 400));
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await supabase.from("rate_limits").insert({ key: rlKey });

    // Basic input validation.
    if (email && (typeof email !== "string" || email.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (name && (typeof name !== "string" || name.length > 60)) {
      return new Response(JSON.stringify({ error: "Invalid name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // NOTE: the previous `lookup` mode that returned an email from a username
    // has been removed because it enabled unauthenticated PII enumeration.
    // Login now requires the email address directly.

    // Availability check mode (for signup)
    const result: Record<string, boolean> = {};

    if (name) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("name", name.trim())
        .maybeSingle();
      result.nameTaken = !!data;
    }

    if (email) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email.trim())
        .maybeSingle();
      result.emailTaken = !!data;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
