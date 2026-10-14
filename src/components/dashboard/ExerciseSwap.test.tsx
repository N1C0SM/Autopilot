import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExerciseSwap } from "./ExerciseSwap";

const { builder } = vi.hoisted(() => {
  const result = {
    data: [
      { name: "Press inclinado con mancuernas", image_url: null },
      { name: "Fondos en paralelas", image_url: "https://example.test/fondos.jpg" },
    ],
  };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "neq", "limit", "eq"]) builder[method] = vi.fn(() => builder);
  builder.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return { builder };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(() => builder) } }));

afterEach(cleanup);

describe("exercise swap during a workout", () => {
  it("swaps to an alternative without the tap reaching the exercise row", async () => {
    const onRow = vi.fn();
    const onSelect = vi.fn();
    render(
      <div onClick={onRow}>
        <ExerciseSwap original="Press banca" movementPattern="horizontal_push" onSelect={onSelect} />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cambiar ejercicio" }));
    fireEvent.click(await screen.findByRole("button", { name: /Fondos en paralelas/ }));

    expect(onSelect).toHaveBeenCalledWith("Fondos en paralelas");
    expect(onRow).not.toHaveBeenCalled();
  });

  it("goes back to the original exercise", async () => {
    const onRow = vi.fn();
    const onSelect = vi.fn();
    render(
      <div onClick={onRow}>
        <ExerciseSwap original="Press banca" current="Fondos en paralelas" onSelect={onSelect} />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cambiar ejercicio" }));
    expect(await screen.findByLabelText("Seleccionado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver a Press banca" }));

    expect(onSelect).toHaveBeenCalledWith(null);
    expect(onRow).not.toHaveBeenCalled();
  });
});
