import { describe, expect, it } from "vitest";
import { getAvailabilityDayCount, getAvailabilityHours, getSportSchedules, getCustomActivities } from "@/shared/lib/availability";

describe("onboarding availability", () => {
  it("reads explicit capacity without counting metadata or schedule objects", () => {
    expect(getAvailabilityDayCount({ days: "2", hours: "0.92", auto_calculated: true, primary_focus: "strength", custom_activities: [], sport_schedules: {} })).toBe(2);
    expect(getAvailabilityHours({ days: "2", hours: "0.92" })).toBe(0.92);
    expect(getAvailabilityDayCount({ days: 3, training_days: [0, 1, 2, 3, 4] })).toBe(3);
  });

  it("counts legacy weekday aliases once and ignores false values and metadata", () => {
    expect(getAvailabilityDayCount({ Lunes: true, monday: true, miércoles: "true", viernes: false, domingo: "false", auto_calculated: true, hours: 1, days_available: 7 })).toBe(2);
    expect(getAvailabilityDayCount({ mon: false, tue: false })).toBe(0);
  });

  it("falls back to selected weekdays and deduplicates valid indices", () => {
    expect(getAvailabilityDayCount({ training_days: [2, 5, 5, -1, 7, "3"] })).toBe(2);
    expect(getAvailabilityDayCount({ days: "", training_days: [0, 6] })).toBe(2);
  });

  it("keeps absent or invalid capacity unknown", () => {
    for (const value of [null, [], "2", {}, { auto_calculated: true }, { days: "10" }, { days: 2.5 }, { days: true }]) {
      expect(getAvailabilityDayCount(value)).toBeNull();
    }
    expect(getAvailabilityHours({ hours: "0,92" })).toBe(0.92);
    expect(getAvailabilityHours({ hours: "" })).toBeNull();
    expect(getAvailabilityHours({ hours: false })).toBeNull();
  });

  it("reads saved schedules while rejecting malformed days and activities", () => {
    const saved = {
      sport_schedules: { boxeo: { dow: 2, start: "18:00", end: "19:00" }, bad: { dow: 8, start: "18:00", end: "19:00" } },
      custom_activities: [null, { title: 42, dow: 1, start: "08:00", end: "09:00" }, { title: "Trabajo", dow: 1, start: "08:00", end: "09:00" }],
    };
    expect(getSportSchedules(saved)).toEqual({ boxeo: { dow: 2, start: "18:00", end: "19:00" } });
    expect(getCustomActivities(saved)).toEqual([{ title: "Trabajo", dow: 1, start: "08:00", end: "09:00" }]);
    expect(getSportSchedules(null)).toEqual({});
    expect(getCustomActivities({ custom_activities: {} })).toEqual([]);
  });
});
