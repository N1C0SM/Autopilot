import { getAuthedUser } from "../_shared/require-user.ts";
import { errorMessage } from "../_shared/runtime-values.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAiConfig } from "../_shared/ai-provider.ts";


/// Genera/edita la imagen con créditos de Lovable y, si no hay, con OpenAI.
const generateImage = async (
  cfg: { lovableKey: string; openaiKey: string },
  prompt: string,
  currentImage: string,
): Promise<string> => {
  const errors: string[] = [];
  if (cfg.lovableKey) {
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.lovableKey}` },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: currentImage } },
            ],
          }],
          modalities: ["image", "text"],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const imgUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? data?.choices?.[0]?.message?.images?.[0]?.url;
        if (imgUrl) return imgUrl;
        errors.push("lovable: sin imagen");
      } else {
        errors.push(`lovable: ${resp.status}`);
      }
    } catch (e) {
      errors.push(`lovable: ${errorMessage(e)}`);
    }
  }
  if (cfg.openaiKey) {
    try {
      const match = currentImage.match(/^data:(.+?);base64,(.*)$/);
      if (!match) throw new Error("la imagen no es data URL");
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("prompt", prompt);
      form.append("image", new Blob([bytes], { type: match[1] }), "photo.png");
      const r = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.openaiKey}` },
        body: form,
      });
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      const j = await r.json();
      const b64 = j?.data?.[0]?.b64_json;
      if (b64) return `data:image/png;base64,${b64}`;
      const url = j?.data?.[0]?.url;
      if (url) return url;
      throw new Error("sin imagen");
    } catch (e) {
      errors.push(`openai: ${errorMessage(e)}`);
    }
  }
  throw new Error(`No se pudo generar la imagen (${errors.join(" | ")})`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await getAuthedUser(req))) return new Response(JSON.stringify({ error: "Inicia sesión para usar el Scan." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const key = `generate-future-self:${ip}`;
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

    const { currentImage, months, goal, pose } = await req.json();
    if (!currentImage) {
      return new Response(JSON.stringify({ error: "Falta la imagen" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Edita esta foto mostrando a la misma persona ${months ?? 6} meses después tras seguir un plan de entrenamiento y nutrición personalizado, con ${goal === "lose_weight" ? "menos grasa corporal y más definición" : goal === "gain_muscle" ? "más masa muscular en hombros, espalda y pecho" : "mejor composición corporal y postura"}. ${pose === "back" ? "Es una foto de ESPALDA: muestra la misma vista dorsal, con más densidad de dorsales, deltoides posteriores, trapecios, zona lumbar limpia y mejor postura escapular." : "Es una foto de FRENTE: muestra la misma vista frontal, con mejor pectoral, hombros y definición abdominal."} Mantén identidad, fondo y pose idénticos. Realista, no caricaturesco.`;

    const cfg = await getAiConfig();
    if (!cfg.lovableKey && !cfg.openaiKey) throw new Error("No hay ningún proveedor de imágenes configurado");

    const imgUrl = await generateImage({ lovableKey: cfg.lovableKey, openaiKey: cfg.openaiKey }, prompt, currentImage);

    return new Response(JSON.stringify({ imageUrl: imgUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("generate-future-self error:", e);
    return new Response(JSON.stringify({ error: errorMessage(e) || "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
})
;