import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { getAiConfig } from "../_shared/ai-provider.ts";

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

    const { exercise_id: exerciseId, action } = await req.json().catch(() => ({}) as any);
    if (!exerciseId) return json({ error: "Falta el ejercicio" }, 400);
    if (action !== "create" && action !== "check" && action !== "image") return json({ error: "Acción no válida" }, 400);

    // Service-role client for exercise + storage access
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: exercise } = await svc.from("exercises").select("id, name, muscle_group, exercise_type, video_url, video_job_id").eq("id", exerciseId).single();
    if (!exercise) return json({ error: "Ejercicio no encontrado" }, 404);

    // Proveedor según Ajustes: tu clave de OpenAI, Lovable AI o automático.
    const cfg = await getAiConfig();
    const jobRaw = String(exercise.video_job_id || "");
    const jobIsOpenai = jobRaw.startsWith("openai:");
    const useOpenai = action === "check" && jobRaw ? jobIsOpenai : cfg.order.includes("openai");
    const openaiKey = useOpenai ? cfg.openaiKey : "";
    const apiKey = openaiKey || cfg.lovableKey;
    if (!apiKey) return json({ error: "Falta la clave de IA del proyecto" }, 500);
    const BASE = openaiKey ? "https://api.openai.com" : GATEWAY;
    const IMG_MODEL = openaiKey ? "gpt-image-1" : IMAGE_MODEL;
    const jobId = jobRaw.replace(/^openai:/, "");
    const noCredit = openaiKey ? "Sin saldo en tu cuenta de OpenAI" : "Sin créditos de IA suficientes";

    const name = exercise.name || "un ejercicio";
    const group = exercise.muscle_group || "full body";
    const angle = cameraAngle(name, group);

    if (action === "image") {
      const prompt = `Professional exercise technique reference photograph of the exercise "${name}" (${group}). The athlete is captured at the key contracted position of the movement with perfect biomechanical form. ${angle} ${STYLE}`;
      const r = await fetch(`${BASE}/v1/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({ model: IMG_MODEL, prompt, n: 1, size: "1536x1024" }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        const msg = (body as any)?.message || (body as any)?.error?.message || `Error de IA (${r.status})`;
        console.error(`image create failed [${r.status}]: ${msg}`);
        return json({ error: r.status === 429 ? "Demasiadas peticiones, espera unos segundos" : (r.status === 402 || (body as any)?.error?.code === "insufficient_quota") ? noCredit : msg }, r.status);
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
      if (!bytes) return json({ error: "La IA no devolvió ninguna imagen" }, 502);
      const path = `exercise-images/${exerciseId}-${Date.now()}.png`;
      const { error: upErr } = await svc.storage.from("site-assets").upload(path, bytes, { contentType: "image/png", upsert: true });
      if (upErr) {
        console.error(`storage upload failed: ${upErr.message}`);
        return json({ error: "No se pudo guardar la imagen" }, 500);
      }
      const { data: pub } = svc.storage.from("site-assets").getPublicUrl(path);
      await svc.from("exercises").update({ image_url: pub.publicUrl }).eq("id", exerciseId);
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
        console.error(`video create failed [${r.status}]: ${msg}`);
        return json({ error: r.status === 429 ? "Ya hay un vídeo generándose, espera unos segundos" : (r.status === 402 || (body as any)?.error?.code === "insufficient_quota") ? noCredit : msg }, r.status);
      }
      const job = (await r.json()) as Job;
      await svc.from("exercises").update({ video_job_id: openaiKey ? `openai:${job.id}` : job.id }).eq("id", exerciseId);
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
      await svc.from("exercises").update({ video_job_id: null }).eq("id", exerciseId);
      return json({ status: "failed", error: job.error?.message || "La generación del vídeo falló" });
    }
    if (job.status !== "completed") {
      return json({ status: job.status, progress: job.progress ?? null });
    }

    // Download MP4 and store it (the gateway URL expires)
    const dl = await fetch(`${BASE}/v1/videos/${encodeURIComponent(job.id)}/content`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!dl.ok || !dl.body) return json({ error: "No se pudo descargar el vídeo generado" }, 502);
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const path = `exercise-videos/${exerciseId}.mp4`;
    const { error: upErr } = await svc.storage.from("site-assets").upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) {
      console.error(`storage upload failed: ${upErr.message}`);
      return json({ error: "No se pudo guardar el vídeo" }, 500);
    }
    const { data } = svc.storage.from("site-assets").getPublicUrl(path);
    await svc.from("exercises").update({ video_url: data.publicUrl, video_job_id: null }).eq("id", exerciseId);
    return json({ status: "completed", video_url: data.publicUrl });
  } catch (e) {
    console.error(e);
    return json({ error: "Error inesperado" }, 500);
  }
});
