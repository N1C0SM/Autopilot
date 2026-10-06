import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID_RE.test(value);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    console.log(`[DELETE-ACCOUNT] Deleting user ${userId}`);

    // Delete all user data from all tables
    const userTables = [
      "workout_logs",
      "day_completions",
      "weight_logs",
      "notifications",
      "training_plan",
      "nutrition_plan",
      "onboarding",
      "progress_photos",
      "scan_history",
      "personal_records",
      "user_schedule",
      "training_schedule_overrides",
      "external_activities",
      "user_consents",
      "payment_reminders",
      "trainer_assignments",
      "calendar_tokens",
      "google_calendar_connections",
      "google_calendar_tokens",
    ];
    await Promise.all([
      ...userTables.map((t) => supabaseAdmin.from(t).delete().eq("user_id", userId)),
      supabaseAdmin.from("chat_messages").delete().eq("conversation_user_id", userId),
      supabaseAdmin.from("chat_messages").delete().eq("sender_id", userId),
      supabaseAdmin.from("referrals").delete().eq("referrer_user_id", userId),
      supabaseAdmin.from("referrals").delete().eq("referred_user_id", userId),
    ]);

    // Borra TODOS los archivos del usuario en storage (fotos de progreso, avatar,
    // tarjetas de escaneo y medios de chat). Listado recursivo: hay objetos a más
    // de un nivel (p.ej. progress-photos/<uid>/chat/<conversationId>/<ts>.jpg).
    // Idempotente: si el prefijo ya no existe, list() no devuelve nada y no falla.
    const purgeBucketPrefix = async (bucket: string, prefix: string, depth = 0): Promise<void> => {
      try {
        const { data: entries, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(prefix, { limit: 1000 });
        if (error || !entries?.length) return;
        const files: string[] = [];
        for (const entry of entries) {
          const entryPath = `${prefix}/${entry.name}`;
          // Supabase Storage lista las carpetas sin id (son "prefijos", no objetos).
          if (entry.id) {
            files.push(entryPath);
          } else if (depth < 3) {
            await purgeBucketPrefix(bucket, entryPath, depth + 1);
          }
        }
        if (files.length) {
          for (let i = 0; i < files.length; i += 1000) {
            await supabaseAdmin.storage.from(bucket).remove(files.slice(i, i + 1000));
          }
        }
      } catch (e) {
        console.error(`[DELETE-ACCOUNT] storage purge ${bucket}/${prefix}:`, (e as Error).message);
      }
    };

    // Tarjetas de escaneo atribuidas a este usuario: se borran por RUTA EXACTA,
    // nunca por prefijo amplio. Incluye las tarjetas anónimas que el navegador
    // atribuyó a la cuenta al registrarse (raw_user_meta_data.anon_scan_id).
    // NUNCA se borra scan-cards/anonymous/ completo: puede contener fotos de otras
    // personas que aún no se han registrado.
    const rawAnonScanId = userData.user.user_metadata?.anon_scan_id;
    const anonScanId =
      typeof rawAnonScanId === "string" && UUID_RE.test(rawAnonScanId.trim())
        ? rawAnonScanId.trim().toLowerCase()
        : null;
    const ledgerFilter = anonScanId
      ? `user_id.eq.${userId},anon_session_id.eq.${anonScanId}`
      : `user_id.eq.${userId}`;
    try {
      const { data: ledger, error: ledgerReadErr } = await supabaseAdmin
        .from("scan_card_uploads")
        .select("storage_path")
        .or(ledgerFilter);
      if (ledgerReadErr) throw ledgerReadErr;
      const recordedPaths = (ledger ?? [])
        .map((row) => row.storage_path)
        .filter(
          (p): p is string =>
            typeof p === "string" && p.startsWith("scan-cards/") && !p.includes("..")
        );
      if (recordedPaths.length) {
        await supabaseAdmin.storage.from("progress-photos").remove(recordedPaths);
      }
      await supabaseAdmin.from("scan_card_uploads").delete().or(ledgerFilter);
    } catch (e) {
      // Si la migración aún no está aplicada (tabla inexistente), el borrado de
      // cuenta debe seguir funcionando.
      console.error("[DELETE-ACCOUNT] scan card ledger cleanup:", (e as Error).message);
    }

    await Promise.all([
      // Carpeta del usuario (fotos, avatar, chat) y su carpeta de tarjetas de
      // escaneo autenticadas: scan-cards/<uid>/... El uid sale del JWT verificado,
      // así que estas rutas son demostrablemente suyas.
      isUuid(userId) ? purgeBucketPrefix("progress-photos", userId) : Promise.resolve(),
      isUuid(userId) ? purgeBucketPrefix("progress-photos", `scan-cards/${userId}`) : Promise.resolve(),
      isUuid(userId) ? purgeBucketPrefix("avatars", userId) : Promise.resolve(),
    ]);

    // Delete profile + roles
    await Promise.all([
      supabaseAdmin.from("user_roles").delete().eq("user_id", userId),
      supabaseAdmin.from("profiles").delete().eq("user_id", userId),
    ]);

    // Delete auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[DELETE-ACCOUNT] Auth delete error:", deleteError.message);
      return new Response(JSON.stringify({ error: "Error deleting auth user" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[DELETE-ACCOUNT] User ${userId} fully deleted`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[DELETE-ACCOUNT] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
