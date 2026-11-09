import { describe, expect, it } from "vitest";
import { APP_ORIGIN, getDomainRedirect, isAppPath } from "./appDomain";

describe("app domain routing", () => {
  it("keeps the public landing page on the primary domain", () => {
    expect(getDomainRedirect({
      hostname: "autopilotplan.com",
      pathname: "/",
      search: "",
      hash: "",
    })).toBeNull();
  });

  it("moves app routes to the app subdomain and preserves the full destination", () => {
    expect(getDomainRedirect({
      hostname: "www.autopilotplan.com",
      pathname: "/dashboard/user/123",
      search: "?tab=progress",
      hash: "#records",
    })).toBe(`${APP_ORIGIN}/dashboard/user/123?tab=progress#records`);
  });

  it("opens the dashboard as the app subdomain's PWA entry point", () => {
    expect(getDomainRedirect({
      hostname: "app.autopilotplan.com",
      pathname: "/",
      search: "",
      hash: "",
    })).toBe(`${APP_ORIGIN}/dashboard`);
  });

  it("keeps public pages on the primary domain", () => {
    expect(getDomainRedirect({
      hostname: "app.autopilotplan.com",
      pathname: "/legal/privacidad",
      search: "?from=login",
      hash: "",
    })).toBe("https://autopilotplan.com/legal/privacidad?from=login");
  });

  it("does not mistake similarly named public routes for app routes", () => {
    expect(isAppPath("/login-help")).toBe(false);
    expect(getDomainRedirect({
      hostname: "autopilotplan.com",
      pathname: "/blog",
      search: "",
      hash: "",
    })).toBeNull();
  });

  it("does not redirect native app deep links", () => {
    expect(getDomainRedirect({
      hostname: "autopilotplan.com",
      pathname: "/dashboard",
      search: "",
      hash: "",
    }, true)).toBeNull();
  });
});
