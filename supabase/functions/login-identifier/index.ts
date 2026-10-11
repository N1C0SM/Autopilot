import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Signs in with username + password server-side so the email behind a username is never returned.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { identifier, password } = await req.json();
    if (typeof identifier !== "string" || typeof password !== "string" || !identifier.trim() || identifier.length > 320 || password.length > 200) {
      return json({ error: "invalid" }, 400);
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rlKey = `login-identifier:${ip}`;
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from("rate_limits").select("id", { count: "exact", head: true }).eq("key", rlKey).gte("created_at", since);
    if ((count ?? 0) >= 8) return json({ error: "rate_limited" }, 429);
    await admin.from("rate_limits").insert({ key: rlKey });

    let email = identifier.trim();
    if (!email.includes("@")) {
      const { data } = await admin.from("profiles").select("email").ilike("name", email).limit(2);
      if (!data || data.length !== 1) return json({ error: "invalid_credentials" }, 401);
      email = data[0].email;
    }
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      const notConfirmed = error?.message?.includes("Email not confirmed");
      return json({ error: notConfirmed ? "email_not_confirmed" : "invalid_credentials" }, 401);
    }
    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch {
    return json({ error: "server" }, 500);
  }
});
