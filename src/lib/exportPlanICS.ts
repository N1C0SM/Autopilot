import type { DayPlan } from "@/types/training";

const DAY_INDEX: Record<string, number> = {
  Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 0,
};
import { CYCLE_WEEKS } from "./renewal";

const DAY_RRULE: Record<string, string> = {
  Lunes: "MO", Martes: "TU", Miércoles: "WE", Jueves: "TH", Viernes: "FR", Sábado: "SA", Domingo: "SU",
};

export interface ICSOptions {
  startHourGym: number;
  startHourActivity: number;
  durationMin: number;
  reminderMin: number; // 0 = sin recordatorio
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toICSDate(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    "00Z"
  );
}

function nextDateForDay(targetDow: number, hour: number): Date {
  const now = new Date();
  const today = now.getDay();
  let diff = (targetDow - today + 7) % 7;
  if (diff === 0 && now.getHours() >= hour) diff = 7;
  const d = new Date(now);
  d.setDate(d.getDate() + diff);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function describePlan(plan: DayPlan): { title: string; description: string } {
  if (plan.type === "gimnasio") {
    const title = `🏋️ ${plan.routine_name || "Entrenamiento"}`;
    const ex = (plan.exercises || [])
      .map((e, i) => `${i + 1}. ${e.name} — ${e.series}x${e.reps} (descanso ${e.rest})`)
      .join("\n");
    const description = `Músculos: ${plan.muscle_focus || "-"}\n\n${ex}`;
    return { title, description };
  }
  return {
    title: `🔥 ${plan.sport || "Actividad"}`,
    description: `Intensidad: ${plan.intensity || "-"}\nDuración: ${plan.duration || "-"}`,
  };
}

export function buildICS(dayPlans: DayPlan[], opts: ICSOptions): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Autopilot//Plan//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Mi Plan Autopilot",
    "X-WR-TIMEZONE:Europe/Madrid",
  ];

  for (const plan of dayPlans) {
    const dow = DAY_INDEX[plan.day];
    const rruleDay = DAY_RRULE[plan.day];
    if (dow === undefined) continue;

    const hour = plan.type === "gimnasio" ? opts.startHourGym : opts.startHourActivity;
    const start = nextDateForDay(dow, hour);
    const end = new Date(start.getTime() + opts.durationMin * 60 * 1000);
    const { title, description } = describePlan(plan);
    // UID estable: NO incluye el tipo, para que cambiar un día de gimnasio a
    // actividad actualice el mismo evento en vez de dejar el viejo colgado.
    const uid = `${plan.day.toLowerCase()}-autopilot@lovable.app`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${toICSDate(new Date())}`);
    lines.push(`DTSTART:${toICSDate(start)}`);
    lines.push(`DTEND:${toICSDate(end)}`);
    // COUNT en vez de repetición infinita: el plan dura el ciclo (12 semanas) y
    // una regla sin fin llena el calendario para siempre y no hay forma de
    // quitarla al cambiar de plan. COUNT es seguro con el cambio de hora.
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};COUNT=${CYCLE_WEEKS}`);
    lines.push(`SUMMARY:${escape(title)}`);
    lines.push(`DESCRIPTION:${escape(description)}`);
    if (opts.reminderMin > 0) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${escape(title)}`);
      lines.push(`TRIGGER:-PT${opts.reminderMin}M`);
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(dayPlans: DayPlan[], opts: ICSOptions, filename = "mi-plan-autopilot.ics") {
  const ics = buildICS(dayPlans, opts);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}