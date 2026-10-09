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

export function getAvailabilityHours(value: unknown): number | null {
  const hours = numericValue(asRecord(value)?.hours);
  return hours !== null && hours > 0 && hours <= 24 ? hours : null;
}
