import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(`.claude/empresa/${f}`, "utf8");

describe("Atlas operating memory", () => {
  it("keeps every required state section", () => {
    const estado = read("ESTADO.md");
    for (const s of ["Objetivo del fundador", "Estrategia vigente", "Organización", "Tareas", "Aprobaciones pendientes", "Decisiones", "Próxima acción"]) {
      expect(estado).toContain(`## ${s}`);
    }
  });

  it("never lists a metric value without a source", () => {
    const rows = read("METRICAS.md").split("\n").filter((l) => /^\|\s*(\d{4}|—)/.test(l));
    for (const r of rows) expect(r.split("|").map((c) => c.trim())[4]).toBeTruthy();
  });
});
