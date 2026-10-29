import { jsonObject } from "../_shared/runtime-values.ts";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { aiFetch, getAiConfig } from "../_shared/ai-provider.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY = "https://ai.gateway.lovable.dev";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

/**
 * Versión del estilo de portada. Súbela al cambiar STYLE: las portadas nuevas
 * se guardan en otra carpeta y las antiguas dejan de usarse.
 */
const COVER_STYLE_VERSION = 1;

/** Identidad visual de Autopilot: la misma de la landing (negro profundo, luz cálida dorada). */
const STYLE = [
  "Cinematic editorial fitness photograph for a premium training app cover.",
  "Setting: dark minimalist strength studio, deep black background with subtle warm gold rim light, soft haze, no clutter, no mirrors, no logos, no text.",
  "Athlete: one strong athletic adult in fitted dark charcoal sportswear, focused expression, mid-movement with perfect form.",
  "Lighting: low-key, dramatic warm golden side light (#d4af55 tone) sculpting the muscles, rich shadows, slightly desaturated colors.",
  "Composition: wide 3:2 frame, athlete off-center to the right, generous dark negative space on the left and bottom for a title overlay.",
  "Prohibited: no text, no captions, no watermarks, no brand names, no extra limbs, no distorted equipment.",
].join(" ");

/** Grupos musculares en un orden y vocabulario fijos: la caché depende solo de ellos, nunca de texto libre. */
const GROUPS: Record<string, string> = {
  pecho: "chest", espalda: "back", hombro: "shoulders", hombros: "shoulders", pierna: "legs", piernas: "legs",
  cuadriceps: "legs", cuádriceps: "legs", femoral: "legs", isquios: "legs", gluteo: "glutes", glúteo: "glutes", gluteos: "glutes", glúteos: "glutes",
  biceps: "arms", bíceps: "arms", triceps: "arms", tríceps: "arms", brazo: "arms", brazos: "arms", antebrazo: "arms",
  core: "core", abdomen: "core", abdominales: "core", gemelo: "legs", gemelos: "legs", "full body": "full body",
};
const ORDER = ["full body", "chest", "back", "shoulders", "legs", "glutes", "arms", "core"];

function normalizeGroups(raw: (string | null)[]): string[] {
  const found = new Set<string>();
  for (const g of raw) {
    const n = String(g || "").toLowerCase().normalize("NFC");
    for (const [k, v] of Object.entries(GROUPS)) if (n.includes(k)) found.add(v);
  }
  const list = ORDER.filter((g) => found.has(g));
  // Cuatro grupos o más es una sesión de cuerpo completo: una sola portada para todas.
  return list.length >= 4 || list.length === 0 ? ["full body"] : list.slice(0, 3);
}

/** PNG/JPEG -> WebP (calidad 82, máx. 1280 px de ancho). null si falla. */
async function toWebp(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const { Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    const img = await Image.decode(bytes);
    if (img.width > 1280) img.resize(1280, Image.RESIZE_AUTO);
    const encode = jsonObject(img).encodeWEBP;
    if (typeof encode !== "function") return null;
    const encoded: unknown = await encode.call(img, 82);
    return encoded instanceof Uint8Array ? encoded : null;
  } catch (e) {
    console.error(`webp failed: ${(e as Error).message}`);
    return null;
  }
}

/** Estilo de las fotos de comida: el mismo bodegón oscuro y cálido que las sesiones. */
const MEAL_STYLE = [
  "Cinematic editorial food photograph for a premium fitness app.",
  "Setting: single plated dish on a dark matte stone surface, deep black background, warm golden side light (#d4af55 tone), soft shadows, shallow depth of field.",
  "Composition: 3:2 frame, dish slightly off-center, three-quarter top-down angle, generous dark negative space.",
  "Prohibited: no text, no captions, no watermarks, no brand names, no hands, no people, no cutlery clutter.",
].join(" ");

