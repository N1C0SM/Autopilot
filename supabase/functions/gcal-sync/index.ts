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

function parseHM(s: string | undefined, fallback: [number, number]): [number, number] {
  if (!s) return fallback;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  return [parseInt(m[1]), parseInt(m[2])];
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
function toRFC3339(d: Date) { return d.toISOString(); }
// Google event IDs MUST match: lowercase a-v + digits 0-9, length 5-1024.
// Map any other char to its position in the alphabet [0-9a-v].
const ALPHABET = "0123456789abcdefghijklmnopqrstuv"; // 32 chars
function eventId(slug: string) {
  let out = "";
  for (const ch of slug.toLowerCase()) {
    if (/[0-9a-v]/.test(ch)) { out += ch; continue; }
    // Deterministic mapping for invalid chars
    out += ALPHABET[ch.charCodeAt(0) % 32];
  }
  // Ensure length >= 5 and starts with a letter
  if (out.length < 5) out = "ap" + out + "00000".slice(0, 5 - out.length);
  if (!/^[a-v]/.test(out)) out = "a" + out;
  return out.slice(0, 200);
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Refresh failed: ${await res.text()}`);
  return await res.json() as { access_token: string; expires_in: number };
}

async function upsertEvent(accessToken: string, calendarId: string, ev: Record<string, unknown>) {
  const id = ev.id as string;
  // Try PUT (update if exists)
  const putRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${id}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(ev),
    }
  );
  if (putRes.ok) return { ok: true, action: "updated" };
  // If 404, create with insert (id allowed in body)
  if (putRes.status === 404 || putRes.status === 410) {
    const postRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(ev),
      }
    );
    if (!postRes.ok) {
      const txt = await postRes.text();
      return { ok: false, error: `POST ${postRes.status}: ${txt}` };
    }
    return { ok: true, action: "created" };
  }
  const txt = await putRes.text();
  return { ok: false, error: `PUT ${putRes.status}: ${txt}` };
}

async function listAutopilotEventIds(accessToken: string, calendarId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("privateExtendedProperty", "source=autopilot");
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("showDeleted", "false");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) break;
    const data = await res.json();
    for (const item of (data.items || [])) if (item.id) ids.push(item.id);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return ids;
}

async function deleteEvent(accessToken: string, calendarId: string, id: string) {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${id}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No auth" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tok } = await admin
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!tok) return json({ error: "Not connected" }, 400);

    let accessToken = tok.access_token as string;
    if (new Date(tok.expiry_at).getTime() <= Date.now()) {
      const refreshed = await refreshAccessToken(tok.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString();
      await admin.from("google_calendar_tokens").update({
        access_token: accessToken,
        expiry_at: newExpiry,
      }).eq("user_id", user.id);
    }

    const calendarId = tok.calendar_id || "primary";

    const [{ data: tp }, { data: np }, { data: sched }] = await Promise.all([
      admin.from("training_plan").select("workouts_json").eq("user_id", user.id).maybeSingle(),
      admin.from("nutrition_plan").select("meals_json, macros_json").eq("user_id", user.id).maybeSingle(),
      admin.from("user_schedule").select("gym_slots, meal_times, meal_duration_min, weekly_reminders").eq("user_id", user.id).maybeSingle(),
    ]);

    const plans = (tp?.workouts_json as any[]) || [];
    const meals = (np?.meals_json as any[]) || [];
    const macros = np?.macros_json as any;
    const schedule = sched as any;

    const events: any[] = [];

    // 1) Workouts (weekly recurring)
    for (const plan of plans) {
      const dow = DAY_INDEX[plan.day];
      const rrule = DAY_RRULE[plan.day];
      if (dow === undefined) continue;
      const slot = schedule?.gym_slots?.find((s: any) => s.day === dow);
      const [h, m] = slot ? parseHM(slot.start, [18, 0]) : [plan.type === "gimnasio" ? 18 : 19, 0];
      const dur = slot?.duration ?? 60;
      const start = nextDateForDayHM(dow, h, m);
      const end = new Date(start.getTime() + dur * 60 * 1000);
      const title = plan.type === "gimnasio" ? `🏋️ ${plan.routine_name || "Entrenamiento"}` : `🔥 ${plan.sport || "Actividad"}`;
      const description = plan.type === "gimnasio"
        ? `Músculos: ${plan.muscle_focus || "-"}\n\n${(plan.exercises || []).map((e: any, i: number) => `${i + 1}. ${e.name} — ${e.series}x${e.reps} (descanso ${e.rest})`).join("\n")}`
        : `Intensidad: ${plan.intensity || "-"}\nDuración: ${plan.duration || "-"}`;
      events.push({
        id: eventId(`workout-${plan.day}-${plan.type}`),
        summary: title,
        description,
        start: { dateTime: toRFC3339(start), timeZone: "Europe/Madrid" },
        end: { dateTime: toRFC3339(end), timeZone: "Europe/Madrid" },
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${rrule}`],
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
        extendedProperties: { private: { source: "autopilot", kind: "workout" } },
      });
    }

    // 2) Meals (daily recurring)
    if (meals.length > 0 && schedule?.meal_times) {
      const MEAL_SLOTS = [
        { key: "breakfast", emoji: "🥣", label: "Desayuno" },
        { key: "snack_am", emoji: "🍎", label: "Snack AM" },
        { key: "lunch", emoji: "🍗", label: "Comida" },
        { key: "snack_pm", emoji: "🥜", label: "Snack PM" },
        { key: "dinner", emoji: "🍽️", label: "Cena" },
      ];
      const mealDur = schedule.meal_duration_min || 30;
      const macroLine = macros ? `\n\nObjetivo diario: ${macros.protein}g proteína · ${macros.carbs}g carbos · ${macros.fats}g grasas` : "";
      MEAL_SLOTS.forEach((slot, idx) => {
        const meal = meals[idx];
        if (!meal) return;
        const [h, m] = parseHM(schedule.meal_times[slot.key], [8 + idx * 3, 0]);
        const start = nextDateForDayHM(new Date().getDay(), h, m);
        const end = new Date(start.getTime() + mealDur * 60 * 1000);
        events.push({
          id: eventId(`meal-${slot.key}`),
          summary: `${slot.emoji} ${slot.label}: ${meal.name}`,
          description: `${meal.description}${macroLine}`,
          start: { dateTime: toRFC3339(start), timeZone: "Europe/Madrid" },
          end: { dateTime: toRFC3339(end), timeZone: "Europe/Madrid" },
          recurrence: ["RRULE:FREQ=DAILY"],
          reminders: { useDefault: false, overrides: [] },
          extendedProperties: { private: { source: "autopilot", kind: "meal" } },
        });
      });
    }

    // 3) Weekly reminders
    if (schedule?.weekly_reminders?.weigh_in) {
      const start = nextDateForDayHM(0, 9, 0);
      const end = new Date(start.getTime() + 10 * 60 * 1000);
      events.push({
        id: eventId("weekly-weighin"),
        summary: "⚖️ Pesarse",
        description: "Recuerda registrar tu peso en Autopilot.",
        start: { dateTime: toRFC3339(start), timeZone: "Europe/Madrid" },
        end: { dateTime: toRFC3339(end), timeZone: "Europe/Madrid" },
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=SU"],
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
        extendedProperties: { private: { source: "autopilot", kind: "reminder" } },
      });
    }
    if (schedule?.weekly_reminders?.progress_photo) {
      const start = nextDateForDayHM(0, 10, 0);
      const end = new Date(start.getTime() + 15 * 60 * 1000);
      events.push({
        id: eventId("monthly-photo"),
        summary: "📸 Foto de progreso",
        description: "Hazte una foto y súbela en Autopilot para tu seguimiento mensual.",
        start: { dateTime: toRFC3339(start), timeZone: "Europe/Madrid" },
        end: { dateTime: toRFC3339(end), timeZone: "Europe/Madrid" },
        recurrence: ["RRULE:FREQ=MONTHLY;BYDAY=1SU"],
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
        extendedProperties: { private: { source: "autopilot", kind: "reminder" } },
      });
    }

    // Upsert all events
    let synced = 0; const errors: string[] = [];
    const wantedIds = new Set(events.map(e => e.id));
    for (const ev of events) {
      const r = await upsertEvent(accessToken, calendarId, ev);
      if (r.ok) synced++; else errors.push(`${ev.summary}: ${r.error}`);
    }

    // Delete orphan events (previously created by Autopilot but no longer in plan)
    let deleted = 0;
    try {
      const existingIds = await listAutopilotEventIds(accessToken, calendarId);
      for (const id of existingIds) {
        if (!wantedIds.has(id)) {
          await deleteEvent(accessToken, calendarId, id);
          deleted++;
        }
      }
    } catch (e) {
      errors.push(`cleanup: ${String(e)}`);
    }

    await admin.from("google_calendar_tokens").update({ last_sync_at: new Date().toISOString() }).eq("user_id", user.id);

    return json({ success: true, synced, total: events.length, deleted, errors });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}