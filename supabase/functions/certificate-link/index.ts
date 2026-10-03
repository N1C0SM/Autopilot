import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Devuelve un enlace firmado (60 s) para un certificado de un entrenador visible.
// Sustituye a la lectura pública directa del bucket trainer-certificates.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { path } = await req.json().catch(() => ({}) as any);
    if (typeof path !== "string" || path.length < 5 || path.length > 300 || path.includes("..")) {
      return json({ error: "Ruta no válida" }, 400);
    }
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cert } = await svc
      .from("trainer_certificates")
      .select("id, trainer_profiles!inner(visible)")
      .eq("file_path", path)
      .maybeSingle();
    if (!cert || (cert as any).trainer_profiles?.visible !== true) {
      return json({ error: "Certificado no encontrado" }, 404);
    }
    const { data, error } = await svc.storage.from("trainer-certificates").createSignedUrl(path, 60);
    if (error || !data) return json({ error: "No se pudo generar el enlace" }, 500);
    return json({ signedUrl: data.signedUrl });
  } catch (e) {
    console.error(e);
    return json({ error: "Error inesperado" }, 500);
  }
});
