import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { aiFetch, getAiConfig } from "../_shared/ai-provider.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY = "https://ai.gateway.lovable.dev";
const MODEL = "google/gemini-omni-1.1-flash";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

/** Estilo visual maestro compartido por foto y vídeo (coherencia tipo Hevy/Symmetry). */
const STYLE = [
  "Setting: minimalist dark photo studio, matte charcoal rubber gym flooring, clean empty dark background, no clutter, no background people, no mirrors, no logos.",
  "Lighting: soft overhead studio lighting with subtle rim light defining muscle contours, neutral color grading, slightly desaturated.",
  "Athlete: one lean athletic adult wearing fitted dark charcoal compression sportswear and minimalist flat training shoes.",
  "Framing: locked tripod shot at mid-torso height, full body always fully inside frame, 16:9.",
  "Prohibited: no text, no captions, no watermarks, no logos, no music, no on-screen graphics, no morphed or floating equipment, no extra limbs, no camera movement, no cuts.",
].join(" ");

/**
 * Versión del estilo visual actual. Súbela al cambiar STYLE o cameraAngle y
 * todos los medios anteriores quedarán marcados como "estilo antiguo" en el
 * admin (coincide con MEDIA_STYLE_VERSION en ExerciseLibrary.tsx).
 */
const MEDIA_STYLE_VERSION = 2;

/** Ángulo de cámara estandarizado según el patrón biomecánico. */
function cameraAngle(name: string, group: string): string {
  const n = `${name} ${group}`.toLowerCase();
  if (/sentadilla|squat|peso muerto|deadlift|zancada|lunge|hip thrust|pierna|glúteo|gluteo|bulgara|búlgara|prensa/.test(n)) {
    return "Camera angle: strict 90 degree side profile to show spine neutrality and depth.";
  }
  if (/press|fondo|dip|remo|row|dominada|pull|jalon|jalón|empuje|banca|militar|pecho|espalda|hombro/.test(n)) {
    return "Camera angle: 45 degree three-quarter front view to show bar path and elbow position.";
  }
  return "Camera angle: centered 45 degree medium shot focused on the working muscle.";
}

type Job = { id: string; status: string; progress?: number; error?: { code: string; message: string } };

