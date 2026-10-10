import { describe, expect, it } from "vitest";
import { getAvailabilityDayCount, getAvailabilityHours } from "./availability";

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
});
