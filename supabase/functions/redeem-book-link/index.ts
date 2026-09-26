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
    const { data: item } = await db.from("library_books")
      .select("title, file_path, kind, is_pack, pack_items").eq("id", link.book_id).maybeSingle();
    if (!item) return json({ error: "Enlace no válido." }, 404);

    const isPack = item.kind === "pack" || item.is_pack;
    let files: { title: string; file_path: string }[] = [];
    if (isPack) {
      const ids: string[] = item.pack_items || [];
      if (ids.length) {
        const { data: bs } = await db.from("library_books").select("id, title, file_path").in("id", ids);
        files = (bs || []).filter((b) => b.file_path).map((b) => ({ title: b.title, file_path: b.file_path! }));
      }
    } else if (item.file_path) {
      files = [{ title: item.title, file_path: item.file_path }];
    }
    if (!files.length) return json({ error: "Todavía no hay PDF disponible. Inténtalo más tarde." }, 404);

    // Atomic claim: only succeeds once.
    const { data: claimed } = await db
      .from("book_share_links")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token).is("used_at", null).gt("expires_at", new Date().toISOString())
      .select("book_id").maybeSingle();
    if (!claimed) return json({ error: "Este enlace ya se ha usado o ha caducado." }, 410);

    const out: { title: string; url: string }[] = [];
    for (const f of files) {
      const { data: s } = await db.storage.from("library")
        .createSignedUrl(f.file_path, isPack ? 900 : 60, { download: `${f.title}.pdf` });
      if (s?.signedUrl) out.push({ title: f.title, url: s.signedUrl });
    }
    if (!out.length) return json({ error: "No se pudo preparar la descarga." }, 500);
    return json({ title: item.title, url: out[0].url, files: out, pack: isPack });
  } catch {
    return json({ error: "Error preparando la descarga." }, 500);
  }
});
