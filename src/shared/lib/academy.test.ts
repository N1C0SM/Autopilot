import { describe, it, expect } from "vitest";
import { canPublishAcademy, CATEGORIES, extractToc } from "@/shared/lib/academy";

const ref = [{ authors: "A", year: 2020, title: "T" }];

describe("Academia", () => {
  it("tiene 12 categorías", () => expect(CATEGORIES).toHaveLength(12));
  it("un borrador de la Academia no se puede publicar", () =>
    expect(canPublishAcademy({ category: "fuerza", review_status: "draft", references: ref })).toBe(false));
  it("verificado sin referencias no se puede publicar", () =>
    expect(canPublishAcademy({ category: "fuerza", review_status: "verified", references: [] })).toBe(false));
  it("verificado con referencias sí se puede publicar", () =>
    expect(canPublishAcademy({ category: "fuerza", review_status: "verified", references: ref })).toBe(true));
  it("los artículos normales del blog no tienen este requisito", () =>
    expect(canPublishAcademy({ category: null, review_status: "draft", references: [] })).toBe(true));
  it("el índice usa los encabezados ## y ###", () =>
    expect(extractToc("## Idea clave\ntexto\n### Errores frecuentes").map((t) => t.id)).toEqual(["idea-clave", "errores-frecuentes"]));
});
