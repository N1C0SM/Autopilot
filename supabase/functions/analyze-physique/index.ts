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
  estimated_months: z.number().min(0).max(120).optional(),
  improvements: z.preprocess(
    (val) => {
      if (!Array.isArray(val)) return val;
      return val
        .map((item: any) => {
          if (typeof item === "string") return { label: item, priority: "Media" };
          if (!item || typeof item !== "object") return null;
          const label =
            item.label ?? item.point ?? item.area ?? item.title ?? item.name ?? item.text ?? item.description;
          const priority = item.priority ?? item.level ?? item.importance ?? "Media";
          if (!label || typeof label !== "string") return null;
          return { label: String(label), priority: String(priority) };
        })
        .filter(Boolean);
    },
    z.array(z.object({
      label: z.string(),
      priority: z.string(),
    })).min(1).max(6),
  ),
  summary: z.string(),
  percentile: z.number().min(1).max(99).optional(),
  aesthetic_age: z.number().min(14).max(80).optional(),
  months_without_plan: z.number().min(0).max(120).optional(),
  months_with_plan: z.number().min(0).max(120).optional(),
  headline_diagnosis: z.string().optional(),
  bottleneck: z.string().optional(),
  inferred_goal: z.string().optional(),
  inferred_focus: z.string().optional(),
  inferred_intensity: z.number().min(1).max(10).optional(),
  inferred_specific_goals: z.array(z.string()).max(5).optional(),
  locked_insights: z.array(z.object({
    label: z.string(),
    teaser: z.string(),
  })).max(3).optional(),
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
    const { currentImage, backImage, objectiveImage } = await req.json();
    if (!currentImage || !backImage) {
      return new Response(JSON.stringify({ error: "Faltan las fotos de delante y/o atrás" }), {
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
          ? "Analiza la PRIMERA imagen (físico del usuario de FRENTE) y la SEGUNDA imagen (mismo usuario de ESPALDA) como un solo físico, y compáralo con la TERCERA imagen (físico OBJETIVO / referencia). Evalúa cadena posterior (espalda, glúteos, isquios) además de la frontal. DEBES rellenar months_without_plan, months_with_plan y estimated_months porque hay objetivo. Devuelve un análisis honesto pero motivador en español."
          : "Analiza la PRIMERA imagen (físico del usuario de FRENTE) junto con la SEGUNDA imagen (mismo usuario de ESPALDA) como un solo físico. Evalúa cadena posterior (espalda, glúteos, isquios) además de la frontal. NO hay físico objetivo, por lo que NO incluyas months_without_plan, months_with_plan ni estimated_months en el JSON (omítelos por completo). Devuelve un análisis honesto pero motivador en español.",
      },
      { type: "image", image: currentImage },
      { type: "image", image: backImage },
    ];
    if (objectiveImage) {
      userContent.push({ type: "image", image: objectiveImage });
    }

    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        'Eres un coach experto en estética y composición corporal. Analizas fotos como si fueras un scanner profesional con base de datos de miles de físicos reales. SIEMPRE recibes 2 fotos del mismo usuario: la PRIMERA es la vista FRONTAL (pecho, hombros frontales, brazos, abdomen, cuádriceps, simetría frontal) y la SEGUNDA es la vista TRASERA (espalda alta y baja, dorsales, trapecios, glúteos, isquios, gemelos, postura). Opcionalmente puede haber una TERCERA foto que es el físico OBJETIVO de referencia. DEBES evaluar AMBAS vistas con el mismo peso (no ignores la espalda) y combinarlas en un único diagnóstico global. Sé honesto, directo y motivador. Devuelve SOLO JSON válido, sin markdown ni texto extra. Todo en español. SCORES (todos honestos, no inflados, basados en LAS DOS vistas): attractiveness/potential/physique/style 0-10. similarity 0-100 (si NO hay objetivo, pon 0). percentile: en qué percentil del 1-99 está su físico vs población general de su sexo/edad estimados (sé realista: 50 = media, 70 = mejor que la mayoría, 90+ = top). aesthetic_age: edad estética percibida en años (puede ser ±5 vs edad real). REGLA CRÍTICA DE MESES: SOLO incluye months_without_plan, months_with_plan y estimated_months EN EL JSON si hay físico OBJETIVO (tercera foto). Si NO hay objetivo, OMITE ESAS TRES CLAVES por completo (no las pongas, ni a 0). Cuando SÍ hay objetivo: months_without_plan = meses para llegar al objetivo SIN plan estructurado (entre 18 y 60, sé pesimista); months_with_plan = meses con plan personalizado + nutrición (entre 3 y 18, mucho más rápido); estimated_months = months_with_plan. headline_diagnosis: UNA frase contundente que mencione tanto cadena anterior como posterior si aplica. bottleneck: el ÚNICO factor que más le frena, indicando si viene de la vista frontal o de espalda. improvements: 3-5 puntos prioritarios con priority Alta/Media/Baja, INCLUYENDO al menos un punto específico de la vista trasera (espalda/glúteos/postura/isquios) si hay margen ahí. summary: 2-3 frases honestas que mencionen explícitamente lo que ves de frente y lo que ves de espalda. inferred_goal: "lose_weight"|"gain_muscle"|"recomp"|"improve_endurance"|"general_health". inferred_focus: "gimnasio"|"calistenia"|"mixto". inferred_intensity 1-10. inferred_specific_goals: 2-3 metas concretas. locked_insights: 3 insights premium con label corto y teaser intrigante que SOLO se desbloquean con el plan. NO reveles valores en locked_insights.',
      messages: [{ role: "user", content: userContent }],
    });

    const parsed = AnalysisSchema.parse(extractJson(text));

    if (objectiveImage) {
      // Hay objetivo: aseguramos mínimos coherentes.
      if (typeof parsed.months_with_plan === "number") {
        parsed.months_with_plan = Math.max(1, Math.round(parsed.months_with_plan));
      }
      if (typeof parsed.months_without_plan === "number") {
        parsed.months_without_plan = Math.max(
          (parsed.months_with_plan ?? 1) + 1,
          Math.round(parsed.months_without_plan),
        );
      }
      if (typeof parsed.estimated_months === "number") {
        parsed.estimated_months = Math.max(1, Math.round(parsed.estimated_months));
      } else if (typeof parsed.months_with_plan === "number") {
        parsed.estimated_months = parsed.months_with_plan;
      }
    } else {
      // Sin objetivo: no tiene sentido hablar de meses al objetivo. Los borramos.
      delete (parsed as any).months_with_plan;
      delete (parsed as any).months_without_plan;
      delete (parsed as any).estimated_months;
      parsed.similarity = 0;
    }

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