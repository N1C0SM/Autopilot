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
});
