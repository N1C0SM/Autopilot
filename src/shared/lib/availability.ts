/** Read both current onboarding capacity and legacy weekday selections. */
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const weekdayAliases = [
  ["lunes", "lun", "monday", "mon"],
  ["martes", "mar", "tuesday", "tue"],
  ["miercoles", "mie", "wednesday", "wed"],
  ["jueves", "jue", "thursday", "thu"],
  ["viernes", "vie", "friday", "fri"],
  ["sabado", "sab", "saturday", "sat"],
  ["domingo", "dom", "sunday", "sun"],
];

const numericValue = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(typeof value === "string" ? value.trim().replace(",", ".") : value);
  return Number.isFinite(number) ? number : null;
};

export function getAvailabilityDayCount(value: unknown): number | null {
  const availability = asRecord(value);
  if (!availability) return null;
  const explicitDays = numericValue(availability.days);
  if (explicitDays !== null && Number.isInteger(explicitDays) && explicitDays >= 0 && explicitDays <= 7) return explicitDays;

  if (Array.isArray(availability.training_days)) {
    return new Set(availability.training_days.filter((day): day is number =>
      typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
    )).size;
  }

  const selected = new Set<number>();
  let hasWeekday = false;
  for (const [key, selectedValue] of Object.entries(availability)) {
    const normalized = key.toLocaleLowerCase("es-ES").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const weekday = weekdayAliases.findIndex((aliases) => aliases.includes(normalized));
    if (weekday === -1) continue;
    hasWeekday = true;
    if (selectedValue === true || selectedValue === 1 || selectedValue === "true" || selectedValue === "1") selected.add(weekday);
  }
  return hasWeekday ? selected.size : null;
}

/**
 * Días de entreno con los que generate-plan prepara el plan, con su misma regla
 * (`supabase/functions/generate-plan/index.ts`): los días de «Mi horario» (`user_schedule.gym_slots`)
 * o, si no hay, los elegidos en el cuestionario (`training_days`, 0 = domingo); sin ninguno válido,
 * cuántas franjas hay o su número de días (`days`), y si tampoco, 4. Entre 0 y 7.
 * Es `CustomRoutines.trainingFrequency` en la app.
 */
export function planTrainingDays(availability: unknown, gymSlots?: unknown): number {
  const record = asRecord(availability) ?? {};
  const slots = Array.isArray(gymSlots) ? gymSlots : [];
  const picked: unknown[] = slots.length > 0
    ? slots.map((slot) => asRecord(slot)?.day)
    : Array.isArray(record.training_days) ? record.training_days : [];
  const chosen = new Set(picked.flatMap((day) => {
    const n = typeof day === "number" ? day : typeof day === "string" && day.trim() !== "" ? Number(day) : NaN;
    return Number.isInteger(n) && n >= 0 && n <= 6 ? [n] : [];
  }));
  const days = chosen.size > 0 ? chosen.size : slots.length > 0 ? slots.length : Number.parseInt(String(record.days || "4"), 10);
  return Number.isFinite(days) ? Math.min(Math.max(Math.floor(days), 0), 7) : 4;
}

export function getAvailabilityHours(value: unknown): number | null {
  const hours = numericValue(asRecord(value)?.hours);
  return hours !== null && hours > 0 && hours <= 24 ? hours : null;
}

export type SavedSchedule = { dow: number; start: string; end: string };

const savedSchedule = (value: unknown): SavedSchedule | null => {
  const schedule = asRecord(value);
  return schedule && typeof schedule.dow === "number" && Number.isInteger(schedule.dow) && schedule.dow >= 0 && schedule.dow <= 6
    && typeof schedule.start === "string" && typeof schedule.end === "string"
    ? { dow: schedule.dow, start: schedule.start, end: schedule.end } : null;
};

export function getSportSchedules(value: unknown): Record<string, SavedSchedule> {
  return Object.fromEntries(Object.entries(asRecord(asRecord(value)?.sport_schedules) || {}).flatMap(([sport, item]) => {
    const schedule = savedSchedule(item);
    return schedule ? [[sport, schedule]] : [];
  }));
}

export function getCustomActivities(value: unknown): Array<SavedSchedule & { title: string }> {
  const activities = asRecord(value)?.custom_activities;
  return Array.isArray(activities) ? activities.flatMap((item) => {
    const schedule = savedSchedule(item);
    const title = asRecord(item)?.title;
    return schedule && typeof title === "string" ? [{ ...schedule, title }] : [];
  }) : [];
}
