import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { generateText } from "npm:ai";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { z } from "npm:zod";

const AnalysisSchema = z.object({
  attractiveness: z.preprocess((v) => (v == null ? 5 : Number(v)), z.number().min(0).max(10)),
  potential: z.preprocess((v) => (v == null ? 7 : Number(v)), z.number().min(0).max(10)),
  physique: z.preprocess((v) => (v == null ? 5 : Number(v)), z.number().min(0).max(10)),
  style: z.preprocess((v) => (v == null ? 5 : Number(v)), z.number().min(0).max(10)),
  similarity: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().min(0).max(100)),
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
    category: z.string().optional(),
  })).max(10).optional(),

  // ===== Capa clínica nueva — diferencia clara vs ChatGPT =====
  body_composition: z.object({
    body_fat_pct: z.preprocess((v) => (v == null ? undefined : Number(v)), z.number().min(3).max(50).optional()),
    lean_mass_kg: z.preprocess((v) => (v == null ? undefined : Number(v)), z.number().min(20).max(120).optional()),
    weight_kg: z.preprocess((v) => (v == null ? undefined : Number(v)), z.number().min(35).max(180).optional()),
    somatotype: z.string().nullish().transform((v) => v ?? undefined),
    frame_size: z.string().nullish().transform((v) => v ?? undefined),
    fat_distribution: z.string().nullish().transform((v) => v ?? undefined),
  }).partial().optional(),

  muscle_breakdown: z.preprocess(
    (val) => {
      if (val == null) return undefined;
      if (Array.isArray(val)) return val;
      if (typeof val === "object") {
        return Object.entries(val as Record<string, any>).map(([group, v]) => {
          if (v && typeof v === "object") {
            return {
              group: (v as any).group ?? group,
              score: Number((v as any).score ?? 5),
              verdict: String((v as any).verdict ?? (v as any).note ?? ""),
            };
          }
          return { group, score: Number(v) || 5, verdict: "" };
        });
      }
      return val;
    },
    z.array(z.object({
      group: z.string(),
      score: z.number().min(0).max(10),
      verdict: z.string(),
    })).max(12).optional(),
  ),

  posture: z.object({
    issues: z.array(z.string()).max(5).optional(),
    severity: z.string().optional(),        // "leve" | "moderada" | "severa"
    note: z.string().optional(),
  }).partial().optional(),

  proportions: z.object({
    shoulder_to_waist_ratio: z.number().min(1).max(2).optional(), // ~1.4–1.7 ideal
    v_taper_score: z.number().min(0).max(10).optional(),
    symmetry_score: z.number().min(0).max(10).optional(),
    upper_lower_balance: z.string().optional(), // "tren superior dominante"…
    weakest_link: z.string().optional(),
  }).partial().optional(),

  genetic_markers: z.array(z.string()).max(5).optional(),

  protocol: z.object({
    training_days_per_week: z.number().min(2).max(7).optional(),
    weekly_sets_priority: z.number().min(8).max(30).optional(),
    weekly_sets_maintenance: z.number().min(4).max(20).optional(),
    calorie_adjustment_kcal: z.number().min(-1000).max(1000).optional(),
    protein_g_per_kg: z.number().min(1).max(3).optional(),
    cardio_minutes_per_week: z.number().min(0).max(600).optional(),
    key_lifts: z.array(z.string()).max(6).optional(),
    avoid: z.array(z.string()).max(4).optional(),
  }).partial().optional(),
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
        [
          'Eres un scanner profesional de composición corporal y biomecánica con base de datos de miles de físicos reales (culturistas natural, atletas, población general). NO eres ChatGPT: tu valor es la PRECISIÓN CLÍNICA — números concretos, diagnóstico por grupo muscular, postura, proporciones, y un protocolo accionable. Evita generalidades vacías; cada frase debe poder defenderse mirando la foto.',
          'SIEMPRE recibes 2 fotos del mismo usuario: PRIMERA = vista FRONTAL (pecho, deltoides anterior/medial, bíceps, antebrazo, abdomen, oblicuos, cuádriceps, gemelos frontales, simetría frontal). SEGUNDA = vista TRASERA (trapecio sup/medio, dorsales, romboides, deltoides posterior, tríceps, espalda baja, glúteos, isquios, gemelos, postura, asimetrías). Opcional TERCERA = físico OBJETIVO. Pondera AMBAS vistas por igual.',
          'Devuelve SOLO JSON válido, sin markdown ni texto extra. Todo en español neutro.',
          'SCORES honestos (no infles): attractiveness/potential/physique/style 0-10. similarity 0-100 (0 si no hay objetivo). percentile 1-99 vs población general de su sexo/edad estimados (50=media, 75=mejor que 3 de cada 4, 90+=top atlético). aesthetic_age en años.',
          'REGLA DE MESES: incluye months_without_plan / months_with_plan / estimated_months SOLO si hay foto objetivo. Sin objetivo, omite las tres claves. Con objetivo: months_without_plan 18-60 (pesimista), months_with_plan 3-18 (rápido), estimated_months = months_with_plan.',
          'headline_diagnosis: UNA frase contundente que mencione cadena anterior y posterior cuando aplique. bottleneck: el ÚNICO factor que más le frena, indicando si viene de la vista frontal o de espalda. improvements: 3-5 puntos priorizados (Alta/Media/Baja), incluyendo al menos uno de la vista trasera si hay margen. summary: 2-3 frases que mencionen explícitamente lo de frente y lo de espalda.',
          'inferred_goal: "lose_weight"|"gain_muscle"|"recomp"|"improve_endurance"|"general_health". inferred_focus: "gimnasio"|"calistenia"|"mixto". inferred_intensity 1-10. inferred_specific_goals: 2-3 metas concretas. locked_insights: GENERA EXACTAMENTE 8 insights premium SIEMPRE, con label corto (3-5 palabras) y teaser intrigante de 1 frase que abra un loop de curiosidad SIN revelar el valor. Cubre estas 8 categorías obligatoriamente: 1) Ratio calórico exacto, 2) Volumen prioritario semanal, 3) Frecuencia óptima del músculo más débil, 4) Orden de ejercicios, 5) % grasa objetivo realista, 6) Semanas hasta primer hito visible, 7) Predicción de plateau, 8) Cardio mínimo efectivo. Cada item incluye category con uno de: "calorias"|"volumen"|"frecuencia"|"orden"|"grasa"|"hito"|"plateau"|"cardio".',
          '— CAPA CLÍNICA OBLIGATORIA (esto es lo que nos diferencia de ChatGPT, RELLÉNALA SIEMPRE): ',
          'body_composition: { body_fat_pct (rango realista 6-30 hombres, 14-38 mujeres), lean_mass_kg, weight_kg, somatotype ("ectomorfo"/"meso"/"endo" o híbridos), frame_size ("pequeño"/"medio"/"grande" según muñeca/clavícula), fat_distribution ("abdominal","uniforme","tren inferior","cara/cuello"…) }. Estima por proporción visual y sombras musculares; no digas que no puedes estimar.',
          'muscle_breakdown: 6-8 grupos OBLIGATORIOS — "Pecho", "Deltoides", "Espalda alta", "Brazos", "Core/abdomen", "Cuádriceps", "Cadena posterior (glúteo+isquio)", "Gemelos". Cada uno con score 0-10 y verdict de 1 frase específica ("Deltoide medio plano, falta de redondeo lateral evidente desde la frontal").',
          'posture: { issues (lista corta: "hombros adelantados", "cabeza adelantada", "anteversión pélvica", "asimetría hombro D-I", "cifosis dorsal"…), severity ("leve"/"moderada"/"severa"), note (1 frase) }.',
          'proportions: { shoulder_to_waist_ratio (1.0-1.9, ideal estético ~1.6), v_taper_score 0-10, symmetry_score 0-10, upper_lower_balance ("tren superior dominante"/"equilibrado"/"tren inferior dominante"), weakest_link (grupo concreto) }.',
          'genetic_markers: 2-4 strings sobre lo que la genética le DA o le QUITA ("clavículas anchas — ventaja para anchura de espalda", "inserción alta de bíceps — pico difícil de conseguir", "gemelo de inserción corta — limitará tamaño"). Sé honesto.',
          'protocol: { training_days_per_week (3-6), weekly_sets_priority (12-22 para grupo prioritario), weekly_sets_maintenance (6-12), calorie_adjustment_kcal (-500 a +500 según objetivo), protein_g_per_kg (1.6-2.4), cardio_minutes_per_week (60-300), key_lifts (3-5 ejercicios concretos: "Press militar de pie", "Remo Pendlay", "Hip thrust pesado"…), avoid (1-3 errores típicos suyos: "más de 10 min de cardio antes de pierna", "press inclinado >45°"…) }.',
          'Sé clínico y específico. Si dudas entre dos valores, elige el más informativo y razonado; nunca dejes campos vacíos por precaución.',
        ].join(' '),
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