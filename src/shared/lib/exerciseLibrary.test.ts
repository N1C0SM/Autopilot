import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS, attribution, filterLibrary, legacyGroups, nameKey, similarExercises, subtitle,
  type LibraryExercise,
} from "./exerciseLibrary";

const ex = (name: string, over: Partial<LibraryExercise> = {}): LibraryExercise => ({
  id: name, slug: nameKey(name).replace(/ /g, "-"), name, altNames: [], groups: [], primaryMuscles: [], secondaryMuscles: [],
  equipment: [], modalities: [], pattern: null, level: null, stimulus: null, load: null, image: null, video: null, description: null,
  instructions: [], mistakes: [], tips: [], safety: [], source: "autopilot", license: null, licenseAuthor: null, sourceUrl: null,
  ...over,
});

const bench = ex("Press banca", { groups: ["Pecho", "Tríceps"], primaryMuscles: ["Pectoral mayor"], equipment: ["Barra"], modalities: ["Gimnasio"], pattern: "Empuje" });
const dbBench = ex("Press con mancuernas", { groups: ["Pecho"], equipment: ["Mancuernas"], modalities: ["Gimnasio"], pattern: "Empuje" });
const pushup = ex("Flexiones", { altNames: ["Push-up"], groups: ["Pecho"], equipment: ["Peso corporal"], modalities: ["Calistenia"], pattern: "Empuje" });
const squat = ex("Sentadilla búlgara", { groups: ["Cuádriceps", "Glúteos"], equipment: ["Mancuernas"], modalities: ["Gimnasio"], pattern: "Sentadilla" });
const burpee = ex("Burpee", { groups: ["Pecho", "Cuádriceps", "Abdomen"], equipment: ["Peso corporal"], modalities: ["Entrenamiento funcional"] });
const all = [squat, pushup, bench, burpee, dbBench];

describe("biblioteca de ejercicios", () => {
  it("normaliza igual que la clave SQL", () => {
    expect(nameKey("  Elevación  LATERAL (polea)!")).toBe("elevacion lateral polea");
  });

  it("sin filtros devuelve todo en orden alfabético", () => {
    expect(filterLibrary(all, EMPTY_FILTERS).map((e) => e.name)).toEqual([
      "Burpee", "Flexiones", "Press banca", "Press con mancuernas", "Sentadilla búlgara",
    ]);
  });

  it("busca sin acentos, por nombre alternativo y con una errata", () => {
    const names = (query: string) => filterLibrary(all, { ...EMPTY_FILTERS, query }).map((e) => e.name);
    expect(names("bulgara")).toEqual(["Sentadilla búlgara"]);
    expect(names("push")).toEqual(["Flexiones"]);
    expect(names("sentadila")).toEqual(["Sentadilla búlgara"]);
    expect(names("press man")).toEqual(["Press con mancuernas"]);
    expect(names("zzz")).toEqual([]);
  });

  it("combina filtros: Y entre facetas, O dentro de cada una", () => {
    const names = (f: Partial<typeof EMPTY_FILTERS>) => filterLibrary(all, { ...EMPTY_FILTERS, ...f }).map((e) => e.name);
    expect(names({ groups: ["Pecho"], equipment: ["Mancuernas", "Barra"] })).toEqual(["Press banca", "Press con mancuernas"]);
    expect(names({ groups: ["Pecho"], modalities: ["Calistenia"] })).toEqual(["Flexiones"]);
    expect(names({ groups: ["Cuerpo completo"] })).toEqual(["Burpee"]);
  });

  it("propone parecidos por grupo principal, patrón y equipo", () => {
    expect(similarExercises(bench, all).map((e) => e.name)).toEqual(["Flexiones", "Press con mancuernas", "Burpee"]);
    expect(similarExercises(squat, all)).toEqual([]);
  });

  it("los ejercicios antiguos se filtran por su grupo de siempre", () => {
    expect(legacyGroups("Core")).toEqual(["Abdomen"]);
    expect(legacyGroups("Piernas")).toEqual(["Cuádriceps"]);
    expect(legacyGroups(null)).toEqual([]);
  });

  it("muestra subtítulo y la atribución obligatoria de wger", () => {
    expect(subtitle(bench)).toBe("Pectoral mayor · Barra");
    expect(attribution(bench)).toBeNull();
    expect(attribution(ex("Remo", { source: "wger", licenseAuthor: "deusinvictus", license: "CC BY-SA 4.0" })))
      .toBe("Fuente: wger.de · deusinvictus · CC BY-SA 4.0");
  });
});
