import { errorMessage } from "../_shared/runtime-values.ts";
import { bookIdFromReference, bookPaymentMatches } from "../_shared/book-purchase.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  headers: { ...corsHeaders, "Content-Type": "application/json" }, status,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.session_id === "string" ? body.session_id.trim() : "";
    const ref = typeof body?.ref === "string" ? body.ref.trim() : "";
    if (!sessionId.startsWith("cs_") || sessionId.length <= 3 || sessionId.length > 300) {
      return json({ error: "Falta una sesión válida de Stripe. Si ya has pagado, contacta con nosotros con tu recibo." }, 400);
    }
    if (ref && !bookIdFromReference(ref)) return json({ error: "Referencia de compra no válida." }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: settings, error: settingsError } = await supabaseAdmin.from("settings").select("payment_mode").limit(1).single();
    if (settingsError || !settings) throw settingsError || new Error("Payment configuration unavailable");
    const mode = settings.payment_mode === "live" ? "live" : "test";
    const keys = [...new Set([
      mode === "live" ? Deno.env.get("STRIPE_LIVE_SECRET_KEY") : Deno.env.get("STRIPE_TEST_SECRET_KEY"),
      Deno.env.get("STRIPE_SECRET_KEY"),
    ].filter((key): key is string => !!key))];

    let session: Stripe.Checkout.Session | null = null;
    let stripe: Stripe | null = null;
    for (const key of keys) {
      try {
        const candidate = new Stripe(key, { apiVersion: "2025-08-27.basil" });
        const retrieved = await candidate.checkout.sessions.retrieve(sessionId);
        if (retrieved.livemode !== (mode === "live")) continue;
        session = retrieved;
        stripe = candidate;
        break;
      } catch (error) {
        console.log("verify-book Stripe lookup failed", errorMessage(error));
      }
    }
    if (!session || !stripe) return json({ error: "No hemos encontrado esta sesión de pago." }, 404);
    if (session.mode === "subscription") return json({ kind: "subscription" });
    if (session.mode !== "payment" || session.status !== "complete" || session.payment_status !== "paid") {
      return json({ error: "El pago todavía no está confirmado. Espera unos segundos e inténtalo de nuevo." }, 409);
    }

    // Never search recent sales or replace a session's reference with browser data.
    const sessionRef = session.client_reference_id || "";
    const resolvedRef = sessionRef || ref;
    const bookId = bookIdFromReference(resolvedRef);
    if (!bookId || (ref && ref !== resolvedRef)) return json({ error: "El pago no corresponde a esta compra." }, 403);
    const { data: book, error: bookError } = await supabaseAdmin.from("library_books")
      .select("id, title, kind, price, file_path, published, is_folder, buy_url, buy_url_test, buy_url_live")
      .eq("id", bookId).maybeSingle();
    if (bookError) throw bookError;
    if (!book || !book.published || book.is_folder) return json({ error: "El producto ya no está disponible." }, 404);

    const paymentLinkId = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;
    if (!paymentLinkId) return json({ error: "No se puede vincular el pago con este producto." }, 403);
    const paymentLink = await stripe.paymentLinks.retrieve(paymentLinkId);
    const configuredUrls = [mode === "live" ? book.buy_url_live : book.buy_url_test, book.buy_url];
    if (!bookPaymentMatches(session, mode, bookId, ref, paymentLink.url, configuredUrls)) {
      return json({ error: "El pago no corresponde a este producto." }, 403);
    }

    let fileUrl: string | null = null;
    if (book.file_path) {
      const { data: signed, error: signingError } = await supabaseAdmin.storage.from("library").createSignedUrl(book.file_path, 86400);
      if (signingError) throw signingError;
      fileUrl = signed?.signedUrl ?? null;
    }
    return json({ title: book.title, kind: book.kind, price: book.price, file_url: fileUrl });
  } catch (error) {
    console.error("verify-book verification failed", errorMessage(error));
    return json({ error: "Error verificando el pago." }, 500);
  }
});
