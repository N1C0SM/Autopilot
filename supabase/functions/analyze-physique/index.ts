import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { generateText } from "npm:ai";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { z } from "npm:zod";
import { jsonrepair } from "npm:jsonrepair@3";

// El modelo a veces devuelve "12-15%", "~14", "no estimable" o null.
// Extraemos el primer número válido; si no hay ninguno → undefined.
const toNum = (v: unknown): number | undefined => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
    if (!m) return undefined;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};
const optNum = (schema: z.ZodTypeAny) => z.preprocess((v) => toNum(v), schema.optional());
const reqNum = (fallback: number, schema: z.ZodTypeAny) =>
  z.preprocess((v) => toNum(v) ?? fallback, schema);

// Recorta al rango permitido en vez de fallar si el modelo se sale.
const clampNum = (min: number, max: number) =>
  z.preprocess((v) => {
    const n = toNum(v);
    if (n == null) return undefined;
    return Math.min(max, Math.max(min, n));
  }, z.number().min(min).max(max).optional());

const AnalysisSchema = z.object({
  attractiveness: reqNum(5, z.number().min(0).max(10)),
  potential: reqNum(7, z.number().min(0).max(10)),
  physique: reqNum(5, z.number().min(0).max(10)),
  style: reqNum(5, z.number().min(0).max(10)),
  similarity: reqNum(0, z.number().min(0).max(100)),
  estimated_months: optNum(z.number().min(0).max(120)),
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
    })).max(6).default([]),
  ),
  summary: z.string(),
  confidence: clampNum(0, 100),
  views_detected: z.array(z.string()).max(3).optional(),
  photo_quality_notes: z.array(z.string()).max(4).optional(),
  months_without_plan: optNum(z.number().min(0).max(120)),
  months_with_plan: optNum(z.number().min(0).max(120)),
  headline_diagnosis: z.string().optional(),
  bottleneck: z.string().optional(),
  inferred_goal: z.string().optional(),
  inferred_focus: z.string().optional(),
  inferred_intensity: clampNum(1, 10),
  inferred_specific_goals: z.array(z.string()).max(5).optional(),
  locked_insights: z.array(z.object({
    label: z.string(),
    teaser: z.string(),
    category: z.string().optional(),
  })).max(10).optional(),

  // ===== Capa clínica nueva — diferencia clara vs ChatGPT =====
  body_composition: z.object({
    body_fat_pct: clampNum(3, 50),
    lean_mass_kg: clampNum(20, 120),
    weight_kg: clampNum(35, 180),
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
              score: toNum((v as any).score) ?? 5,
              verdict: String((v as any).verdict ?? (v as any).note ?? ""),
            };
          }
          return { group, score: toNum(v) ?? 5, verdict: "" };
        });
      }
      return val;
    },
    z.array(z.object({
      group: z.string(),
      score: reqNum(5, z.number().min(0).max(10)),
      verdict: z.string().nullish().transform((v) => v ?? ""),
    })).max(12).optional(),
  ),

  posture: z.object({
    issues: z.array(z.string()).max(5).optional(),
    severity: z.string().optional(),        // "leve" | "moderada" | "severa"
    note: z.string().optional(),
  }).partial().optional(),

  proportions: z.object({
    shoulder_to_waist_ratio: clampNum(1, 2), // ~1.4–1.7 ideal
    v_taper_score: clampNum(0, 10),
    symmetry_score: clampNum(0, 10),
    upper_lower_balance: z.string().optional(), // "tren superior dominante"…
    weakest_link: z.string().optional(),
  }).partial().optional(),

  genetic_markers: z.array(z.string()).max(5).optional(),

  protocol: z.object({
    training_days_per_week: clampNum(2, 7),
    weekly_sets_priority: clampNum(8, 30),
    weekly_sets_maintenance: clampNum(4, 20),
    calorie_adjustment_kcal: clampNum(-1000, 1000),
    protein_g_per_kg: clampNum(1, 3),
    cardio_minutes_per_week: clampNum(0, 600),
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

// Repara JSON cortado a medias (respuesta truncada): elimina el último fragmento
// incompleto y cierra las llaves/corchetes que queden abiertos.
const repairJson = (raw: string) => {
  let inStr = false, esc = false;
  const stack: string[] = [];
  let lastSafe = -1;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") stack.pop();
    if (!inStr && (c === "}" || c === "]" || c === ",")) lastSafe = i;
  }
  let out = raw;
  if (lastSafe >= 0) {
    out = raw.slice(0, raw[lastSafe] === "," ? lastSafe : lastSafe + 1);
    // Recalculamos la pila sobre el trozo recortado.
    return repairClose(out);
  }
  return repairClose(out);
};

const repairClose = (s: string) => {
  let inStr = false, esc = false;
  const stack: string[] = [];
  for (const c of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  return s + stack.reverse().join("");
};

const extractJson = (text: string) => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("Sin resultado del análisis");
  const end = cleaned.lastIndexOf("}");
  const candidate = end > start ? cleaned.slice(start, end + 1) : cleaned.slice(start);
  const attempts: Array<() => unknown> = [
    () => JSON.parse(candidate),
    () => JSON.parse(jsonrepair(candidate)),
    () => JSON.parse(jsonrepair(cleaned.slice(start))),
    () => JSON.parse(repairJson(cleaned.slice(start))),
    () => JSON.parse(jsonrepair(repairJson(cleaned.slice(start)))),
  ];
  let lastErr: unknown;
  for (const a of attempts) {
    try { return a(); } catch (e) { lastErr = e; }
  }
  throw lastErr;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Per-IP rate limit to prevent AI credit exhaustion.
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const key = `analyze-physique:${ip}`;
    const windowSec = 3600;
    const limit = 8;
    const sinceIso = new Date(Date.now() - windowSec * 1000).toISOString();
    const { count } = await sb
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("key", key)
      .gte("created_at", sinceIso);
    if ((count ?? 0) >= limit) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await sb.from("rate_limits").insert({ key });

    const { currentImage, backImage, objectiveImage } = await req.json();
    if (!currentImage && !backImage) {
      return new Response(
        JSON.stringify({ error: "Sube al menos una foto (de delante o de atrás) para poder analizarla" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Describimos al modelo, en orden, exactamente qué imágenes recibe.
    const order: string[] = [];
    if (currentImage) order.push("vista FRONTAL del usuario");
    if (backImage) order.push("vista TRASERA del usuario");
    if (objectiveImage) order.push("físico OBJETIVO de referencia (no es el usuario)");

    const viewsText = order.map((d, i) => `imagen ${i + 1}: ${d}`).join("; ");
    const monthsRule = objectiveImage
      ? "Hay físico objetivo: incluye months_without_plan, months_with_plan y estimated_months como ESTIMACIONES aproximadas."
      : "NO hay físico objetivo: omite por completo months_without_plan, months_with_plan y estimated_months, y pon similarity = 0.";
    const coverageRule =
      currentImage && backImage
        ? "Tienes ambas vistas: valora cadena anterior y posterior."
        : currentImage
        ? "SOLO tienes la vista frontal: NO evalúes ni puntúes espalda alta, dorsales, deltoides posterior, glúteos ni isquios. Omite esos grupos de muscle_breakdown en lugar de inventarlos. IMPORTANTE: con esta única vista DEBES cubrir TODOS los grupos frontales visibles (Pecho, Deltoides, Brazos, Core/abdomen, Cuádriceps) — nunca te limites a uno o dos grupos: cada uno con su lectura y su score. Di en summary que falta la vista de espalda."
        : "SOLO tienes la vista trasera: NO evalúes ni puntúes pecho, abdomen, bíceps ni cuádriceps desde delante. Omite esos grupos de muscle_breakdown en lugar de inventarlos. IMPORTANTE: con esta única vista DEBES cubrir TODOS los grupos posteriores visibles (Espalda alta, Dorsales, Deltoides posterior, Tríceps, Cadena posterior glúteo+isquio, Gemelos) — nunca te limites a uno o dos grupos: cada uno con su lectura y su score. Di en summary que falta la vista frontal.";

    const userContent: any[] = [
      {
        type: "text",
        text: `Recibes ${order.length} imagen(es) — ${viewsText}. ${coverageRule} ${monthsRule} Devuelve una orientación visual honesta y útil en español, sin lenguaje médico.`,
      },
    ];
    if (currentImage) userContent.push({ type: "image", image: currentImage });
    if (backImage) userContent.push({ type: "image", image: backImage });
    if (objectiveImage) userContent.push({ type: "image", image: objectiveImage });

    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      maxOutputTokens: 4000,
      system:
        [
          'Eres un scanner profesional de composición corporal y biomecánica con base de datos de miles de físicos reales (culturistas natural, atletas, población general). NO eres ChatGPT: tu valor es la PRECISIÓN CLÍNICA — números concretos, diagnóstico por grupo muscular, postura, proporciones, y un protocolo accionable. Evita generalidades vacías; cada frase debe poder defenderse mirando la foto.',
          'Recibes 1 o 2 fotos del usuario (y opcionalmente una tercera de físico OBJETIVO). El texto del usuario te dice, en orden, qué vista es cada imagen (FRONTAL o TRASERA). FRONTAL: pecho, deltoides anterior/medial, bíceps, abdomen, oblicuos, cuádriceps, simetría frontal. TRASERA: trapecio, dorsales, romboides, deltoides posterior, tríceps, espalda baja, glúteos, isquios, postura. Valora SOLO lo visible en las vistas recibidas; nunca puntúes ni menciones como observado un grupo que no se ve.',
          'Devuelve SOLO JSON válido, sin markdown ni texto extra. Todo en español neutro.',
          'SCORES honestos (no infles): attractiveness/potential/physique/style 0-10. similarity 0-100 (0 si no hay objetivo). NO devuelvas percentile ni aesthetic_age: no son mediciones validadas. confidence 0-100: tu confianza real según número de vistas, luz y calidad (una sola vista o mala luz → máximo 60). views_detected: array con las vistas recibidas y usadas ("frontal", "trasera"). photo_quality_notes: hasta 3 notas si algo limita el análisis (poca luz, lejano, ropa ancha…).',
          'REGLA DE MESES: incluye months_without_plan / months_with_plan / estimated_months SOLO si hay foto objetivo. Sin objetivo, omite las tres claves. Con objetivo: months_without_plan 18-60 (pesimista), months_with_plan 3-18 (rápido), estimated_months = months_with_plan.',
          'headline_diagnosis: UNA frase contundente sobre lo que realmente se ve. bottleneck: el ÚNICO factor que más le frena, indicando de qué vista viene. improvements: 3-5 puntos priorizados (Alta/Media/Baja), solo sobre grupos visibles y repartidos entre grupos DISTINTOS (nunca 3 puntos sobre el mismo grupo). summary: 2-3 frases; si falta una vista, dilo explícitamente ("Vista trasera no disponible: no puedo valorar espalda ni glúteos" o "Vista frontal no disponible: no puedo valorar pecho ni abdomen").',
          'inferred_goal: "lose_weight"|"gain_muscle"|"recomp"|"improve_endurance"|"general_health". inferred_focus: "gimnasio"|"calistenia"|"mixto". inferred_intensity 1-10. inferred_specific_goals: 2-3 metas concretas. locked_insights: GENERA EXACTAMENTE 8 insights premium SIEMPRE, con label corto (3-5 palabras) y teaser intrigante de 1 frase que abra un loop de curiosidad SIN revelar el valor. Cubre estas 8 categorías obligatoriamente: 1) Ratio calórico exacto, 2) Volumen prioritario semanal, 3) Frecuencia óptima del músculo más débil, 4) Orden de ejercicios, 5) % grasa objetivo realista, 6) Semanas hasta primer hito visible, 7) Predicción de plateau, 8) Cardio mínimo efectivo. Cada item incluye category con uno de: "calorias"|"volumen"|"frecuencia"|"orden"|"grasa"|"hito"|"plateau"|"cardio".',
          '— CAPA CLÍNICA OBLIGATORIA (esto es lo que nos diferencia de ChatGPT, RELLÉNALA SIEMPRE): ',
          'body_composition: { body_fat_pct (rango realista 6-30 hombres, 14-38 mujeres), lean_mass_kg, weight_kg, somatotype ("ectomorfo"/"meso"/"endo" o híbridos), frame_size ("pequeño"/"medio"/"grande" según muñeca/clavícula), fat_distribution ("abdominal","uniforme","tren inferior","cara/cuello"…) }. Estima por proporción visual y sombras musculares; no digas que no puedes estimar.',
          'muscle_breakdown: 4-8 grupos, SOLO los visibles en las vistas recibidas, y SIEMPRE cubriendo todos los grupos de cada vista recibida — SOLO frontal: los 5 "Pecho", "Deltoides", "Brazos", "Core/abdomen", "Cuádriceps"; SOLO trasera: "Espalda alta", "Dorsales", "Deltoides posterior", "Tríceps", "Cadena posterior (glúteo+isquio)", "Gemelos"; ambas vistas: 6-8 combinando anteriores y posteriores. PROHIBIDO devolver un único grupo (p. ej. solo "Pecho") cuando la vista recibida permite leer más: cada grupo visible debe aparecer con su score 0-10 y verdict de 1 frase específica ("Deltoide medio plano, falta de redondeo lateral evidente desde la frontal").',
          'posture: { issues (lista corta: "hombros adelantados", "cabeza adelantada", "anteversión pélvica", "asimetría hombro D-I", "cifosis dorsal"…), severity ("leve"/"moderada"/"severa"), note (1 frase) }.',
          'proportions: { shoulder_to_waist_ratio (1.0-1.9, ideal estético ~1.6), v_taper_score 0-10, symmetry_score 0-10, upper_lower_balance ("tren superior dominante"/"equilibrado"/"tren inferior dominante"), weakest_link (grupo concreto) }.',
          'genetic_markers: 2-4 strings sobre lo que la genética le DA o le QUITA ("clavículas anchas — ventaja para anchura de espalda", "inserción alta de bíceps — pico difícil de conseguir", "gemelo de inserción corta — limitará tamaño"). Sé honesto.',
          'protocol: { training_days_per_week (3-6), weekly_sets_priority (12-22 para grupo prioritario), weekly_sets_maintenance (6-12), calorie_adjustment_kcal (-500 a +500 según objetivo), protein_g_per_kg (1.6-2.4), cardio_minutes_per_week (60-300), key_lifts (3-5 ejercicios concretos: "Press militar de pie", "Remo Pendlay", "Hip thrust pesado"…), avoid (1-3 errores típicos suyos: "más de 10 min de cardio antes de pierna", "press inclinado >45°"…) }.',
          'Sé clínico y específico. Si dudas entre dos valores, elige el más informativo y razonado; nunca dejes campos vacíos por precaución.',
        ].join(' '),
      messages: [{ role: "user", content: userContent }],
    });

    const parsed = AnalysisSchema.parse(extractJson(text));

    // Si el modelo no devuelve prioridades usables, derivamos una del diagnóstico.
    if (!parsed.improvements?.length) {
      const fallback =
        parsed.bottleneck ||
        parsed.proportions?.weakest_link ||
        parsed.headline_diagnosis ||
        "Consolidar técnica y constancia";
      parsed.improvements = [{ label: fallback, priority: "Alta" }];
    }


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