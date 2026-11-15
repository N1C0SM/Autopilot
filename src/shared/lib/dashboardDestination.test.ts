import { describe, expect, it } from "vitest";
import { dashboardDestination } from "./dashboardDestination";

describe("navigation from body scan", () => {
  it.each(["home", "library", "nutrition", "progress", "settings"] as const)("opens %s in the user's dashboard", (section) => {
    expect(dashboardDestination("test-account", section)).toBe(`/dashboard/user/test-account?section=${section}`);
  });
});