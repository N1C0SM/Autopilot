import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { path: string; options?: unknown }[] = [];
let transformFails = false;

vi.mock("@/shared/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: async (path: string, _ttl: number, options?: { transform?: unknown }) => {
          calls.push({ path, options });
          if (options?.transform && transformFails) return { data: null, error: new Error("no transform") };
          return { data: { signedUrl: `${options?.transform ? "render" : "object"}:${path}` }, error: null };
        },
      }),
    },
  },
}));

import { signedUrlFor } from "@/shared/lib/storageSign";

describe("signedUrlFor", () => {
  beforeEach(() => { calls.length = 0; transformFails = false; });

  it("serves HEIC photos converted so browsers can show them", async () => {
    expect(await signedUrlFor("progress-photos", "u/scan_front.heic")).toBe("render:u/scan_front.heic");
  });

  it("falls back to the original file when the conversion is unavailable", async () => {
    transformFails = true;
    expect(await signedUrlFor("progress-photos", "u/scan_front.HEIC")).toBe("object:u/scan_front.HEIC");
  });

  it("signs JPEG photos as they are", async () => {
    expect(await signedUrlFor("progress-photos", "u/foto.jpg")).toBe("object:u/foto.jpg");
    expect(calls).toHaveLength(1);
  });
});
