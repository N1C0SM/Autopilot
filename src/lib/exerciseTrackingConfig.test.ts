import { describe, expect, it } from "vitest";
import { getExerciseTrackingConfig } from "./exerciseTrackingConfig";

describe("getExerciseTrackingConfig", () => {
  it("detects bodyweight skill exercises by name and tags", () => {
    expect(getExerciseTrackingConfig({ name: "Front Lever", skill_tag: "front_lever" }).kind).toBe("bodyweight_seconds");
    expect(getExerciseTrackingConfig({ name: "Back Lever", skill_tag: "back_lever" }).kind).toBe("bodyweight_seconds");
    expect(getExerciseTrackingConfig({ name: "L-Sit", skill_tag: "l_sit" }).kind).toBe("bodyweight_seconds");
    expect(getExerciseTrackingConfig({ name: "Handstand", skill_tag: "handstand" }).kind).toBe("seconds_only");
  });

  it("detects weighted and assisted executions for strength and cardio variations", () => {
    expect(getExerciseTrackingConfig({ name: "Muscle Up", skill_tag: "muscle_up" }).kind).toBe("assisted_reps");
    expect(getExerciseTrackingConfig({ name: "Dominadas", movement_pattern: "Tirón" }).kind).toBe("assisted_reps");
    expect(getExerciseTrackingConfig({ name: "Press banca", exercise_type: "Gimnasio" }).kind).toBe("weighted_reps");
    expect(getExerciseTrackingConfig({ name: "Cinta de correr" }).kind).toBe("cardio_duration_distance");
  });

  it("falls back to a generic reps-only config when no pattern is matched", () => {
    expect(getExerciseTrackingConfig({ name: "Planche" }).kind).toBe("reps_only");
    expect(getExerciseTrackingConfig(undefined).kind).toBe("reps_only");
  });

  it("tracks gym and machine exercises as weighted reps with KG labels", () => {
    const config = getExerciseTrackingConfig({ name: "Abductores en máquina", exercise_type: "Gimnasio" });
    expect(config.kind).toBe("weighted_reps");
    expect(config.weightLabel).toBe("KG");
    expect(config.valueLabel).toBe("Repeticiones");
    expect(config.supportsWeight).toBe(true);
  });

  it("labels generic rep counting as Repeticiones, not Peso corporal", () => {
    expect(getExerciseTrackingConfig({ name: "Planche" }).valueLabel).toBe("Repeticiones");
  });
});
