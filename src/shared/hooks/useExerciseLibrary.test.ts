import { describe, expect, it } from "vitest";
import { toLibraryExercise } from "./useExerciseLibrary";

const base = {
  id: "1", name: "Press banca", muscle_group: "Pecho", exercise_type: "Gimnasio", movement_pattern: "Empuje",
  level: 2, image_url: "https://x/p.webp", video_url: null,
};

describe("índice de la biblioteca", () => {
  it("ordena músculos (principal primero) y saca grupos, equipo y modalidad de las relaciones", () => {
    const e = toLibraryExercise({
      ...base,
      source: "wger", license: "CC BY-SA 4.0", license_author: "ana",
      exercise_muscles: [
        { role: "secondary", muscles: { name: "Tríceps braquial", filter_group: "Tríceps", sort: 50 } },
        { role: "primary", muscles: { name: "Pectoral mayor", filter_group: "Pecho", sort: 10 } },
        { role: "secondary", muscles: { name: "Deltoides anterior", filter_group: "Hombros", sort: 30 } },
      ],
      exercise_equipment: [{ equipment: { name: "Barra", sort: 30 } }, { equipment: { name: "Peso corporal", sort: 10 } }],
      exercise_categories: [{ exercise_categories_catalog: { name: "Gimnasio" } }],
    });
    expect(e.groups).toEqual(["Pecho"]);
    expect(e.primaryMuscles).toEqual(["Pectoral mayor"]);
    expect(e.secondaryMuscles).toEqual(["Deltoides anterior", "Tríceps braquial"]);
    expect(e.equipment).toEqual(["Peso corporal", "Barra"]);
    expect(e.modalities).toEqual(["Gimnasio"]);
    expect(e.source).toBe("wger");
  });

  it("sin la migración aplicada usa el grupo y el tipo de siempre", () => {
    const e = toLibraryExercise({ ...base, muscle_group: "Core", exercise_type: "Mixto" });
    expect(e.groups).toEqual(["Abdomen"]);
    expect(e.modalities).toEqual(["Entrenamiento híbrido"]);
    expect(e.source).toBe("autopilot");
    expect(e.instructions).toEqual([]);
  });
});
