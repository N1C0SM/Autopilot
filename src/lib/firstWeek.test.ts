import { describe, expect, it } from "vitest";
import { getFirstWeekJourney } from "./firstWeek";
import type { DayPlan } from "@/types/training";

const plans = ["Lunes", "Miércoles", "Viernes"].map((day) => ({
  day,
  type: "gimnasio" as const,
})) satisfies DayPlan[];

describe("getFirstWeekJourney", () => {
  it("returns first-week day and counts scheduled sessions across the signup week", () => {
    const journey = getFirstWeekJourney("2026-10-05T12:00:00", plans, new Date(2026, 9, 7));

    expect(journey).toEqual({
      dayNumber: 3,
      startDate: "2026-10-05",
      endDate: "2026-10-11",
      target: 3,
    });
  });

  it("ends after the seventh calendar day", () => {
    expect(getFirstWeekJourney("2026-10-05T12:00:00", plans, new Date(2026, 9, 12))).toBeNull();
  });

  it("ignores invalid creation dates", () => {
    expect(getFirstWeekJourney("not-a-date", plans)).toBeNull();
  });
});
