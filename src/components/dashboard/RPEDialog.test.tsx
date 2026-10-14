import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RPEDialog from "./RPEDialog";

afterEach(cleanup);

describe("workout effort check-in", () => {
  it("lets the user complete a workout without rating the effort", () => {
    const onConfirm = vi.fn();
    render(<RPEDialog open onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Completar sin valorar esfuerzo" }));

    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it("saves the effort the user picks on the 1 to 10 scale", () => {
    const onConfirm = vi.fn();
    render(<RPEDialog open onConfirm={onConfirm} />);

    const nine = screen.getByRole("radio", { name: /^9,/ });
    fireEvent.click(nine);
    expect(nine).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("button", { name: "Guardar esfuerzo y completar" }));

    expect(onConfirm).toHaveBeenCalledWith(9);
  });
});
