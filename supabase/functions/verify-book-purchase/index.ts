import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.session_id === "string" ? body.session_id.trim() : "";
    const ref = typeof body?.ref === "string" ? body.ref.trim() : "";

    if (!sessionId.startsWith("cs_") || sessionId.length > 300) {
      return new Response(JSON.stringify({ error: "Sesión de pago no válida." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }
    if (ref && (!ref.startsWith("book-") || !UUID_RE.test(ref.slice(5)))) {
      return new Response(JSON.stringify({ error: "Referencia de compra no válida." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }


    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: settings } = await supabaseAdmin.from("settings").select("payment_mode").limit(1).single();
    const mode = settings?.payment_mode === "live" ? "live" : "test";

    const keys: Array<[string, string | undefined]> = [
      [mode, mode === "live" ? Deno.env.get("STRIPE_LIVE_SECRET_KEY") : Deno.env.get("STRIPE_TEST_SECRET_KEY")],
      [mode === "live" ? "test" : "live", mode === "live" ? Deno.env.get("STRIPE_TEST_SECRET_KEY") : Deno.env.get("STRIPE_LIVE_SECRET_KEY")],
    ];

    let session: any = null;
    for (const [name, key] of keys) {
      if (!key) continue;
      try {
        const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
        const s = await stripe.checkout.sessions.retrieve(sessionId);
        if (s && !s.error) { session = s; break; }
      } catch {
        // try next key
      }
    }

    if (!session) {
      return new Response(JSON.stringify({ error: "No hemos encontrado el pago. Vuelve a intentarlo en unos segundos." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404,
      });
    }

    if (session.client_reference_id !== ref) {
      return new Response(JSON.stringify({ error: "El pago no corresponde a esta compra." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
      });
    }
    if (session.status !== "complete" || session.payment_status !== "paid") {
      return new Response(JSON.stringify({ error: "El pago todavía no está confirmado. Espera unos segundos e inténtalo de nuevo." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409,
      });
    }

    const { data: book } = await supabaseAdmin
      .from("library_books")
      .select("id, title, kind, price, file_path, published, is_folder")
      .eq("id", bookId)
      .maybeSingle();

    if (!book || !book.published || book.is_folder) {
      return new Response(JSON.stringify({ error: "El producto ya no está disponible." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404,
      });
    }

    let fileUrl: string | null = null;
    if (book.file_path) {
      const { data: signed } = await supabaseAdmin.storage.from("library").createSignedUrl(book.file_path, 86400);
      fileUrl = signed?.signedUrl ?? null;
    }

    return new Response(
      JSON.stringify({ title: book.title, kind: book.kind, price: book.price, file_url: fileUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Error verificando el pago." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
