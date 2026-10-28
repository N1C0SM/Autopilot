import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_INDEX: Record<string, number> = {
  Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 0,
};
const DAY_RRULE: Record<string, string> = {
  Lunes: "MO", Martes: "TU", Miércoles: "WE", Jueves: "TH", Viernes: "FR", Sábado: "SA", Domingo: "SU",
};
const DAY_LABEL_BY_DOW: Record<number, string> = {
  0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado",
};

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toICSDate(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
function nextDateForDay(targetDow: number, hour: number) {
  const now = new Date();
  const today = now.getDay();
  let diff = (targetDow - today + 7) % 7;
  if (diff === 0 && now.getHours() >= hour) diff = 7;
  const d = new Date(now);
  d.setDate(d.getDate() + diff);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function nextDateForDayHM(targetDow: number, hour: number, minute: number) {
  const now = new Date();
  const today = now.getDay();
  let diff = (targetDow - today + 7) % 7;
  const todayMins = now.getHours() * 60 + now.getMinutes();
  if (diff === 0 && todayMins >= hour * 60 + minute) diff = 7;
  const d = new Date(now);
  d.setDate(d.getDate() + diff);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function parseHM(s: string | undefined, fallback: [number, number]): [number, number] {
  if (!s) return fallback;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  return [parseInt(m[1]), parseInt(m[2])];
}
function escape(t: string) {
  return t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

interface DayPlan {
  day: string;
  type: "actividad" | "gimnasio";
  sport?: string;
  intensity?: string;
  duration?: string;
  routine_name?: string;
  muscle_focus?: string;
  exercises?: { name: string; series: number; reps: number; rest: string }[];
}

interface GymSlot { day: number; start: string; duration: number; }
interface MealTimes {
  breakfast: string; snack_am: string; lunch: string; snack_pm: string; dinner: string;
}
interface UserSchedule {
  gym_slots: GymSlot[];
  meal_times: MealTimes;
  meal_duration_min: number;
  weekly_reminders: { weigh_in: boolean; progress_photo: boolean };
}
interface Meal { name: string; description: string; }
interface Macros { protein: number; carbs: number; fats: number; }

function addEvent(lines: string[], opts: {
  uid: string; start: Date; end: Date; rrule?: string;
  summary: string; description: string; reminderMin: number;
}) {
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${opts.uid}`);
  lines.push(`DTSTAMP:${toICSDate(new Date())}`);
  lines.push(`DTSTART:${toICSDate(opts.start)}`);
  lines.push(`DTEND:${toICSDate(opts.end)}`);
  if (opts.rrule) lines.push(`RRULE:${opts.rrule}`);
  lines.push(`SUMMARY:${escape(opts.summary)}`);
  lines.push(`DESCRIPTION:${escape(opts.description)}`);
  if (opts.reminderMin > 0) {
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escape(opts.summary)}`);
    lines.push(`TRIGGER:-PT${opts.reminderMin}M`);
    lines.push("END:VALARM");
  }
  lines.push("END:VEVENT");
}

function buildICS(opts: {
  plans: DayPlan[];
  schedule: UserSchedule | null;
  meals: Meal[];
  macros: Macros | null;
  fallback: { startHourGym: number; startHourActivity: number; durationMin: number; reminderMin: number };
}) {
  const { plans, schedule, meals, macros, fallback } = opts;
  const reminderMin = fallback.reminderMin;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Autopilot//Plan//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Mi Plan Autopilot",
    "X-WR-TIMEZONE:Europe/Madrid",
  ];

  // 1) ENTRENOS
  for (const plan of plans) {
    const dow = DAY_INDEX[plan.day];
    const rrule = DAY_RRULE[plan.day];
    if (dow === undefined) continue;

    // Si hay user_schedule con gym_slot para este día, úsalo. Si no, fallback.
    const slot = schedule?.gym_slots?.find((s) => s.day === dow);
    const [h, m] = slot ? parseHM(slot.start, [fallback.startHourGym, 0]) : [
      plan.type === "gimnasio" ? fallback.startHourGym : fallback.startHourActivity, 0,
    ];
    const dur = slot?.duration ?? fallback.durationMin;
    const start = nextDateForDayHM(dow, h, m);
    const end = new Date(start.getTime() + dur * 60 * 1000);

    const title = plan.type === "gimnasio" ? `🏋️ ${plan.routine_name || "Entrenamiento"}` : `🔥 ${plan.sport || "Actividad"}`;
    const description = plan.type === "gimnasio"
      ? `Músculos: ${plan.muscle_focus || "-"}\n\n${(plan.exercises || []).map((e, i) => `${i + 1}. ${e.name} — ${e.series}x${e.reps} (descanso ${e.rest})`).join("\n")}`
      : `Intensidad: ${plan.intensity || "-"}\nDuración: ${plan.duration || "-"}`;

    addEvent(lines, {
      uid: `${plan.day}-${plan.type}-autopilot@lovable.app`,
      start, end,
      rrule: `FREQ=WEEKLY;BYDAY=${rrule}`,
      summary: title,
      description,
      reminderMin,
    });
  }

  // 2) COMIDAS — si tenemos meals + meal_times
  if (meals.length > 0 && schedule?.meal_times) {
    const MEAL_SLOTS: Array<{ key: keyof MealTimes; emoji: string; label: string }> = [
      { key: "breakfast", emoji: "🥣", label: "Desayuno" },
      { key: "snack_am", emoji: "🍎", label: "Snack AM" },
      { key: "lunch", emoji: "🍗", label: "Comida" },
      { key: "snack_pm", emoji: "🥜", label: "Snack PM" },
      { key: "dinner", emoji: "🍽️", label: "Cena" },
    ];
    const mealDur = schedule.meal_duration_min || 30;
    const macroLine = macros
      ? `\n\nObjetivo diario: ${macros.protein}g proteína · ${macros.carbs}g carbos · ${macros.fats}g grasas`
      : "";

    MEAL_SLOTS.forEach((slot, idx) => {
      const meal = meals[idx];
      if (!meal) return;
      const [h, m] = parseHM(schedule.meal_times[slot.key], [8 + idx * 3, 0]);
      // Lo creamos como evento DIARIO para que aparezca cada día
      // Empieza mañana (no hoy) si la hora ya pasó.
      const start = nextDateForDayHM(new Date().getDay(), h, m);
      const end = new Date(start.getTime() + mealDur * 60 * 1000);
      addEvent(lines, {
        uid: `meal-${slot.key}-autopilot@lovable.app`,
        start, end,
        rrule: "FREQ=DAILY",
        summary: `${slot.emoji} ${slot.label}: ${meal.name}`,
        description: `${meal.description}${macroLine}`,
        reminderMin: 0, // las comidas no necesitan alarma agresiva
      });
    });
  }

  // 3) RECORDATORIOS SEMANALES
  if (schedule?.weekly_reminders?.weigh_in) {
    const start = nextDateForDayHM(0, 9, 0); // Domingo 9:00
    const end = new Date(start.getTime() + 10 * 60 * 1000);
    addEvent(lines, {
      uid: "weekly-weighin-autopilot@lovable.app",
      start, end,
      rrule: "FREQ=WEEKLY;BYDAY=SU",
      summary: "⚖️ Pesarse",
      description: "Recuerda registrar tu peso en Autopilot.",
      reminderMin: 15,
    });
  }
  if (schedule?.weekly_reminders?.progress_photo) {
    const start = nextDateForDayHM(0, 10, 0);
    const end = new Date(start.getTime() + 15 * 60 * 1000);
    addEvent(lines, {
      uid: "monthly-progressphoto-autopilot@lovable.app",
      start, end,
      rrule: "FREQ=MONTHLY;BYDAY=1SU",
      summary: "📸 Foto de progreso",
      description: "Hazte una foto y súbela en Autopilot para tu seguimiento mensual.",
      reminderMin: 30,
    });
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || token.length < 16) {
      return new Response("Token requerido", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenRow } = await supabase
      .from("calendar_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow) {
      return new Response("Token inválido", { status: 404, headers: corsHeaders });
    }

    const { data: tp } = await supabase
      .from("training_plan")
      .select("workouts_json")
      .eq("user_id", tokenRow.user_id)
      .maybeSingle();

    const plans = (tp?.workouts_json as DayPlan[]) || [];

    const { data: np } = await supabase
      .from("nutrition_plan")
      .select("meals_json, macros_json")
      .eq("user_id", tokenRow.user_id)
      .maybeSingle();

    const { data: sched } = await supabase
      .from("user_schedule")
      .select("gym_slots, meal_times, meal_duration_min, weekly_reminders")
      .eq("user_id", tokenRow.user_id)
      .maybeSingle();

    const meals = (np?.meals_json as Meal[]) || [];
    const macros = (np?.macros_json as Macros) || null;
    const schedule = sched as UserSchedule | null;

    const ics = buildICS({
      plans,
      schedule,
      meals,
      macros,
      fallback: {
        startHourGym: tokenRow.start_hour_gym,
        startHourActivity: tokenRow.start_hour_activity,
        durationMin: tokenRow.duration_min,
        reminderMin: tokenRow.reminder_min,
      },
    });

    return new Response(ics, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="autopilot.ics"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: corsHeaders });
  }
});