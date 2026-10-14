import { describe, expect, it } from "vitest";
import { evolutionLabel, photoPose } from "./progressPhotos";

describe("progress photo helpers", () => {
  it("reads the pose from the scan note", () => {
    expect(photoPose("Scan · frente")).toBe("front");
    expect(photoPose("Scan · espalda")).toBe("back");
    expect(photoPose("")).toBe("other");
    expect(photoPose(null)).toBe("other");
  });

  it("describes the time between two photos in days, then weeks", () => {
    expect(evolutionLabel("2025-01-01", "2025-01-02")).toBe("1 día de evolución");
    expect(evolutionLabel("2025-01-01", "2025-01-11")).toBe("10 días de evolución");
    expect(evolutionLabel("2025-01-01", "2025-03-01")).toBe("8 semanas de evolución");
  });
});
