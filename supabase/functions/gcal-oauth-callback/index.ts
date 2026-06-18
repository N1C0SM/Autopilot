import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function verifyState(stateRaw: string): Promise<{ uid: string; return_to?: string } | null> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!secret) return null;
  const parts = stateRaw.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(sig),
      new TextEncoder().encode(payload),
    );
    if (!ok) return null;
    const json = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)));
    if (!json?.uid || typeof json.uid !== "string") return null;
    // expiry: 10 minutes
    if (typeof json.iat === "number" && Date.now() - json.iat > 10 * 60 * 1000) return null;
    return { uid: json.uid, return_to: json.return_to };
  } catch {
    return null;
  }
}

function safeReturnTo(url: string | undefined): string {
  if (!url) return "/dashboard";
  try {
    // Allow same-origin relative paths only
    if (url.startsWith("/") && !url.startsWith("//")) return url;
    const parsed = new URL(url);
    const allowed = ["autopilotplan.com", "lovable.app", "lovable.dev"];
    if (allowed.some((h) => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
      return parsed.toString();
    }
  } catch {}
  return "/dashboard";
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) return htmlResponse(`<h2>❌ Error</h2><p>${escapeHtml(error)}</p>`);
    if (!code || !stateRaw) return htmlResponse("<h2>❌ Missing code/state</h2>");

    const state = await verifyState(stateRaw);
    if (!state) return htmlResponse("<h2>❌ Estado inválido o expirado</h2>");

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gcal-oauth-callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("gcal token exchange failed", tokenData);
      return htmlResponse(`<h2>❌ Token exchange failed</h2>`);
    }

    const { access_token, refresh_token, expires_in, scope } = tokenData;
    if (!refresh_token) return htmlResponse(`<h2>❌ No refresh_token</h2><p>Revoca el acceso en tu cuenta Google y reintenta.</p>`);

    const expiry = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Defense in depth: ensure the uid corresponds to an existing profile
    const { data: prof } = await admin
      .from("profiles").select("user_id").eq("user_id", state.uid).maybeSingle();
    if (!prof) return htmlResponse("<h2>❌ Usuario desconocido</h2>");

    const { error: dbErr } = await admin.from("google_calendar_tokens").upsert({
      user_id: state.uid,
      access_token,
      refresh_token,
      expiry_at: expiry,
      scope,
      calendar_id: "primary",
    }, { onConflict: "user_id" });

    if (dbErr) {
      console.error("gcal db error", dbErr);
      return htmlResponse(`<h2>❌ Error guardando la conexión</h2>`);
    }

    const returnTo = safeReturnTo(state.return_to);
    return htmlResponse(`
      <h2>✅ Conectado a Google Calendar</h2>
      <p>Volviendo a la app...</p>
      <script>setTimeout(() => { window.location.href = ${JSON.stringify(returnTo)}; }, 1500);</script>
    `);
  } catch (e) {
    console.error("gcal callback error", e);
    return htmlResponse(`<h2>❌ Error inesperado</h2>`);
  }
});

function htmlResponse(body: string) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Google Calendar</title><style>body{font-family:system-ui;max-width:500px;margin:80px auto;padding:24px;text-align:center;}</style></head><body>${body}</body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}