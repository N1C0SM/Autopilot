import { describe, it, expect } from "vitest";
import { createSession, comparisonKey } from "./model";
import { seriesPoints } from "./metrics";
const make = () => {
  const s = createSession("user", {
    day: "Lunes",
    type: "gimnasio",
    exercises: [
      {
        exercise_id: "press",
        name: "Press",
        series: 2,
        reps: 8,
        weight: "40",
        rest: "60",
      },
    ],
  });
  s.status = "completed";
  s.payload.exercises[0].sets.forEach((st) => {
    st.done = true;
    st.actual = { ...st.target, rpe: 7 };
  });
  return s;
};
describe("compatible metrics", () => {
  it("never estimates max strength for isometrics or assisted sets", () => {
    const s = make(),
      e = s.payload.exercises[0];
    e.kind = "isometric";
    e.sets.forEach((st) => (st.actual.seconds = 20));
    expect(seriesPoints([s], comparisonKey(e), "e1rm")).toEqual([]);
    e.kind = "weight";
    e.mode = "assisted";
    expect(seriesPoints([s], comparisonKey(e), "e1rm")).toEqual([]);
  });
  it("filters repetitions by exact load and excludes unfinished sets", () => {
    const s = make(),
      e = s.payload.exercises[0];
    e.sets[1].actual.kg = 45;
    e.sets[1].actual.reps = 10;
    expect(seriesPoints([s], comparisonKey(e), "reps", "40")[0].value).toBe(8);
    expect(seriesPoints([s], comparisonKey(e), "reps", "45")[0].value).toBe(10);
    e.sets[1].done = false;
    expect(seriesPoints([s], comparisonKey(e), "reps", "45")).toEqual([]);
  });
  it("recalculates Epley and volume directly from corrected records", () => {
    const s = make(),
      e = s.payload.exercises[0];
    expect(seriesPoints([s], comparisonKey(e), "volume")[0].value).toBe(640);
    e.sets[0].actual.kg = 50;
    expect(seriesPoints([s], comparisonKey(e), "volume")[0].value).toBe(720);
    expect(seriesPoints([s], comparisonKey(e), "e1rm")[0].value).toBe(63.33);
  });
  it("does not mix hold variants, assistance loads or unknown legacy types", () => {
    const s = make(),
      e = s.payload.exercises[0];
    e.kind = "isometric";
    e.mode = "assisted";
    e.variant = "tuck";
    e.sets.forEach((st) => (st.actual.seconds = 20));
    const key = comparisonKey(e);
    expect(seriesPoints([s], key, "seconds")).toEqual([]);
    expect(seriesPoints([s], key, "seconds", "40")[0].value).toBe(20);
    e.variant = "full";
    expect(seriesPoints([s], key, "seconds", "40")).toEqual([]);
    e.kind = "legacy";
    expect(seriesPoints([s], comparisonKey(e), "reps", "40")).toEqual([]);
  });
});
