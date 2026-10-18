import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BeforeAfterCompare from "./BeforeAfterCompare";

vi.mock("@/lib/native", () => ({ hapticSelection: vi.fn(), isNative: vi.fn().mockReturnValue(false) }));

const photo = (id: string, takenAt: string, note: string) => ({
  id,
  note,
  photo_url: `user/${id}.jpg`,
  taken_at: takenAt,
});

const photos = [
  photo("new", "2026-10-10", "Frente"),
  photo("old", "2026-08-01", "Frente"),
];
const signed = new Map(photos.map((p) => [p.photo_url, `https://signed.test/${p.id}`]));

beforeEach(() => {
  cleanup();
});
afterEach(cleanup);

describe("before and after compare", () => {
  it("opens as a sheet with both photos and the front pose selected", () => {
    render(<BeforeAfterCompare photos={photos} signed={signed} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Frente" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByAltText("Antes")).toHaveAttribute("src", "https://signed.test/old");
    expect(screen.getByAltText("Después")).toHaveAttribute("src", "https://signed.test/new");
  });

  it("replaces a photo that fails to load with a composed placeholder", () => {
    render(<BeforeAfterCompare photos={photos} signed={signed} onClose={vi.fn()} />);

    fireEvent.error(screen.getByAltText("Antes"));

    expect(screen.queryByAltText("Antes")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Antes: foto no disponible" })).toBeInTheDocument();
    expect(screen.getByAltText("Después")).toBeInTheDocument();
  });

  it("asks to close from the Cerrar button and from Escape", () => {
    const onClose = vi.fn();
    render(<BeforeAfterCompare photos={photos} signed={signed} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("resets the selection when the pose changes and explains when a pose has too few photos", () => {
    render(<BeforeAfterCompare photos={photos} signed={signed} onClose={vi.fn()} />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Espalda" }), { button: 0 });

    expect(screen.getByRole("tab", { name: "Espalda" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Faltan fotos")).toBeVisible();
    expect(screen.queryByAltText("Antes")).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Frente" }), { button: 0 });
    expect(screen.getByAltText("Antes")).toHaveAttribute("src", "https://signed.test/old");
  });
});
