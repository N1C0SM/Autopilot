import type { DayPlan } from "@/types/training";

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export interface FirstWeekJourney {
  dayNumber: number;
  startDate: string;
  endDate: string;
  target: number;
  completed: number;
}

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function getFirstWeekJourney(
  createdAt: string,
  dayPlans: DayPlan[],
  today = new Date(),
): Omit<FirstWeekJourney, "completed"> | null {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const start = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOrdinal = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const currentOrdinal = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
  const elapsedDays = Math.round((currentOrdinal - startOrdinal) / 86_400_000);

  if (elapsedDays < 0 || elapsedDays >= 7) return null;

  const plannedDays = new Set(dayPlans.map((plan) => plan.day));
  let target = 0;
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    if (plannedDays.has(DAYS_ES[date.getDay()])) target++;
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    dayNumber: elapsedDays + 1,
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
    target,
  };
}
