import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_TO_DOW: Record<string, number> = {
  Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 0,
};
const DOW_TO_DAY = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const EXTERNAL_FATIGUE: Record<string, "Alta" | "Media" | "Baja"> = {
  boxeo: "Alta", escalada: "Alta", futbol: "Alta", padel: "Alta", tenis: "Alta",
  running: "Media", ciclismo: "Media", natacion: "Media", danza: "Media",
  yoga: "Baja", personal: "Baja", trabajo: "Baja", otro: "Baja",
};

function estimatePlanLoad(plan: any): "Alta" | "Media" | "Baja" {
  if (plan?.type === "actividad") {
    const intensity = (plan.intensity || "").toLowerCase();
    if (intensity.includes("alta") || intensity.includes("intensa")) return "Alta";
    if (intensity.includes("media") || intensity.includes("moderada")) return "Media";
    return "Baja";
  }
  const exs = plan?.exercises || [];
  let high = 0, med = 0;
  for (const ex of exs) {
    const f = (ex.fatigue_level || "Media").toLowerCase();
    if (f.includes("alta")) high++;
    else if (f.includes("media")) med++;
  }
  if (high >= 3) return "Alta";
  if (high >= 1 || med >= 4) return "Media";
  return "Baja";
}

/** Convierte (dow, hour, minute, duration) en un par de minutos absolutos
 * desde el lunes 00:00 (rango 0..7*1440). */
function toMinutes(dow: number, h: number, m: number) {
  const offset = dow === 0 ? 6 : dow - 1; // lunes=0
  return offset * 1440 + h * 60 + m;
}

