import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ToolContext } from "@lovable.dev/mcp-js";
import getProfile from "./tools/get-profile";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const context = () => new ToolContext({
  type: "oauth",
  principal: { claims: { sub: "auth-user" }, sub: "auth-user", issuer: "https://example.com/auth", resource: "mcp", acceptedAudiences: ["authenticated"], scopes: [] },
  bearer: { token: "fixture-token" },
});

describe("MCP user profile", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    vi.stubEnv("SUPABASE_URL", "https://example.com");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture-key");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("finds the authenticated profile when the profile row has a different primary id", async () => {
    const profile = { id: "profile-row", user_id: "auth-user", name: "QA" };
    mocks.createClient.mockImplementation(() => ({
      from: () => {
        let field = "";
        let value: unknown;
        const query = {
          select: () => query,
          eq: (column: string, expected: unknown) => { field = column; value = expected; return query; },
          maybeSingle: async () => ({ data: Object.entries(profile).some(([key, actual]) => key === field && actual === value) ? profile : null, error: null }),
        };
        return query;
      },
    }));
    const result = await getProfile.handler({}, context());
    expect(result.structuredContent).toEqual({ profile });
    expect(mocks.createClient.mock.calls[0][2].global.headers.Authorization).toBe("Bearer fixture-token");
  });

  it("rejects an unauthenticated call before opening the database", async () => {
    expect((await getProfile.handler({}, new ToolContext(undefined))).isError).toBe(true);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("fails clearly when server configuration is missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    await expect(getProfile.handler({}, context())).rejects.toThrow("Missing Supabase configuration");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
