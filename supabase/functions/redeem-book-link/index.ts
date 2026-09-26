import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!/^[0-9a-f]{48}$/.test(token)) return json({ error: "Enlace no válido." }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: link } = await db.from("book_share_links").select("book_id").eq("token", token).maybeSingle();
    if (!link) return json({ error: "Enlace no válido." }, 404);
    const { data: pre } = await db.from("library_books").select("file_path").eq("id", link.book_id).maybeSingle();
    if (!pre?.file_path) return json({ error: "El libro todavía no tiene PDF. Inténtalo más tarde." }, 404);

    // Atomic claim: only succeeds once.
    const { data: claimed } = await db
      .from("book_share_links")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token).is("used_at", null).gt("expires_at", new Date().toISOString())
      .select("book_id").maybeSingle();
    if (!claimed) return json({ error: "Este enlace ya se ha usado o ha caducado." }, 410);

    const { data: book } = await db.from("library_books").select("title, file_path").eq("id", claimed.book_id).maybeSingle();
    if (!book?.file_path) return json({ error: "El libro no tiene PDF todavía." }, 404);

    const { data: signed } = await db.storage.from("library")
      .createSignedUrl(book.file_path, 60, { download: `${book.title}.pdf` });
    if (!signed?.signedUrl) return json({ error: "No se pudo preparar la descarga." }, 500);
    return json({ title: book.title, url: signed.signedUrl });
  } catch {
    return json({ error: "Error preparando la descarga." }, 500);
  }
});
