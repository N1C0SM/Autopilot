import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { currentImage, objectiveImage } = await req.json();
    if (!currentImage) {
      return new Response(JSON.stringify({ error: "Falta la foto actual" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const userContent: any[] = [
      {
        type: "text",
        text: objectiveImage
          ? "Analiza la PRIMERA imagen (físico actual del usuario) y compárala con la SEGUNDA imagen (físico objetivo / referencia). Devuelve un análisis honesto pero motivador en español."
          : "Analiza esta foto del físico del usuario y devuelve un análisis honesto pero motivador en español.",
      },
      { type: "image_url", image_url: { url: currentImage } },
    ];
    if (objectiveImage) {
      userContent.push({ type: "image_url", image_url: { url: objectiveImage } });
    }

    const tool = {
      type: "function",
      function: {
        name: "physique_analysis",
        description: "Análisis del físico",
        parameters: {
          type: "object",
          properties: {
            attractiveness: { type: "number", description: "0-10" },
            potential: { type: "number", description: "0-10 potencial alcanzable en 12 meses" },
            physique: { type: "number", description: "0-10 desarrollo muscular" },
            style: { type: "number", description: "0-10 postura/estilo/proporción" },
            similarity: { type: "number", description: "0-100 similitud al objetivo, 50 si no hay objetivo" },
            estimated_months: { type: "number", description: "Meses estimados para alcanzar objetivo" },
            improvements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  priority: { type: "string", description: "Alta, Media o Baja" },
                },
                required: ["label", "priority"],
              },
            },
            summary: { type: "string", description: "Resumen breve y motivador, 2-3 frases" },
          },
          required: ["attractiveness", "potential", "physique", "style", "similarity", "estimated_months", "improvements", "summary"],
        },
      },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "Eres un coach experto en estética y composición corporal. Analizas fotos para dar feedback útil. Sé honesto pero respetuoso y motivador. Nunca rechaces analizar — siempre devuelve el JSON estructurado.",
          },
          { role: "user", content: userContent },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "physique_analysis" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas peticiones. Inténtalo en un minuto." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Servicio AI sin créditos. Contacta soporte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway ${aiRes.status}`);
    }

    const data = await aiRes.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Sin resultado del análisis");
    const parsed = JSON.parse(args);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analyze-physique error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});