const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { goal_url, current_url } = await req.json();
    if (!goal_url || !current_url) {
      return new Response(JSON.stringify({ error: "goal_url and current_url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = `Eres un coach de fitness experto. Comparas dos fotos de un físico: una es el objetivo, la otra es el estado actual del usuario. Estima en porcentaje (0-100) cuánto se parece el actual al objetivo en términos de composición corporal (definición muscular, masa, simetría, % grasa estimado). Sé honesto pero motivador. Responde SIEMPRE llamando a la función compare_physique.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: "Foto 1 = OBJETIVO del usuario. Foto 2 = ESTADO ACTUAL. Compara y devuelve el resultado." },
              { type: "image_url", image_url: { url: goal_url } },
              { type: "image_url", image_url: { url: current_url } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "compare_physique",
            description: "Devuelve la similitud entre el físico actual y el objetivo",
            parameters: {
              type: "object",
              properties: {
                similarity: { type: "integer", description: "Porcentaje 0-100 de cercanía al objetivo" },
                feedback: { type: "string", description: "1-2 frases en español, motivador, qué falta para llegar al objetivo" },
                strengths: { type: "string", description: "Qué ya está cerca del objetivo, en español, 1 frase" },
                gaps: { type: "string", description: "Qué grupos musculares o aspectos hay que mejorar, en español, 1 frase" },
              },
              required: ["similarity", "feedback", "strengths", "gaps"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "compare_physique" } },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[compare-goal-photo] AI error", resp.status, text);
      throw new Error(`AI error ${resp.status}`);
    }
    const json = await resp.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No tool call returned");
    const parsed = JSON.parse(args);
    const sim = Math.max(0, Math.min(100, parseInt(parsed.similarity) || 0));
    return new Response(JSON.stringify({
      similarity: sim,
      feedback: parsed.feedback || "",
      strengths: parsed.strengths || "",
      gaps: parsed.gaps || "",
      congratulate: sim >= 85,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[compare-goal-photo] ERROR:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
