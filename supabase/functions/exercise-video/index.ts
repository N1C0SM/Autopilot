import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

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
    if (action !== "create" && action !== "check") return json({ error: "Acción no válida" }, 400);

    // Service-role client for exercise + storage access
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: exercise } = await svc.from("exercises").select("id, name, muscle_group, exercise_type, video_url, video_job_id").eq("id", exerciseId).single();
    if (!exercise) return json({ error: "Ejercicio no encontrado" }, 404);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Falta la clave de IA del proyecto" }, 500);

    if (action === "create") {
      if (exercise.video_job_id) {
        return json({ jobId: exercise.video_job_id, status: "in_progress", resumed: true });
      }
      const name = exercise.name || "un ejercicio";
      const group = exercise.muscle_group || "full body";
      const prompt = `Professional fitness technique demonstration video: an athletic person performs ${name} (${group}) with perfect form in a bright modern gym. Fixed camera in a single continuous shot, full body always visible, clean and controlled repetitions, realistic lighting. No text, no watermarks, no subtitles, no music, no extra sound effects.`;
      const r = await fetch(`${GATEWAY}/v1/videos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({
          model: MODEL,
          input: prompt,
          response_format: { type: "video", resolution: "720p", duration: "8s", aspect_ratio: "16:9" },
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        const msg = (body as any)?.message || `Error de IA (${r.status})`;
        console.error(`video create failed [${r.status}]: ${msg}`);
        return json({ error: r.status === 429 ? "Ya hay un vídeo generándose, espera unos segundos" : r.status === 402 ? "Sin créditos de IA suficientes" : msg }, r.status);
      }
      const job = (await r.json()) as Job;
      await svc.from("exercises").update({ video_job_id: job.id }).eq("id", exerciseId);
      return json({ jobId: job.id, status: job.status });
    }

    // action === "check"
    if (exercise.video_url) {
      return json({ status: "completed", video_url: exercise.video_url });
    }
    if (!exercise.video_job_id) return json({ error: "No hay ningún vídeo en curso" }, 400);

    const poll = await fetch(`${GATEWAY}/v1/videos/${encodeURIComponent(exercise.video_job_id)}`, {
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
    const dl = await fetch(`${GATEWAY}/v1/videos/${encodeURIComponent(job.id)}/content`, {
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
