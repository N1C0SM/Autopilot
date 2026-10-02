import { describe, expect, it } from "vitest";
import { parseLocalDate, toLocalDateString } from "./localDates";

describe("local date helpers", () => {
  it("formats the calendar date in local time", () => {
    expect(toLocalDateString(new Date(2025, 0, 2, 0, 15))).toBe("2025-01-02");
  });

  it("parses date-only values without converting them from UTC", () => {
    const parsed = parseLocalDate("2025-01-02");
    expect(toLocalDateString(parsed)).toBe("2025-01-02");
  });
});
