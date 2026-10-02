import { describe, it, expect, beforeEach } from "vitest";
import {
  createSession,
  stats,
  previousExercise,
  comparisonKey,
  validResult,
  weeklyMuscles,
  recommendation,
} from "./model";
import { nutritionTotals } from "./nutrition";
const plan = {
  day: "Viernes",
  type: "gimnasio" as const,
  exercises: [
    {
      exercise_id: "press",
      name: "Press",
      series: 12,
      reps: 8,
      weight: "40",
      rest: "60",
      muscle_group: "Pecho",
    },
  ],
};
const complete = () => {
  const s = createSession("user", plan);
  s.status = "completed";
  s.payload.exercises[0].sets.forEach((set) => {
    set.done = true;
    set.actual = { ...set.target, rpe: 7 };
  });
  return s;
};
describe("session correctness", () => {
  it("counts 10/12 as performed with 83% compliance; extras do not inflate compliance", () => {
    const s = complete();
    s.payload.exercises[0].sets[10].done = false;
    s.payload.exercises[0].sets[11].done = false;
    expect(stats(s)).toMatchObject({
      done: 10,
      compliance: 83,
      performed: true,
    });
    s.payload.exercises[0].sets.push({
      ...s.payload.exercises[0].sets[0],
      planned: false,
    });
    expect(stats(s)).toMatchObject({ done: 11, extra: 1, compliance: 83 });
  });
  it("does not count empty or unfinished sessions as performed", () => {
    const s = createSession("user", plan);
    expect(stats(s).performed).toBe(false);
    s.status = "completed";
    expect(stats(s).performed).toBe(false);
  });
  it("uses explicit isometric metadata even with a neutral name and rejects reps without seconds", () => {
    const s = createSession("user", {
      ...plan,
      exercises: [
        {
          ...plan.exercises[0],
          name: "Skill A",
          tracking_kind: "isometric",
          target_seconds: 20,
          variant: "tuck",
        },
      ],
    });
    const e = s.payload.exercises[0];
    expect(e.sets[0].target.seconds).toBe(20);
    expect(validResult(e, { ...e.sets[0].actual, reps: 20 })).toBe(false);
    expect(validResult(e, { ...e.sets[0].actual, seconds: 20 })).toBe(true);
  });
  it("compares latest session across days and preserves variant and assistance boundaries", () => {
    const old = complete();
    old.payload.startedAt = "2026-09-20T10:00:00Z";
    const current = complete();
    current.payload.startedAt = "2026-10-02T10:00:00Z";
    const e = current.payload.exercises[0];
    expect(previousExercise(current, e, [old])?.session.id).toBe(old.id);
    e.variant = "other";
    expect(previousExercise(current, e, [old])).toBeUndefined();
    e.variant = "";
    e.mode = "assisted";
    expect(previousExercise(current, e, [old])).toBeUndefined();
  });
  it("snapshots survive a changed or removed routine", () => {
    const p = structuredClone(plan);
    const s = createSession("user", p);
    p.exercises[0].name = "Deleted";
    p.exercises = [];
    expect(s.payload.exercises[0].name).toBe("Press");
  });
  it("counts only valid completed sets against primary muscle and Monday week", () => {
    const s = complete();
    s.local_date = "2026-10-04";
    s.payload.exercises[0].sets[0].done = false;
    expect(weeklyMuscles([s])).toEqual({ "2026-09-28 · Pecho": 11 });
  });
  it("only proposes progression after adequate comparable targets and effort", () => {
    const a = complete(),
      b = complete();
    expect(recommendation(a, a.payload.exercises[0], [a]).kg).toBeNull();
    expect(recommendation(a, a.payload.exercises[0], [a, b]).kg).toBe(41.25);
    b.payload.exercises[0].sets[0].actual.rpe = 10;
    expect(recommendation(a, a.payload.exercises[0], [a, b]).label).toBe(
      "Revisar",
    );
  });
  it("does not treat missing RPE or variants as evidence for progression", () => {
    const a = complete(),
      b = complete();
    b.payload.exercises[0].variant = "tuck";
    expect(recommendation(a, a.payload.exercises[0], [a, b]).kg).toBeNull();
  });
  it("calculates nutrition only from amounts and known sourced values", () => {
    const values = nutritionTotals([
      {
        meal: "Comida",
        planned: null,
        level: "weighed",
        notes: "",
        foods: [
          {
            name: "Yogur",
            grams: 150,
            source: "Etiqueta",
            calories: 60,
            protein: 4,
            carbs: null,
            fats: 2,
          },
        ],
      },
      { meal: "Cena", planned: null, level: "checkin", notes: "", foods: [] },
    ]);
    expect(values.calories).toEqual({ known: 90, missing: 1 });
    expect(values.carbs).toEqual({ known: 0, missing: 2 });
  });
});
