import { describe, expect, it } from "vitest";
import { appHref, isPrivatePath } from "./appHost";

describe("appHost", () => {
  it("en autopilotplan.com envía a app.autopilotplan.com con la campaña", () => {
    expect(appHref("/onboarding", { hostname: "autopilotplan.com", search: "?utm_source=instagram&x=1" }))
      .toBe("https://app.autopilotplan.com/onboarding?utm_source=instagram");
  });
  it("en preview mantiene la ruta interna", () => {
    expect(appHref("/login", { hostname: "localhost", search: "" })).toBe("/login");
  });
  it("detecta páginas privadas y deja la vuelta de Google en su sitio", () => {
    expect(isPrivatePath("/dashboard/user/1")).toBe(true);
    expect(isPrivatePath("/onboarding-choice")).toBe(true);
    expect(isPrivatePath("/auth/callback")).toBe(false);
    expect(isPrivatePath("/planes")).toBe(false);
  });
});
