import { describe, expect, it } from "vitest";
import { resolveConfirmWeight } from "@/shared/lib/workoutSet";

describe("resolveConfirmWeight", () => {
  it("respeta lo que escribe el usuario", () => expect(resolveConfirmWeight("60", "80")).toBe("60"));
  it("usa la sugerencia visible si el campo está vacío", () => expect(resolveConfirmWeight("", "72.5")).toBe("72.5"));
  it("no inventa peso sin historial", () => expect(resolveConfirmWeight("", "")).toBe(""));
  it("ignora sugerencias que no son peso", () => expect(resolveConfirmWeight("", "kg")).toBe(""));
});
