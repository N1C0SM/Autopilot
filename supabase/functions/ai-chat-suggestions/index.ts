import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { lastUserMessage, history, context } = await req.json();
    if (!lastUserMessage || typeof lastUserMessage !== "string") {
      return new Response(JSON.stringify({ error: "lastUserMessage required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = `Eres Nicolás, entrenador personal humano de Autopilot. Responde por chat al cliente en español, en tono cercano, breve (máx 3 frases), profesional y empático. Si el usuario menciona dolor/lesión: ofrece sustituir ejercicio y bajar carga. Si pide cambio de horario: confirma que reorganizas la semana. Si pregunta nutrición: da pauta concreta. Genera 3 respuestas alternativas distintas (corta, completa, motivadora). Devuelve SIEMPRE llamando la función suggest_replies.`;

    const messages: any[] = [{ role: "system", content: sys }];
    if (context) messages.push({ role: "system", content: `Contexto del cliente: ${context}` });
    if (Array.isArray(history)) {
      for (const m of history.slice(-6)) {
        if (m?.role && m?.content) messages.push({ role: m.role, content: m.content });
      }
    }
    messages.push({ role: "user", content: lastUserMessage });

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{
          type: "function",
          function: {
            name: "suggest_replies",
            description: "Devuelve 3 respuestas alternativas para el entrenador",
            parameters: {
              type: "object",
              properties: {
                replies: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string", description: "Etiqueta corta: Corta, Completa o Motivadora" },
                      text: { type: "string", description: "Texto del mensaje listo para enviar" },
                    },
                    required: ["label", "text"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["replies"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_replies" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit, intenta en unos segundos" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Sin créditos de IA" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("ai gateway", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("no tool call");
    return new Response(args, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});