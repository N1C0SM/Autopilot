import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { generateText } from "npm:ai";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { z } from "npm:zod";

const AnalysisSchema = z.object({
  attractiveness: z.number().min(0).max(10),
  potential: z.number().min(0).max(10),
  physique: z.number().min(0).max(10),
  style: z.number().min(0).max(10),
  similarity: z.number().min(0).max(100),
  estimated_months: z.number().min(0).max(120),
  improvements: z.array(z.object({
    label: z.string(),
    priority: z.string(),
  })).min(1).max(6),
  summary: z.string(),
});

const createLovableAiGatewayProvider = (lovableApiKey: string) =>
  createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

const extractJson = (text: string) => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Sin resultado del análisis");
  return JSON.parse(cleaned.slice(start, end + 1));
};

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
      { type: "image", image: currentImage },
    ];
    if (objectiveImage) {
      userContent.push({ type: "image", image: objectiveImage });
    }

    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-pro"),
      system:
        'Eres un coach experto en estética y composición corporal. Analizas fotos para dar feedback útil. Sé honesto pero respetuoso y motivador. Devuelve SOLO JSON válido, sin markdown ni texto extra, con esta forma exacta: {"attractiveness":0,"potential":0,"physique":0,"style":0,"similarity":0,"estimated_months":0,"improvements":[{"label":"","priority":"Alta"}],"summary":""}. Todo el texto debe estar en español. attractiveness, potential, physique y style van de 0 a 10; similarity de 0 a 100; estimated_months son meses estimados; priority debe ser Alta, Media o Baja; summary en 2-3 frases.',
      messages: [{ role: "user", content: userContent }],
    });

    const parsed = AnalysisSchema.parse(extractJson(text));

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