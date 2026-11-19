import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getSession: vi.fn(), rpc: vi.fn(), from: vi.fn(), select: vi.fn(), in: vi.fn(),
}));
vi.mock("@/shared/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: api.getSession }, rpc: api.rpc, from: api.from },
}));

describe("brand photo recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    localStorage.clear();
    api.getSession.mockResolvedValue({ data: { session: null } });
    api.from.mockReturnValue({ select: api.select });
    api.select.mockReturnValue({ in: api.in });
  });

  it("uses distinct local photos when the public service is unavailable", async () => {
    api.rpc.mockResolvedValue({ data: null, error: { code: "404" } });
    const { BRAND_PHOTOS, refreshBrandPhotos } = await import("./brandPhotos");
    await refreshBrandPhotos();
    expect(new Set([BRAND_PHOTOS.gym, BRAND_PHOTOS.pullupBar, BRAND_PHOTOS.dumbbells]).size).toBe(3);
    expect(api.from).not.toHaveBeenCalled();
  });

  it("reads current exercise photos directly for a signed-in account", async () => {
    api.getSession.mockResolvedValue({ data: { session: { user: { id: "account" } } } });
    api.in.mockResolvedValue({ data: [{ id: "a31c7206-d2a4-4b31-856a-f5dec09b890e", image_url: "https://example.com/current.png" }] });
    const { BRAND_PHOTOS, refreshBrandPhotos } = await import("./brandPhotos");
    await refreshBrandPhotos();
    expect(BRAND_PHOTOS.gym).toBe("https://example.com/current.png");
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it("removes a deleted photo from storage rather than showing its stale URL", async () => {
    localStorage.setItem("brand-photos-v2", JSON.stringify({ gym: "https://example.com/deleted.png" }));
    api.rpc.mockResolvedValue({ data: [{ id: "a31c7206-d2a4-4b31-856a-f5dec09b890e", image_url: null }], error: null });
    const { BRAND_PHOTOS, refreshBrandPhotos } = await import("./brandPhotos");
    await refreshBrandPhotos();
    expect(BRAND_PHOTOS.gym).not.toBe("https://example.com/deleted.png");
    expect(JSON.parse(localStorage.getItem("brand-photos-v2") ?? "{}")).not.toHaveProperty("gym");
  });

  it("preserves the last known photo during a connection failure", async () => {
    localStorage.setItem("brand-photos-v2", JSON.stringify({ gym: "https://example.com/retained.png" }));
    api.rpc.mockRejectedValue(new Error("offline"));
    const { BRAND_PHOTOS, refreshBrandPhotos } = await import("./brandPhotos");
    await refreshBrandPhotos();
    expect(BRAND_PHOTOS.gym).toBe("https://example.com/retained.png");
  });
});