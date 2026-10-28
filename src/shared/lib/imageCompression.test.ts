import { describe, expect, it } from "vitest";
import { toBrowserFriendlyImage } from "@/shared/lib/imageCompression";

describe("toBrowserFriendlyImage", () => {
  it("leaves JPEG and PNG photos untouched", async () => {
    const jpeg = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    expect(await toBrowserFriendlyImage(jpeg)).toBe(jpeg);
  });

  it("keeps a HEIC photo when the browser cannot decode it", async () => {
    const heic = new File(["x"], "IMG_0001.HEIC", { type: "image/heic" });
    expect(await toBrowserFriendlyImage(heic, 2048, 50)).toBe(heic);
  });
});
