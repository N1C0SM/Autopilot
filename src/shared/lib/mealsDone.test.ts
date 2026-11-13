import { describe, it, expect, beforeEach } from "vitest";
import { claimMealsAutoGenerate, mealsDoneKey, readMealsDone } from "@/shared/lib/mealsDone";
import { clearPendingOfflineSeries } from "@/shared/lib/activeWorkout";

describe("aislamiento por usuario", () => {
  beforeEach(() => localStorage.clear());
  it("las comidas de un usuario no aparecen en otro", () => {
    localStorage.setItem(mealsDoneKey("a"), JSON.stringify(["Cena"]));
    expect(readMealsDone("a")).toEqual(["Cena"]);
    expect(readMealsDone("b")).toEqual([]);
  });
  it("descartar borra la cola de series pendientes", () => {
    localStorage.setItem("autopilot:series-pendientes:u1", "[1]");
    clearPendingOfflineSeries("u1");
    expect(localStorage.getItem("autopilot:series-pendientes:u1")).toBeNull();
  });
});

describe("claimMealsAutoGenerate", () => {
  beforeEach(() => localStorage.clear());
  it("la IA prepara comidas sola como mucho una vez al día por cuenta", () => {
    const day = new Date(2026, 10, 13, 9);
    expect(claimMealsAutoGenerate("u1", day)).toBe(true);
    expect(claimMealsAutoGenerate("u1", new Date(2026, 10, 13, 22))).toBe(false);
    expect(claimMealsAutoGenerate("u2", day)).toBe(true);
    expect(claimMealsAutoGenerate("u1", new Date(2026, 10, 14, 8))).toBe(true);
  });
});
