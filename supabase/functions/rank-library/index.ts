import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { books, recommendations } = await req.json();
    const bookList = Array.isArray(books) ? books.slice(0, 24) : [];
    const recoList = Array.isArray(recommendations) ? recommendations.slice(0, 24) : [];
    if (bookList.length === 0 && recoList.length === 0) return json({ error: "Nada que ordenar" }, 400);

    const fmt = (items: any[]) =>
      items.map((b, i) => `${i + 1}. [${b.id}] ${b.title} — ${String(b.description || "").slice(0, 300)}${b.price ? ` (${b.price})` : ""}${b.is_pack ? " [PACK de varios libros]" : ""}`).join("\n");

    const prompt = `Eres experto en conversión de una web de fitness en España. Ordena estos productos de MAYOR a MENOR importancia para mostrar primero en la portada y vender más.

Criterios: el pack completo suele ir primero si existe (mejor ticket medio y anclaje de precio); después, los libros/productos más universales y de entrada (precio bajo, tema amplio como fuerza o nutrición) antes que los avanzados o de nicho (periodización, temas técnicos). En recomendaciones, primero lo más respaldado y básico (creatina, proteína).

LIBROS:
${fmt(bookList) || "ninguno"}

RECOMENDACIONES:
${fmt(recoList) || "ninguna"}

Devuelve los IDs ordenados usando la herramienta.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "rank_items",
            parameters: {
              type: "object",
              properties: {
                book_ids: { type: "array", items: { type: "string" }, description: "IDs de libros ordenados de mayor a menor importancia" },
                recommendation_ids: { type: "array", items: { type: "string" }, description: "IDs de recomendaciones ordenadas" },
                reason: { type: "string", description: "Una frase breve explicando el orden elegido" },
              },
              required: ["book_ids", "recommendation_ids", "reason"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rank_items" } },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error(`AI failed [${r.status}]: ${t}`);
      return json({ error: r.status === 429 ? "Demasiadas peticiones" : r.status === 402 ? "Sin créditos de IA" : "AI error" }, r.status);
    }
    const d = await r.json();
    const args = JSON.parse(d.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "{}");

    // Validar: solo IDs conocidos, sin duplicados; los que falten van al final en su orden original.
    const clean = (ids: unknown, originals: any[]) => {
      const known = new Set(originals.map((b) => b.id));
      const seen = new Set<string>();
      const out: string[] = [];
      for (const id of Array.isArray(ids) ? ids : []) {
        if (typeof id === "string" && known.has(id) && !seen.has(id)) { seen.add(id); out.push(id); }
      }
      for (const b of originals) if (!seen.has(b.id)) out.push(b.id);
      return out;
    };

    return json({
      book_ids: clean(args.book_ids, bookList),
      recommendation_ids: clean(args.recommendation_ids, recoList),
      reason: args.reason || "",
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Error interno" }, 500);
  }
});
