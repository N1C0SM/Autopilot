import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { currentImage, months, goal } = await req.json();
    if (!currentImage) {
      return new Response(JSON.stringify({ error: "Falta la imagen" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const prompt = `Edita esta foto mostrando a la misma persona ${months ?? 6} meses después tras seguir un plan de entrenamiento y nutrición personalizado, con ${goal === "lose_weight" ? "menos grasa corporal y más definición" : goal === "gain_muscle" ? "más masa muscular en hombros, espalda y pecho" : "mejor composición corporal y postura"}. Mantén identidad facial, fondo y pose idénticos. Realista, no caricaturesco.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: currentImage } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Image gen failed:", resp.status, txt);
      throw new Error(`AI gateway ${resp.status}`);
    }

    const data = await resp.json();
    const imgUrl =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
      data?.choices?.[0]?.message?.images?.[0]?.url;

    if (!imgUrl) throw new Error("Sin imagen generada");

    return new Response(JSON.stringify({ imageUrl: imgUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-future-self error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});