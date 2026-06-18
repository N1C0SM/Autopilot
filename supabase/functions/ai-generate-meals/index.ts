const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Allow authenticated users OR internal service-role callers (generate-plan).
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    let authorized = false;
    if (token && serviceKey && token === serviceKey) {
      authorized = true;
    } else if (token) {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await sb.auth.getUser(token);
      authorized = !!user;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { preferences, allergies, goal, macros, weight } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const totalKcal = (macros?.protein || 0) * 4 + (macros?.carbs || 0) * 4 + (macros?.fats || 0) * 9;

    const sys = `Eres un nutricionista deportivo. Diseñas planes de comidas SOLO con alimentos que le gustan al usuario, evitando estrictamente sus alergias. Cuadras macros y calorías diarias para que cumpla su objetivo. Devuelves entre 4 y 6 comidas (desayuno, media mañana, almuerzo, merienda, cena, opcional pre/post). Responde SIEMPRE llamando a generate_meal_plan.`;

    const userMsg = `Objetivo: ${goal}
Peso: ${weight}kg
Macros diarios objetivo: P=${macros?.protein}g, C=${macros?.carbs}g, F=${macros?.fats}g (~${totalKcal} kcal)
Preferencias / qué le gusta comer: ${preferences || "sin preferencias específicas"}
Alergias / intolerancias: ${allergies || "ninguna"}

Diseña un plan de comidas REAL, sabroso y realista usando SOLO alimentos coherentes con sus preferencias. Cada comida debe tener nombre y descripción específica con cantidades aproximadas (gramos o medidas caseras). NO uses ningún alimento que el usuario haya marcado como alergia.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_meal_plan",
            description: "Devuelve el plan de comidas personalizado",
            parameters: {
              type: "object",
              properties: {
                meals: {
                  type: "array",
                  description: "Lista de 4 a 6 comidas",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Nombre del momento de la comida (Desayuno, Almuerzo, etc.)" },
                      description: { type: "string", description: "Descripción detallada de la comida con cantidades" },
                    },
                    required: ["name", "description"],
                  },
                },
              },
              required: ["meals"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_meal_plan" } },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[ai-generate-meals] AI error", resp.status, text);
      throw new Error(`AI error ${resp.status}`);
    }
    const json = await resp.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No tool call returned");
    const parsed = JSON.parse(args);
    return new Response(JSON.stringify({ meals: parsed.meals || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[ai-generate-meals] ERROR:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
