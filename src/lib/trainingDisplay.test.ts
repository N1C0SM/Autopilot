import { describe, expect, it } from "vitest";
import { formatTrainingTitle } from "./trainingDisplay";

describe("formatTrainingTitle", () => {
  it("shows the routine and its muscle focus together", () => {
    expect(formatTrainingTitle("Pull B", "Espalda · Bíceps")).toBe("Pull B · Espalda y bíceps");
  });

  it("joins three muscle groups naturally", () => {
    expect(formatTrainingTitle("Push A", "Pecho · Hombros · Tríceps")).toBe("Push A · Pecho, hombros y tríceps");
  });

  it("does not repeat a focus already included in the routine name", () => {
    expect(formatTrainingTitle("Pull B · Espalda · Bíceps", "Espalda · Bíceps")).toBe("Pull B · Espalda · Bíceps");
  });

  it("keeps useful fallback titles", () => {
    expect(formatTrainingTitle("Upper A")).toBe("Upper A");
    expect(formatTrainingTitle(undefined, "Espalda · Bíceps")).toBe("Espalda y bíceps");
  });
});
