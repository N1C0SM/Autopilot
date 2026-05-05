import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const MUSCLE_GROUPS = ["Pecho","Espalda","Hombros","Bíceps","Tríceps","Piernas","Glúteos","Core","Cardio","Cuerpo completo","Isquiotibiales","Gemelos","Antebrazos","Trapecios","Romboides","Lumbares","Serrato","Aductores","Abductores","Cuello"];
const EXERCISE_TYPES = ["Calistenia","Gimnasio","Mixto"];
const MOVEMENT_PATTERNS = ["Empuje","Tirón","Sentadilla","Bisagra","Core"];
const STIMULUS_TYPES = ["Fuerza","Hipertrofia","Resistencia","Isométrico"];
const LOAD_LEVELS = ["Alta","Media","Baja"];
const FATIGUE_LEVELS = ["Alta","Media","Baja"];
const SKILL_TAGS = ["handstand","muscle_up","planche","front_lever","back_lever","human_flag","pistol_squat","press_banca","sentadilla","peso_muerto","press_militar","dominadas","l_sit","ring_dips","one_arm_pull_up","one_arm_push_up","dragon_flag","manna"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = `Eres un experto en biomecánica y entrenamiento (gimnasio + calistenia). Clasificas ejercicios en metadatos estructurados. Responde SIEMPRE llamando la función classify_exercise con valores EXACTOS de los enums. Si no estás seguro de skill_tag o progression_order, devuélvelos como null.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Clasifica este ejercicio: "${name}"` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_exercise",
            description: "Devuelve los metadatos del ejercicio",
            parameters: {
              type: "object",
              properties: {
                muscle_group: { type: "string", enum: MUSCLE_GROUPS },
                exercise_type: { type: "string", enum: EXERCISE_TYPES },
                movement_pattern: { type: "string", enum: MOVEMENT_PATTERNS },
                level: { type: "integer", enum: [1,2,3], description: "1=Básico, 2=Intermedio, 3=Avanzado" },
                priority: { type: "integer", enum: [1,2,3], description: "1=Base (compuesto principal), 2=Desarrollo, 3=Accesorio" },
                stimulus_type: { type: "string", enum: STIMULUS_TYPES },
                load_level: { type: "string", enum: LOAD_LEVELS },
                fatigue_level: { type: "string", enum: FATIGUE_LEVELS },
                recommended_order: { type: "integer", enum: [1,2,3], description: "1=Inicio sesión, 2=Medio, 3=Final" },
                skill_tag: { type: ["string","null"], enum: [...SKILL_TAGS, null] },
                progression_order: { type: ["integer","null"], description: "1=más fácil de la skill" },
              },
              required: ["muscle_group","exercise_type","movement_pattern","level","priority","stimulus_type","load_level","fatigue_level","recommended_order"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify_exercise" } },
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
    const parsed = JSON.parse(args);
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});