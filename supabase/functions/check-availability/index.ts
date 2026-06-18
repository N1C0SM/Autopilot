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
