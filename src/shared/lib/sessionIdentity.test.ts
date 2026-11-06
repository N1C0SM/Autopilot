import { describe, expect, it } from "vitest";
import type { DayPlan } from "@/shared/types/training";
import { cleanSessionIcon, sessionGroups, suggestSessionIcon, suggestSessionName, withSessionIdentity } from "@/shared/lib/sessionIdentity";

const gym = (...muscles: string[]): DayPlan => ({
  day: "Lunes", type: "gimnasio", routine_name: "Día 1",
  exercises: muscles.map((muscle, i) => ({ exercise_id: `e${i}`, name: `E${i}`, series: 3, reps: 10, weight: "", rest: "60 s", muscle_group: muscle })),
});

describe("sessionIdentity", () => {
  it("names the session after its muscles", () => {
    expect(suggestSessionName(gym("Pecho", "Hombros", "Tríceps"))).toBe("Empuje");
    expect(suggestSessionName(gym("Espalda", "Bíceps"))).toBe("Tirón");
    expect(suggestSessionName(gym("Cuádriceps", "Glúteos", "Femoral"))).toBe("Pierna");
    expect(suggestSessionName(gym("Pecho", "Espalda"))).toBe("Torso");
    expect(suggestSessionName(gym("Pecho", "Espalda", "Piernas", "Core"))).toBe("Cuerpo completo");
    expect(suggestSessionName(gym("Hombros", "Core"))).toBe("Hombros y core");
    expect(suggestSessionName(gym())).toBe("Entreno");
    expect(sessionGroups({ ...gym(), muscle_focus: "Full body" })).toEqual(["full"]);
  });

  it("suggests a matching icon, also for activities", () => {
    expect(suggestSessionIcon(gym("Cuádriceps"))).toBe("🦵");
    expect(suggestSessionIcon(gym("Espalda", "Bíceps"))).toBe("🦍");
    expect(suggestSessionIcon({ day: "Sábado", type: "actividad", sport: "Running" })).toBe("🏃");
    expect(suggestSessionIcon({ day: "Sábado", type: "actividad", sport: "Escalada" })).toBe("🔥");
  });

  it("keeps only short emoji icons", () => {
    expect(cleanSessionIcon("🏋️")).toBe("🏋️");
    expect(cleanSessionIcon("hola")).toBeNull();
    expect(cleanSessionIcon("")).toBeNull();
    expect(cleanSessionIcon(undefined)).toBeNull();
  });

  it("changes only the name and icon of that session, never the plan mode", () => {
    const plans: DayPlan[] = [gym("Pecho"), { day: "Jueves", type: "actividad", sport: "Running", session_icon: "🏃" }];
    const next = withSessionIdentity(plans, "Lunes", { name: "  Pecho pesado ", icon: "🔥" });
    expect(next[0]).toMatchObject({ routine_name: "Pecho pesado", session_icon: "🔥" });
    expect(next[0].custom).toBeUndefined();
    expect(next[1]).toBe(plans[1]);
    expect(withSessionIdentity(next, "Lunes", { name: "Pecho", icon: null })[0]).not.toHaveProperty("session_icon");
  });
});
