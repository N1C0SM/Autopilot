import { describe, expect, it } from "vitest";
import {
  DATASET_URL, catalogNameKey, cleanName, draftCredits, mapEquipment, mapModalities, mapMuscles, planImport, toDraft,
  type DatasetRow,
} from "../../../supabase/functions/_shared/exercise-catalog";
import { attribution, nameKey } from "./exerciseLibrary";

const row = (id: string, name: string, over: Partial<DatasetRow> = {}): DatasetRow => ({
  id, name, body_part: "chest", equipment: "barbell", target: "pectorals", secondary_muscles: [],
  instruction_steps: { es: ["Paso uno.", " Paso dos. "] }, ...over,
});

describe("catálogo base (datos MIT, visual propio)", () => {
  it("solo descarga los datos, fijados a un commit, nunca las imágenes ni los GIF", () => {
    expect(DATASET_URL).toMatch(/\/[0-9a-f]{40}\/data\/exercises\.json$/);
  });

  it("normaliza nombres igual que la biblioteca", () => {
    for (const n of ["Elevación lateral (polea)", "Close-grip press", "Ñandú 3/4"]) expect(catalogNameKey(n)).toBe(nameKey(n));
    expect(cleanName("barbell upright row v. 3")).toBe("barbell upright row");
    expect(cleanName("star jump (male)")).toBe("star jump");
  });

  it("pasa músculos, equipo y modalidad a los de Autopilot", () => {
    expect(mapMuscles(row("1", "dumbbell lateral raise", { target: "delts", secondary_muscles: ["Shoulders", "traps", "feet"] })))
      .toEqual({ primary: ["deltoides-lateral"], secondary: ["deltoides-anterior", "trapecio"] });
    expect(mapMuscles(row("2", "face pull", { target: "delts" })).primary).toEqual(["deltoides-posterior"]);
    expect(mapEquipment(row("3", "pull-up", { equipment: "body weight" }))).toEqual(["Peso corporal", "Barra de dominadas"]);
    expect(mapEquipment(row("4", "chest dip", { equipment: "weighted" }))).toEqual(["Otros", "Paralelas"]);
    expect(mapEquipment(row("5", "lever chest press", { equipment: "leverage machine" }))).toEqual(["Máquinas"]);
    expect(mapModalities(row("6", "pull-up", { equipment: "body weight" }))).toEqual(["Calistenia"]);
    expect(mapModalities(row("7", "kettlebell swing", { equipment: "kettlebell" }))).toEqual(["Entrenamiento funcional"]);
    expect(mapModalities(row("8", "seated glute stretch", { equipment: "body weight" }))).toEqual(["Movilidad"]);
    expect(mapModalities(row("9", "run", { body_part: "cardio", equipment: "body weight" }))).toEqual(["Entrenamiento funcional"]);
    expect(mapModalities(row("10", "barbell bench press"))).toEqual(["Gimnasio"]);
  });

  it("crea el borrador con los pasos en español y el grupo de siempre", () => {
    expect(toDraft(row("0025", "barbell bench press"))).toMatchObject({
      source_ref: "0025", name: "Barbell bench press", instructions: ["Paso uno.", "Paso dos."],
      muscle_group: "Pecho", exercise_type: "Gimnasio", primary: ["pectoral"], equipment: ["Barra"], modalities: ["Gimnasio"],
    });
  });

  it("una ficha por ejercicio: sin variantes, sin repetir importaciones ni nombres que ya existen", () => {
    const plan = planImport([
      row("0003", "barbell upright row v. 2"), row("0002", "barbell upright row"), row("0004", "barbell upright row v. 3"),
      row("0010", "dumbbell close grip press"), row("0011", "dumbbell close-grip press"),
      row("0020", "burpee", { body_part: "cardio", equipment: "body weight" }),
      row("0030", "star jump (male)", { body_part: "cardio", equipment: "body weight" }),
      row("0040", "barbell bench press"),
    ], { refs: ["0040"], names: ["Burpee"] });
    expect(plan.drafts.map((d) => [d.source_ref, d.name])).toEqual([
      ["0002", "Barbell upright row"], ["0010", "Dumbbell close grip press"], ["0030", "Star jump"],
    ]);
    expect(plan).toMatchObject({ total: 8, variants: 3, alreadyImported: 1, nameTaken: ["Burpee"] });
  });

  it("las fichas importadas se muestran como de Autopilot, sin marca ajena", () => {
    expect(attribution({ source: "exercises-dataset", license: "MIT", licenseAuthor: "x" } as Parameters<typeof attribution>[0])).toBeNull();
  });

  it("estima el coste de redactar con IA", () => {
    expect(draftCredits(1288)).toBeCloseTo(9.7, 1);
  });
});
