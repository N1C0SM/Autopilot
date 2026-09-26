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

    const { title, description, is_pack, others } = await req.json();
    if (!title || typeof title !== "string") return json({ error: "title required" }, 400);

    const prompt = `Sugiere un precio de venta en euros para este ebook/guía PDF de fitness en España (producto digital autodidacta, sin entrenador).
Título: ${title}
Descripción: ${String(description || "").slice(0, 1500)}
Es pack de varios libros: ${is_pack ? "sí" : "no"}
Otros libros de la tienda y sus precios: ${Array.isArray(others) && others.length ? others.slice(0, 20).join("; ") : "ninguno"}
Sé coherente con los otros precios (un pack debe salir más barato que comprarlos sueltos). Usa precios psicológicos (ej. 9,90 €).`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "suggest_price",
            parameters: {
              type: "object",
              properties: {
                price: { type: "string", description: "Formato '14,90 €'" },
                reason: { type: "string", description: "Una frase breve explicando el motivo" },
              },
              required: ["price", "reason"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_price" } },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error(`AI failed [${r.status}]: ${t}`);
      return json({ error: r.status === 429 ? "Demasiadas peticiones" : r.status === 402 ? "Sin créditos de IA" : "AI error" }, r.status);
    }
    const d = await r.json();
    const args = JSON.parse(d.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "{}");
    return json({ price: args.price, reason: args.reason });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