/** Ruta del objeto dentro del bucket público site-assets a partir de su URL pública. */
function siteAssetPath(url: unknown, prefix: string): string | null {
  if (typeof url !== "string" || !url) return null;
  const marker = "/site-assets/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split("?")[0];
  return path.startsWith(prefix) ? path : null;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const {
      exercise_id: bodyExerciseId,
      action: rawAction,
      exclude: rawExclude,
    } = await req.json().catch(() => ({}) as any);
    if (rawAction !== "create" && rawAction !== "check" && rawAction !== "image" && rawAction !== "batch") {
      return json({ error: "Acción no válida" }, 400);
    }

    // Service-role client for exercise + storage access
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const exerciseId: string | undefined = bodyExerciseId;
    const action: string = rawAction;

    // "batch" no genera nada: devuelve el siguiente ejercicio pendiente para que un
    // script pueda recorrer toda la biblioteca sin depender de una pestaña abierta.
    // `exclude` evita que un ejercicio que falla siempre bloquee la cola.
    if (action === "batch") {
      const exclude = Array.isArray(rawExclude)
        ? rawExclude.filter((id: unknown): id is string => typeof id === "string" && id.length > 0).slice(0, 200)
        : [];
      let query = svc
        .from("exercises")
        .select("id, name, image_url, video_url")
        .or(`image_url.is.null,video_url.is.null,media_style_version.is.null,media_style_version.neq.${MEDIA_STYLE_VERSION}`);
      if (exclude.length > 0) query = query.not("id", "in", `(${exclude.join(",")})`);
      const { data: pending, error: pendErr } = await query
        .order("image_url", { ascending: true, nullsFirst: true })
        .order("video_url", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true })
        .limit(1);
      if (pendErr) {
        const missing = /column .* does not exist/i.test(pendErr.message ?? "");
        return json({
          error: missing
            ? "Falta aplicar la migración de medios: ejecuta `supabase db push`."
            : "No se pudo consultar la biblioteca",
        }, missing ? 503 : 500);
      }
      const next = pending?.[0];
      if (!next) return json({ done: true, remaining: 0 });
      return json({ done: false, nextId: next.id, name: next.name, action: next.image_url ? "create" : "image" });
    }

    if (!exerciseId) return json({ error: "Falta el ejercicio" }, 400);

    const { data: exercise, error: exerciseError } = await svc.from("exercises").select("id, name, muscle_group, exercise_type, image_url, video_url, video_job_id").eq("id", exerciseId).single();
    if (exerciseError) {
      const missing = /column .* does not exist/i.test(exerciseError.message ?? "");
      console.error(`exercise lookup failed: ${exerciseError.message}`);
      return json({
        error: missing
          ? "Falta aplicar la migración de medios: ejecuta `supabase db push` y despliega esta función."
          : "No se pudo leer el ejercicio",
      }, missing ? 503 : 500);
    }
    if (!exercise) return json({ error: "Ejercicio no encontrado" }, 404);

    // Proveedor según Ajustes: tu clave de OpenAI, Lovable AI o automático.
    const cfg = await getAiConfig();
    if (!cfg.videoEnabled && action !== "check") {
      return json({ error: "La generación de vídeos está pausada en Ajustes → Claves de IA" }, 503);
    }
    const jobRaw = String(exercise.video_job_id || "");
    const jobIsOpenai = jobRaw.startsWith("openai:");
    const useOpenai = action === "check" && jobRaw ? jobIsOpenai : cfg.order.includes("openai");
    const openaiKey = useOpenai ? cfg.openaiKey : "";
    const apiKey = openaiKey || cfg.lovableKey;
    if (!apiKey) return json({ error: "Falta la clave de IA del proyecto" }, 500);
    const BASE = openaiKey ? "https://api.openai.com" : GATEWAY;
    const jobId = jobRaw.replace(/^openai:/, "");
    const noCredit = openaiKey ? "Sin saldo en tu cuenta de OpenAI" : "Sin créditos de IA suficientes";

    const name = exercise.name || "un ejercicio";
    const group = exercise.muscle_group || "full body";
    const angle = cameraAngle(name, group);

    if (action === "image") {
      // La imagen sale en 3:2 (límite del modelo) pero se muestra en un marco 16:9
      // junto al vídeo: pedimos que el cuerpo quede dentro de la banda central 16:9
      // para que el recorte sea idéntico en toda la biblioteca.
      const prompt = `Professional exercise technique reference photograph of the exercise "${name}" (${group}). The athlete is captured at the key contracted position of the movement with perfect biomechanical form. Compose for a 16:9 crop: keep the entire athlete and any equipment inside the central 16:9 band of the frame, with only empty floor and background above and below it. ${angle} ${STYLE}`;
      // aiFetch hereda la cadena de proveedores (OpenAI admin -> Claude -> gateway).
      const r = await aiFetch(`${GATEWAY}/v1/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1, size: "1536x1024" }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        const msg = (body as any)?.message || (body as any)?.error?.message || `Error de IA (${r.status})`;
        const message = r.status === 429
          ? "Demasiadas peticiones, espera unos segundos"
          : (r.status === 402 || (body as any)?.error?.code === "insufficient_quota")
            ? "Sin créditos de IA suficientes"
            : msg;
        console.error(`image create failed [${r.status}]: ${msg}`);
        await svc.from("exercises").update({ media_error: message }).eq("id", exerciseId);
        return json({ error: message }, r.status);
      }
      const out = await r.json();
      const b64 = out?.data?.[0]?.b64_json;
      const url = out?.data?.[0]?.url;
      let bytes: Uint8Array | null = null;
      if (b64) {
        bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      } else if (url) {
        const dl = await fetch(url);
        if (dl.ok) bytes = new Uint8Array(await dl.arrayBuffer());
      }
      if (!bytes) {
        await svc.from("exercises").update({ media_error: "La IA no devolvió ninguna imagen" }).eq("id", exerciseId);
        return json({ error: "La IA no devolvió ninguna imagen" }, 502);
      }
      const previousImagePath = siteAssetPath(exercise.image_url, "exercise-images/");
      const path = `exercise-images/${exerciseId}-${Date.now()}.png`;
      const { error: upErr } = await svc.storage.from("site-assets").upload(path, bytes, { contentType: "image/png", upsert: true });
      if (upErr) {
        console.error(`storage upload failed: ${upErr.message}`);
        await svc.from("exercises").update({ media_error: "No se pudo guardar la imagen" }).eq("id", exerciseId);
        return json({ error: "No se pudo guardar la imagen" }, 500);
      }
      const { data: pub } = svc.storage.from("site-assets").getPublicUrl(path);
      await svc.from("exercises").update({
        image_url: pub.publicUrl,
        media_style_version: MEDIA_STYLE_VERSION,
        image_generated_at: new Date().toISOString(),
        media_error: null,
      }).eq("id", exerciseId);
      // Limpieza del objeto anterior: la imagen cambia de nombre en cada generación.
      if (previousImagePath) {
        const { error: rmErr } = await svc.storage.from("site-assets").remove([previousImagePath]);
        if (rmErr) console.warn(`old image cleanup failed: ${rmErr.message}`);
      }
      return json({ status: "completed", image_url: pub.publicUrl });
    }

    if (action === "create") {
      if (exercise.video_job_id) {
        return json({ jobId: exercise.video_job_id, status: "in_progress", resumed: true });
      }
      const prompt = `Professional exercise technique demonstration video of the exercise "${name}" (${group}). The athlete performs exactly 2 smooth controlled repetitions with perfect biomechanical form, cadence 2 seconds eccentric, 1 second pause, 2 seconds concentric, full range of motion, ending back at the exact starting position so the clip loops seamlessly. ${angle} ${STYLE}`;
      const r = await fetch(`${BASE}/v1/videos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify(openaiKey ? { model: "sora-2", prompt, seconds: "8", size: "1280x720" } : {
          model: MODEL,
          input: prompt,
          response_format: { type: "video", resolution: "720p", duration: "8s", aspect_ratio: "16:9" },
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        const msg = (body as any)?.message || (body as any)?.error?.message || `Error de IA (${r.status})`;
        const message = r.status === 429
          ? "Ya hay un vídeo generándose, espera unos segundos"
          : (r.status === 402 || (body as any)?.error?.code === "insufficient_quota")
            ? noCredit
            : msg;
        console.error(`video create failed [${r.status}]: ${msg}`);
        await svc.from("exercises").update({ media_error: message }).eq("id", exerciseId);
        return json({ error: message }, r.status);
      }
      const job = (await r.json()) as Job;
      await svc.from("exercises").update({
        video_job_id: openaiKey ? `openai:${job.id}` : job.id,
        media_error: null,
      }).eq("id", exerciseId);
      return json({ jobId: job.id, status: job.status });
    }

    // action === "check"
    if (!exercise.video_job_id) {
      if (exercise.video_url) return json({ status: "completed", video_url: exercise.video_url });
      return json({ error: "No hay ningún vídeo en curso" }, 400);
    }


    const poll = await fetch(`${BASE}/v1/videos/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!poll.ok) {
      const body = await poll.json().catch(() => null);
      console.error(`video poll failed [${poll.status}]: ${body?.message ?? poll.status}`);
      return json({ error: "No se pudo comprobar el vídeo, inténtalo de nuevo" }, 502);
    }
    const job = (await poll.json()) as Job;
    if (job.status === "failed") {
      const message = job.error?.message || "La generación del vídeo falló";
      await svc.from("exercises").update({ video_job_id: null, media_error: message }).eq("id", exerciseId);
      return json({ status: "failed", error: message });
    }
    if (job.status !== "completed") {
      return json({ status: job.status, progress: job.progress ?? null });
    }

    // Download MP4 and store it (the gateway URL expires)
    const dl = await fetch(`${BASE}/v1/videos/${encodeURIComponent(job.id)}/content`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!dl.ok || !dl.body) {
      await svc.from("exercises").update({ media_error: "No se pudo descargar el vídeo generado" }).eq("id", exerciseId);
      return json({ error: "No se pudo descargar el vídeo generado" }, 502);
    }
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const path = `exercise-videos/${exerciseId}.mp4`;
    const { error: upErr } = await svc.storage.from("site-assets").upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) {
      console.error(`storage upload failed: ${upErr.message}`);
      await svc.from("exercises").update({ media_error: "No se pudo guardar el vídeo" }).eq("id", exerciseId);
      return json({ error: "No se pudo guardar el vídeo" }, 500);
    }
    const { data } = svc.storage.from("site-assets").getPublicUrl(path);
    await svc.from("exercises").update({
      video_url: data.publicUrl,
      video_job_id: null,
      media_style_version: MEDIA_STYLE_VERSION,
      video_generated_at: new Date().toISOString(),
      media_error: null,
    }).eq("id", exerciseId);
    return json({ status: "completed", video_url: data.publicUrl });
  } catch (e) {
    console.error(e);
    return json({ error: "Error inesperado" }, 500);
  }
});