function fromMinutes(min: number): { dow: number; h: number; m: number } {
  const offset = Math.floor(min / 1440);
  const dow = offset === 6 ? 0 : offset + 1;
  const remainder = min % 1440;
  return { dow, h: Math.floor(remainder / 60), m: remainder % 60 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Auth: only the user themselves, an admin, or their assigned trainer
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: { user: caller } } = await authClient.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (user_id !== caller.id) {
      const [{ data: isAdmin }, { data: isTrainer }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: caller.id, _role: "admin" }),
        supabase.rpc("is_trainer_of", { _trainer_id: caller.id, _user_id: user_id }),
      ]);
      if (!isAdmin && !isTrainer) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const [{ data: planRow }, { data: externals }, { data: overrides }] = await Promise.all([
      supabase.from("training_plan").select("workouts_json").eq("user_id", user_id).maybeSingle(),
      supabase.from("external_activities").select("*").eq("user_id", user_id),
      supabase.from("training_schedule_overrides").select("*").eq("user_id", user_id),
    ]);

    const dayPlans: any[] = (planRow?.workouts_json as any)?.dayPlans || (planRow?.workouts_json as any) || [];
    const ovrMap = new Map<string, any>();
    for (const o of (overrides || [])) ovrMap.set(o.day_label, o);

    // Bloques semanales [startMin, endMin, kind]
    type Block = { startMin: number; endMin: number; kind: "training" | "external"; label: string; load: string; planRef?: any };
    const blocks: Block[] = [];

    for (const ext of (externals || [])) {
      const start = toMinutes(ext.day_of_week, ext.start_hour, ext.start_minute);
      blocks.push({
        startMin: start, endMin: start + ext.duration_min,
        kind: "external", label: ext.title,
        load: EXTERNAL_FATIGUE[ext.category] || "Baja",
      });
    }

    const trainingBlocks: Block[] = [];
    for (const plan of dayPlans) {
      const baseDow = DAY_TO_DOW[plan.day];
      if (baseDow === undefined) continue;
      const ovr = ovrMap.get(plan.day);
      const dow = ovr?.new_day_of_week ?? baseDow;
      const h = ovr?.start_hour ?? (plan.type === "gimnasio" ? 18 : 19);
      const m = ovr?.start_minute ?? 0;
      const dur = ovr?.duration_min ?? 60;
      const start = toMinutes(dow, h, m);
      const tb: Block = {
        startMin: start, endMin: start + dur,
        kind: "training", label: plan.routine_name || plan.sport || "Entreno",
        load: estimatePlanLoad(plan), planRef: plan,
      };
      trainingBlocks.push(tb);
      blocks.push(tb);
    }

    // Detectar conflictos por entreno
    const conflictsForTraining = (tr: Block) => {
      const issues: { type: "overlap" | "recovery"; with: string }[] = [];
      for (const b of blocks) {
        if (b === tr || b.kind !== "external") continue;
        // Overlap
        if (b.startMin < tr.endMin && b.endMin > tr.startMin) {
          issues.push({ type: "overlap", with: b.label });
          continue;
        }
        // Recovery: externa Alta dentro de 24h antes de entreno no-bajo
        if (b.load === "Alta" && tr.load !== "Baja") {
          const gap = (tr.startMin - b.endMin) / 60;
          if (gap > 0 && gap < 24) issues.push({ type: "recovery", with: b.label });
        }
      }
      return issues;
    };

    // Buscar primer hueco libre desde una hora preferida (mismo dow.h base) con duración dur sin conflictos
    const findFreeSlot = (tr: Block, dur: number): { dow: number; h: number; m: number } | null => {
      const otherBlocks = blocks.filter((b) => b !== tr);
      // Probar cada día de la semana, en horarios típicos: 07, 18, 19, 20
      const dowOrder = [1, 2, 3, 4, 5, 6, 0];
      const hourOrder = [18, 19, 7, 20, 17, 8];
      for (const dow of dowOrder) {
        for (const h of hourOrder) {
          const startMin = toMinutes(dow, h, 0);
          const endMin = startMin + dur;
          // No solape con ninguna externa
          const collides = otherBlocks.some((b) => b.kind === "external" && b.startMin < endMin && b.endMin > startMin);
          if (collides) continue;
          // No tener externa Alta dentro de 24h previas (si tr.load no es Baja)
          if (tr.load !== "Baja") {
            const tooClose = otherBlocks.some((b) => {
              if (b.kind !== "external" || b.load !== "Alta") return false;
              const gap = (startMin - b.endMin) / 60;
              return gap > 0 && gap < 24;
            });
            if (tooClose) continue;
          }
          return { dow, h, m: 0 };
        }
      }
      return null;
    };

    const moves: { day_label: string; from: string; to: string; reason: string }[] = [];

    for (const tr of trainingBlocks) {
      const issues = conflictsForTraining(tr);
      if (issues.length === 0) continue;
      const dur = tr.endMin - tr.startMin;
      const slot = findFreeSlot(tr, dur);
      if (!slot) continue;

      const dayLabel = tr.planRef.day;
      const oldPos = fromMinutes(tr.startMin);
      const fromText = `${DOW_TO_DAY[oldPos.dow]} ${String(oldPos.h).padStart(2, "0")}:${String(oldPos.m).padStart(2, "0")}`;
      const toText = `${DOW_TO_DAY[slot.dow]} ${String(slot.h).padStart(2, "0")}:00`;
      const reasonExt = issues[0].with;
      const reason = issues[0].type === "overlap"
        ? `Solape directo con ${reasonExt}`
        : `Recuperación insuficiente tras ${reasonExt} (carga alta)`;

      // Persistir override
      const existingOvr = ovrMap.get(dayLabel);
      const { error } = await supabase.from("training_schedule_overrides").upsert({
        user_id,
        day_label: dayLabel,
        new_day_of_week: slot.dow,
        start_hour: slot.h,
        start_minute: slot.m,
        duration_min: dur,
        admin_note: existingOvr?.admin_note ?? null,
      }, { onConflict: "user_id,day_label" });
      if (error) continue;

      // Actualizar el bloque en memoria para que el siguiente entreno respete el nuevo hueco
      tr.startMin = toMinutes(slot.dow, slot.h, slot.m);
      tr.endMin = tr.startMin + dur;

      moves.push({ day_label: dayLabel, from: fromText, to: toText, reason });
    }

    // Notificación al usuario
    if (moves.length > 0) {
      const summary = moves.map((m) => `${m.day_label}: ${m.from} → ${m.to} (${m.reason})`).join("\n");
      await supabase.from("notifications").insert({
        user_id,
        title: `🔄 Reorganizamos ${moves.length} entreno${moves.length > 1 ? "s" : ""}`,
        message: summary,
        type: "info",
      });
    }

    return new Response(JSON.stringify({ moves, conflictsResolved: moves.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-reschedule error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});