import { describe, expect, it, vi } from "vitest";
vi.mock("@/shared/integrations/supabase/client", () => ({ supabase: {} }));
import { exerciseNameFromFile } from "./exerciseDrive";

describe("exerciseNameFromFile", () => {
  it("convierte el nombre del archivo en el nombre del ejercicio", () => {
    expect(exerciseNameFromFile("press-banca_inclinado.gif")).toBe("press banca inclinado");
  });
});
