import { describe, expect, it } from "vitest";
import { DASHBOARD_CHAT_ENABLED } from "@/shared/lib/releaseScope";

describe("current launch scope", () => {
  it("keeps consumer chat unavailable, including paid accounts", () => {
    expect(DASHBOARD_CHAT_ENABLED).toBe(false);
  });
});