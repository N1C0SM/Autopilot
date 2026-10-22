import { describe, it, expect, beforeEach } from "vitest";
import { mealsDoneKey, readMealsDone } from "./mealsDone";
import { clearPendingOfflineSeries } from "./activeWorkout";

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
