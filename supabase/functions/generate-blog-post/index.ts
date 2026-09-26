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

    const body = await req.json().catch(() => ({}));
    const topic = String(body?.topic || "").trim();
    const audience = String(body?.audience || "").trim();
    if (!topic) return json({ error: "Falta el tema del artículo" }, 400);

    const prompt = `Escribe un artículo de blog en español de España para Autopilot, un servicio de entrenador personal digital con seguimiento humano real (entrenamiento + nutrición).

Tema: ${topic}
${audience ? `Público objetivo: ${audience}` : ""}

Reglas estrictas:
- No inventes testimonios, clientes, cifras de resultados, estudios concretos ni garantías.
- No des consejos médicos ni diagnósticos; recomienda consultar a un profesional sanitario cuando proceda.
- Nada de urgencia falsa ni escasez inventada.
- Tono claro, directo, premium y honesto. Nada de relleno.
- Longitud: entre 700 y 1100 palabras, con encabezados ## y listas cuando aporten.
- Cierra con una llamada a la acción sobria hacia Autopilot.

Devuelve SOLO un objeto JSON válido, sin texto alrededor y sin bloques de código, con estas claves exactas:
{"title": "...", "excerpt": "...", "body_markdown": "...", "seo_title": "máx 60 caracteres", "seo_description": "máx 160 caracteres"}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error(`AI failed [${r.status}]: ${t}`);
      return json({
        error: r.status === 429 ? "Demasiadas peticiones, prueba en un minuto" :
               r.status === 402 ? "Sin créditos de IA" : "No se pudo generar el artículo",
      }, r.status);
    }
    const d = await r.json();
    const raw = String(d.choices?.[0]?.message?.content || "");
    const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) return json({ error: "Respuesta de IA no válida, vuelve a intentarlo" }, 502);
      parsed = JSON.parse(m[0]);
    }
    return json({
      title: String(parsed.title || topic),
      excerpt: String(parsed.excerpt || ""),
      body_markdown: String(parsed.body_markdown || ""),
      seo_title: String(parsed.seo_title || "").slice(0, 60),
      seo_description: String(parsed.seo_description || "").slice(0, 160),
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Error inesperado generando el artículo" }, 500);
  }
});
