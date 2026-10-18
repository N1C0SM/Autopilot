import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExerciseSwap } from "./ExerciseSwap";

const { builder, getUser, state } = vi.hoisted(() => {
  const state = {
    exercises: {
      data: [
        { name: "Press inclinado con mancuernas", image_url: null, muscle_group: null, exercise_type: "Gimnasio" },
        { name: "Fondos en paralelas", image_url: "https://example.test/fondos.jpg", muscle_group: null, exercise_type: "Calistenia" },
      ],
      error: null as { message: string } | null,
    },
  };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "neq", "limit", "eq"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: { equipment_type: "Mixto" }, error: null }));
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(state.exercises).then(resolve);
  const getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }));
  return { builder, getUser, state };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(() => builder), auth: { getUser } } }));
vi.mock("@/lib/native", () => ({ hapticTap: vi.fn() }));

const okData = state.exercises.data;
beforeEach(() => { state.exercises = { data: okData, error: null }; });
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

  it("shows an error instead of spinning forever when the library can't load", async () => {
    state.exercises = { data: null as never, error: { message: "offline" } };
    render(<ExerciseSwap original="Press banca" onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Cambiar ejercicio" }));

    expect(await screen.findByText("No se pudieron cargar")).toBeInTheDocument();
    expect(screen.queryByText("Buscando alternativas")).not.toBeInTheDocument();
  });
});