/** Texto del plato limpio y acotado: solo letras, números y puntuación básica. */
function cleanDish(raw: unknown): string {
  return String(raw || "").normalize("NFC").replace(/[^\p{L}\p{N} ,.()+-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** Clave estable del plato: minúsculas sin acentos ni cantidades, para reutilizar la foto. */
function dishKey(dish: string): string {
  return dish.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\d+\s*(g|gr|ml|kg|uds?|unidades?)\b/g, "")
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join("_").slice(0, 80) || "comida";
}

/**
 * Portada de una sesión (según sus grupos musculares) o foto de una comida, generada con IA.
 * Se guarda una vez por combinación de grupos y estilo en site-assets/session-covers/
 * y se reutiliza para todos los usuarios: la IA solo se paga la primera vez.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { exercise_ids: rawIds, meal: rawMeal } = await req.json().catch(() => ({}));
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let key: string, folder: string, prompt: string;
    if (rawMeal !== undefined) {
      const dish = cleanDish(rawMeal);
      if (dish.length < 3) return json({ error: "Falta la comida" }, 400);
      key = dishKey(dish);
      folder = `meal-photos/v${COVER_STYLE_VERSION}`;
      prompt = `A healthy home-cooked dish: ${dish}. ${MEAL_STYLE}`;
    } else {
      const ids = Array.isArray(rawIds) ? rawIds.filter((x: unknown): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 20) : [];
      if (!ids.length) return json({ error: "Faltan los ejercicios" }, 400);
      const { data: rows } = await svc.from("exercises").select("muscle_group").in("id", ids);
      const groups = normalizeGroups((rows || []).map((r) => r.muscle_group));
      key = groups.join("-").replace(/\s+/g, "_");
      folder = `session-covers/v${COVER_STYLE_VERSION}`;
      prompt = `A training session focused on ${groups.join(", ")}: the athlete performs a classic strength exercise for ${groups[0]}. ${STYLE}`;
    }
    const path = `${folder}/${key}.webp`;
    const { data: pub } = svc.storage.from("site-assets").getPublicUrl(path);

    // Ya generada: se devuelve sin gastar IA.
    const { data: existing } = await svc.storage.from("site-assets").list(folder, { search: `${key}.webp` });
    if (existing?.some((f) => f.name === `${key}.webp`)) return json({ url: pub.publicUrl, cached: true });

    const cfg = await getAiConfig();
    const apiKey = cfg.mediaOrder[0] === "openai" ? cfg.openaiKey : cfg.lovableKey;
    if (!apiKey) return json({ error: "Falta la clave de IA del proyecto" }, 503);

    const r = await aiFetch(`${GATEWAY}/v1/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1, size: "1536x1024" }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      console.error(`cover failed [${r.status}]: ${body?.error?.message || body?.message || ""}`);
      // The cover is optional: the client keeps its stock photo, so no-credit/quota is not an error.
      if (r.status === 402 || r.status === 429) return json({ url: null, unavailable: "no_ai_credits" });
      return json({ error: "No se pudo generar la portada" }, 502);
    }
    const out = await r.json();
    const b64 = out?.data?.[0]?.b64_json;
    const url = out?.data?.[0]?.url;
    let bytes: Uint8Array | null = null;
    if (b64) bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    else if (url) { const dl = await fetch(url); if (dl.ok) bytes = new Uint8Array(await dl.arrayBuffer()); }
    if (!bytes) return json({ error: "La IA no devolvió ninguna imagen" }, 502);

    const webp = await toWebp(bytes);
    if (!webp) return json({ error: "No se pudo convertir la portada" }, 500);
    const { error: upErr } = await svc.storage.from("site-assets").upload(path, webp, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (upErr) return json({ error: "No se pudo guardar la portada" }, 500);
    return json({ url: pub.publicUrl, cached: false });
  } catch (e) {
    console.error(`session-cover error: ${(e as Error).message}`);
    return json({ error: "Error interno" }, 500);
  }
});
