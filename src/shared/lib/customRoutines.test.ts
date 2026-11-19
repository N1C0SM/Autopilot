import { describe, expect, it, vi } from "vitest";
import {
  addRoutine, canAddRoutine, commitRoutineChange, copyName, deleteRoutine, duplicateRoutine, markEditedDays, myRoutines,
  nextFreeKey, planMode, planModeCopy, routineFromWorkout, routineMeta, routineMuscles, SESSION_LIMIT_MESSAGE, updateRoutine,
} from "@/shared/lib/customRoutines";
import { planToSave } from "@/shared/lib/planEditorValues";
import type { DayPlan, GymExerciseEntry } from "@/shared/types/training";

const ex = (name: string, muscle = "Pecho", extra: Partial<GymExerciseEntry> = {}): GymExerciseEntry => ({
  exercise_id: `id-${name}`, name, series: 3, reps: 10, weight: "", rest: "90s", muscle_group: muscle, ...extra,
});
const auto = (day: string, name = "Torso A"): DayPlan => ({ day, type: "gimnasio", routine_name: name, muscle_focus: "Pecho y espalda", exercises: [ex(`${name} press`)] });
const KEYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

describe("rutinas propias en workouts_json", () => {
  it("una rutina nueva usa la siguiente clave libre, solo ella es tuya y el plan sigue en orden", () => {
    const plans = [auto("Lunes"), auto("Miércoles", "Pierna")];
    const result = addRoutine(plans, { name: "  Pierna pesada ", exercises: [ex("Sentadilla", "Piernas")] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.day).toBe("Martes");
    expect(result.plans.map((p) => p.day)).toEqual(["Lunes", "Martes", "Miércoles"]);
    const created = result.plans.find((p) => p.day === "Martes")!;
    expect(created).toMatchObject({ type: "gimnasio", routine_name: "Pierna pesada", custom: true });
    // Las sesiones del piloto automático no se marcan.
    expect(result.plans.filter((p) => p.custom === true).map((p) => p.day)).toEqual(["Martes"]);
    expect(myRoutines(result.plans).map((p) => p.routine_name)).toEqual(["Pierna pesada"]);
  });

  it("sin plan (sin fila) crea el plan solo con la rutina", () => {
    const result = addRoutine([], { name: "", exercises: [ex("Dominadas", "Espalda")] });
    expect(result).toMatchObject({ ok: true, day: "Lunes" });
    if (result.ok) expect(result.plans).toEqual([expect.objectContaining({ day: "Lunes", routine_name: "Mi rutina", custom: true })]);
  });

  it("con siete sesiones no cabe otra: lo dice en vez de fallar en silencio", () => {
    const full = KEYS.map((day) => auto(day));
    expect(nextFreeKey(full)).toBeNull();
    expect(canAddRoutine(full)).toBe(false);
    expect(addRoutine(full, { name: "Otra", exercises: [ex("Remo")] })).toEqual({ ok: false, reason: "limit" });
    expect(duplicateRoutine(full, "Lunes")).toEqual({ ok: false, reason: "limit" });
    expect(SESSION_LIMIT_MESSAGE).toBe("Tienes 7 sesiones: borra o edita una para añadir otra");
  });

  it("duplicar crea «<nombre> (copia)» en otra clave y deja la original igual", () => {
    const original = { ...auto("Lunes", "Empuje"), custom: true, session_icon: "🏋️" };
    const result = duplicateRoutine([original, auto("Martes")], "Lunes");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.day).toBe("Miércoles");
    const copy = result.plans.find((p) => p.day === "Miércoles")!;
    expect(copy).toMatchObject({ routine_name: "Empuje (copia)", custom: true, session_icon: "🏋️" });
    expect(copy.exercises).toEqual(original.exercises);
    expect(copy.exercises).not.toBe(original.exercises);
    expect(result.plans.find((p) => p.day === "Lunes")).toEqual(original);
    expect(copyName("")).toBe("Mi rutina (copia)");
  });

  it("editar marca solo esa sesión y borrar la quita sin tocar las demás", () => {
    const plans = [auto("Lunes"), { ...auto("Martes", "Mía"), custom: true }];
    const edited = updateRoutine(plans, "Lunes", { name: "Torso pesado", exercises: [ex("Press banca")] });
    expect(edited.ok && edited.plans.map((p) => p.custom ?? false)).toEqual([true, true]);
    expect(edited.ok && edited.plans[0].routine_name).toBe("Torso pesado");
    const removed = deleteRoutine(plans, "Martes");
    expect(removed.ok && removed.plans).toEqual([auto("Lunes")]);
    expect(deleteRoutine(plans, "Domingo")).toEqual({ ok: false, reason: "missing" });
  });

  it("el editor de rutina marca solo los días que cambian (antes marcaba todos)", () => {
    const original = [auto("Lunes"), auto("Miércoles", "Pierna"), { ...auto("Viernes", "Mía"), custom: true }];
    const draft = original.map((p) => (p.day === "Miércoles" ? { ...p, routine_name: "Pierna B" } : { ...p }));
    const saved = markEditedDays(original, draft);
    expect(saved.map((p) => [p.day, p.custom ?? false])).toEqual([["Lunes", false], ["Miércoles", true], ["Viernes", true]]);
    // Un día nuevo es tuyo; sin cambios, nada se marca.
    expect(markEditedDays(original, [...original, auto("Sábado")]).find((p) => p.day === "Sábado")?.custom).toBe(true);
    expect(markEditedDays(original, original).filter((p) => p.custom).map((p) => p.day)).toEqual(["Viernes"]);
    // `planToSave` del editor usa la misma regla.
    expect(planToSave(draft, original).map((p) => p.custom ?? false)).toEqual([false, true, true]);
  });

  it("modo del plan: automático, tuyo o mezclado", () => {
    expect(planMode([auto("Lunes")])).toBe("auto");
    expect(planMode([{ ...auto("Lunes"), custom: true }])).toBe("custom");
    const mixed = [auto("Lunes"), { ...auto("Martes"), custom: true }];
    expect(planMode(mixed)).toBe("mixed");
    expect(planModeCopy(mixed)).toEqual({ title: "Piloto automático", detail: "Preparada por Autopilot, con 1 rutina tuya." });
    expect(planModeCopy([{ ...auto("Lunes"), custom: true }]).title).toBe("Rutina personalizada");
  });

  it("resumen de la rutina: recuento en singular o plural y músculos sin repetir", () => {
    expect(routineMeta({ exercises: [ex("Press", "Pecho")] })).toBe("1 ejercicio · Pecho");
    expect(routineMuscles({ exercises: [ex("A", "Pecho"), ex("B", "Espalda"), ex("C", "pecho"), ex("D", "Hombros")] })).toBe("Pecho, espalda y hombros");
    expect(routineMuscles({ exercises: [ex("A", "Pecho"), ex("B", "Espalda"), ex("C", "Hombros"), ex("D", "Bíceps"), ex("E", "Core")] })).toBe("Pecho, espalda, hombros y 2 más");
    expect(routineMeta({ exercises: [] })).toBe("0 ejercicios");
  });

  it("«Guardar como rutina» guarda lo hecho: series hechas, reps (o rango) y el peso más alto", () => {
    const list = [ex("Press banca", "Pecho"), ex("Plancha", "Core", { reps: "30s" as unknown as number }), ex("Remo", "Espalda")];
    const out = routineFromWorkout(list, {
      "Press banca": [
        { reps: 10, weight: "60", done: true },
        { reps: 8, weight: "62,5", done: true },
        { reps: 6, weight: "40", done: true, isWarmup: true },
        { reps: 8, weight: "60", done: false },
      ],
      Plancha: [{ reps: 1, weight: "", done: true }],
      Remo: [{ reps: 10, weight: "50", done: false }],
    });
    expect(out.map((e) => e.name)).toEqual(["Press banca", "Plancha"]);
    expect(out[0]).toMatchObject({ series: 2, reps: "8-10", weight: "62.5", rest: "90s" });
    expect(out[1]).toMatchObject({ series: 1, reps: "30s" });
  });

  it("guarda sobre el plan del servidor y crea la fila si no existe", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        upsert,
      }),
    };
    const result = await commitRoutineChange(client, "u1", (plans) => addRoutine(plans, { name: "Full", exercises: [ex("Peso muerto")] }));
    expect(result).toMatchObject({ ok: true, day: "Lunes" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", workouts_json: [expect.objectContaining({ day: "Lunes", custom: true })] }),
      { onConflict: "user_id" },
    );
    const failing = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: new Error("red") }) }) }),
        upsert,
      }),
    };
    expect(await commitRoutineChange(failing, "u1", (plans) => addRoutine(plans, { name: "x", exercises: [] }))).toEqual({ ok: false, reason: "error" });
  });
});
