import { describe, expect, it } from "vitest";
import { exerciseVideoSearchUrl } from "./exerciseVideo";

describe("exerciseVideoSearchUrl", () => {
  it("creates a video search for the exercise and its category", () => {
    const url = new URL(exerciseVideoSearchUrl("Press banca", "Pecho"));

    expect(url.hostname).toBe("www.youtube.com");
    expect(url.pathname).toBe("/results");
    expect(url.searchParams.get("search_query")).toBe(
      "Press banca Pecho técnica correcta ejercicio",
    );
  });

  it("still creates a useful search when the category is missing", () => {
    const url = new URL(exerciseVideoSearchUrl("Sentadilla"));

    expect(url.searchParams.get("search_query")).toBe(
      "Sentadilla técnica correcta ejercicio",
    );
  });
});
