import { describe, expect, it } from "vitest";
import {
  exerciseSpoken, exerciseSummary, formatReps, formatRest, parseReps, planToSave, repsLabel, repsSpoken, restBase,
  restIsQuick, restLabel, restSeconds, restValue, rowKeys, toFixed, toRange, typedWeight, weightText, withReps,
} from "@/shared/lib/planEditorValues";
import type { DayPlan, GymExerciseEntry } from "@/shared/types/training";

const RESTS = [60, 90, 120, 180];

const ranged = {
  exercise_id: "e1",
  name: "Remo con barra",
  series: 4,
  reps: "8-12",
  weight: "60",
  rest: "75 s",
} as unknown as GymExerciseEntry;

/** Lo que hace «Guardar»: ordenar, marcar como tuyo y serializar a JSON. */
const saved = (draft: DayPlan[]) => JSON.parse(JSON.stringify(planToSave(draft))) as DayPlan[];

describe("editor de rutina: lo guardado se respeta", () => {
  it("guarda unas reps «8-12» y un descanso «75 s» tal cual aunque se edite otro campo", () => {
    const draft: DayPlan[] = [
      { day: "Miércoles", type: "gimnasio", routine_name: "Torso", exercises: [{ ...ranged, weight: "62.5" }] },
      { day: "Lunes", type: "gimnasio", routine_name: "", exercises: [] },
    ];
    const out = saved(draft);
    expect(out).toHaveLength(1);
    expect(out[0].custom).toBe(true);
    expect(out[0].exercises?.[0]).toMatchObject({ reps: "8-12", rest: "75 s", weight: "62.5", series: 4 });
  });

  it("lo que escribe el generador («4-8», «8-15», «15-25», «20-60s», «180s», «90s», «45s», «60s») sale igual byte a byte", () => {
    const exercises = [
      { ...ranged, reps: "4-8", rest: "180s" },
      { ...ranged, reps: "8-15", rest: "90s" },
      { ...ranged, reps: "15-25", rest: "45s" },
      { ...ranged, reps: "20-60s", rest: "60s" },
      { ...ranged, reps: 10, rest: "2 min" },
    ] as unknown as GymExerciseEntry[];
    const draft: DayPlan[] = [{ day: "Lunes", type: "gimnasio", routine_name: "A", exercises }];
    expect(JSON.stringify(saved(draft)[0].exercises)).toBe(JSON.stringify(exercises));
  });
});

describe("repeticiones: número, rango y segundos", () => {
  it("lee números, rangos y segundos del generador sin perder su formato", () => {
    expect(parseReps("10")).toEqual({ kind: "fixed", value: 10, unit: "" });
    expect(parseReps(10)).toEqual({ kind: "fixed", value: 10, unit: "" });
    expect(parseReps(undefined)).toEqual({ kind: "fixed", value: 10, unit: "" });
    expect(parseReps("8-12")).toEqual({ kind: "range", min: 8, max: 12, unit: "" });
    expect(parseReps("8 – 12")).toEqual({ kind: "range", min: 8, max: 12, unit: "" });
    expect(parseReps("20-60s")).toEqual({ kind: "range", min: 20, max: 60, unit: "s" });
    expect(parseReps("30 s")).toEqual({ kind: "fixed", value: 30, unit: "s" });
    expect(parseReps("AMRAP")).toEqual({ kind: "text", text: "AMRAP", value: 10 });
    expect(parseReps("10/lado")).toEqual({ kind: "text", text: "10/lado", value: 10 });
    for (const reps of ["10", "8-12", "4-8", "8-15", "15-25", "20-60s", "30s"]) expect(formatReps(parseReps(reps))).toBe(reps);
  });

  it("«Rango» abre el número a su alrededor y «Fijo» vuelve a su centro, con la unidad intacta", () => {
    expect(formatReps(toRange(parseReps("10")))).toBe("8-12");
    expect(formatReps(toRange(parseReps("1")))).toBe("1-3");
    expect(formatReps(toRange(parseReps("100")))).toBe("98-100");
    expect(formatReps(toRange(parseReps("30s")))).toBe("20-40s");
    expect(formatReps(toRange(parseReps("AMRAP")))).toBe("8-12");
    expect(formatReps(toFixed(parseReps("8-12")))).toBe("10");
    expect(formatReps(toFixed(parseReps("4-8")))).toBe("6");
    expect(formatReps(toFixed(parseReps("8-15")))).toBe("12");
    expect(formatReps(toFixed(parseReps("20-60s")))).toBe("40s");
  });

  it("editar el mínimo o el máximo guarda el rango con su formato («8-12» → «8-14», «20-60s» → «25-60s»)", () => {
    const reps = parseReps("8-12");
    if (reps.kind !== "range") throw new Error("rango esperado");
    expect(formatReps({ ...reps, max: 14 })).toBe("8-14");
    const iso = parseReps("20-60s");
    if (iso.kind !== "range") throw new Error("rango esperado");
    expect(formatReps({ ...iso, min: iso.min + 5 })).toBe("25-60s");
    expect(withReps(ranged, formatReps({ ...reps, min: 6 }))).toMatchObject({ reps: "6-12", rest: "75 s" });
  });

  it("una cifra sigue siendo número si el plan la tenía como número, y texto si era texto", () => {
    expect(withReps({ ...ranged, reps: 10 } as GymExerciseEntry, "11").reps).toBe(11);
    expect(withReps(ranged, "10").reps).toBe("10");
    expect(withReps({ ...ranged, reps: 10 } as GymExerciseEntry, "8-12").reps).toBe("8-12");
  });

  it("resumen y VoiceOver con su unidad y su plural", () => {
    expect(repsLabel("10")).toBe("10 reps");
    expect(repsLabel(1)).toBe("1 rep");
    expect(repsLabel("8-12")).toBe("8-12 reps");
    expect(repsLabel("20-60s")).toBe("20-60 s");
    expect(repsLabel("30s")).toBe("30 s");
    expect(repsLabel("AMRAP")).toBe("AMRAP");
    expect(repsSpoken("8-12")).toBe("de 8 a 12 repeticiones");
    expect(repsSpoken("1")).toBe("1 repetición");
    expect(repsSpoken("20-60s")).toBe("de 20 a 60 segundos");
  });
});

