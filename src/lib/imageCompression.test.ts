import { describe, expect, it } from "vitest";
import { compressImage } from "./imageCompression";

describe("compressImage", () => {
  it("skips compression for already small files", async () => {
    const smallFile = new File(["tiny"], "photo.jpg", { type: "image/jpeg" });
    const result = await compressImage(smallFile);
    expect(result).toBe(smallFile);
  });

  it("skips compression for non-image files", async () => {
    const textFile = new File(["large text ".repeat(20000)], "document.pdf", { type: "application/pdf" });
    const result = await compressImage(textFile);
    expect(result).toBe(textFile);
  });
});