describe("descanso: rápidos y «Otro»", () => {
  it("entiende «180s», «75 s», «2 min», «2,5 min», «1:30» y «1 min 30 s»", () => {
    expect(restSeconds("180s")).toBe(180);
    expect(restSeconds("75 s")).toBe(75);
    expect(restSeconds("90")).toBe(90);
    expect(restSeconds("2 min")).toBe(120);
    expect(restSeconds("2,5 min")).toBe(150);
    expect(restSeconds("1:30")).toBe(90);
    expect(restSeconds("1 min 30 s")).toBe(90);
    expect(restSeconds("60-90 s")).toBeNull();
  });

  it("se ve en segundos o minutos con coma decimal y se guarda como el generador («180s»)", () => {
    expect(formatRest(45)).toBe("45 s");
    expect(formatRest(90)).toBe("90 s");
    expect(formatRest(120)).toBe("2 min");
    expect(formatRest(150)).toBe("2,5 min");
    expect(formatRest(135)).toBe("135 s");
    expect(restLabel("180s")).toBe("3 min");
    expect(restLabel("")).toBe("90 s");
    expect(restLabel("60-90 s")).toBe("60-90 s");
    expect(restValue(180)).toBe("180s");
    expect(restValue(75)).toBe("75s");
  });

  it("un descanso fuera de los rápidos se ve como «Otro», sin cambiarlo", () => {
    expect(restIsQuick("90s", RESTS)).toBe(true);
    expect(restIsQuick("2 min", RESTS)).toBe(true);
    expect(restIsQuick("", RESTS)).toBe(true);
    expect(restIsQuick("75 s", RESTS)).toBe(false);
    expect(restIsQuick("45s", RESTS)).toBe(false);
    expect(restIsQuick("60-90 s", RESTS)).toBe(false);
    expect(restBase("75 s")).toBe(75);
    expect(restBase("60-90 s")).toBe(60);
    expect(restBase("")).toBe(90);
  });
});

describe("peso", () => {
  it("se ve con coma decimal aunque esté guardado como número", () => {
    expect(weightText("62.5")).toBe("62,5");
    expect(weightText(62.5)).toBe("62,5");
    expect(weightText(undefined)).toBe("");
  });

  it("se guarda con punto y una sola coma decimal («62,5,5» no queda «62.5,5»)", () => {
    expect(typedWeight("62,5")).toBe("62.5");
    expect(typedWeight("62,")).toBe("62.");
    expect(typedWeight("62,5,")).toBe("62.5");
    expect(typedWeight("62,5,5")).toBe("62.55");
    expect(typedWeight("60 kg")).toBe("60");
    expect(typedWeight("")).toBe("");
  });
});

describe("fila", () => {
  it("resumen «4 series · 8-12 reps · 75 s» y su lectura para VoiceOver", () => {
    expect(exerciseSummary(ranged)).toBe("4 series · 8-12 reps · 75 s");
    expect(exerciseSummary({ series: 1, reps: "20-60s", rest: "180s" } as unknown as GymExerciseEntry)).toBe("1 serie · 20-60 s · 3 min");
    expect(exerciseSpoken(ranged)).toBe("Remo con barra: 4 series, de 8 a 12 repeticiones, descanso de 75 segundos");
  });

  it("cada fila tiene una clave estable aunque cambie de sitio o se repita", () => {
    const a = { exercise_id: "a", name: "A" };
    const b = { exercise_id: "b", name: "B" };
    expect(rowKeys([a, b])).toEqual(["a|A#0", "b|B#0"]);
    expect(rowKeys([b, a])).toEqual(["b|B#0", "a|A#0"]);
    expect(rowKeys([a, a])).toEqual(["a|A#0", "a|A#1"]);
  });
});
