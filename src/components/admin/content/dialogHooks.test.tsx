import { describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { useConfirm } from "./useConfirm";
import { useTextPrompt } from "./useTextPrompt";

vi.mock("@/lib/native", () => ({
  hapticNotify: vi.fn(),
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticImpact: vi.fn(),
}));

afterEach(cleanup);

function ConfirmHarness({ onResult }: { onResult: (accepted: boolean) => void }) {
  const { ask, dialog } = useConfirm();
  return (
    <>
      <button onClick={async () => onResult(await ask({ title: "¿Eliminar?" }))}>abrir</button>
      {dialog}
    </>
  );
}

function PromptHarness({ onResult, readOnly }: { onResult: (value: string | null) => void; readOnly?: boolean }) {
  const { ask, dialog } = useTextPrompt();
  return (
    <>
      <button onClick={async () => onResult(await ask({ title: "Nombre de la carpeta", initialValue: "Piernas", readOnly }))}>abrir</button>
      {dialog}
    </>
  );
}

describe("useConfirm", () => {
  it("resolves true on the action and false on cancel", async () => {
    const onResult = vi.fn();
    render(<ConfirmHarness onResult={onResult} />);

    fireEvent.click(screen.getByText("abrir"));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Eliminar" })); });
    expect(onResult).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByText("abrir"));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Cancelar" })); });
    expect(onResult).toHaveBeenLastCalledWith(false);
  });
});

describe("useTextPrompt", () => {
  it("resolves the edited text on confirm and null on cancel", async () => {
    const onResult = vi.fn();
    render(<PromptHarness onResult={onResult} />);

    fireEvent.click(screen.getByText("abrir"));
    const input = await screen.findByRole("textbox");
    expect(input).toHaveValue("Piernas");
    fireEvent.change(input, { target: { value: "Espalda" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Guardar" })); });
    expect(onResult).toHaveBeenLastCalledWith("Espalda");

    fireEvent.click(screen.getByText("abrir"));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Cancelar" })); });
    expect(onResult).toHaveBeenLastCalledWith(null);
  });

  it("confirms with Enter", async () => {
    const onResult = vi.fn();
    render(<PromptHarness onResult={onResult} />);

    fireEvent.click(screen.getByText("abrir"));
    const input = await screen.findByRole("textbox");
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(onResult).toHaveBeenLastCalledWith("Piernas");
  });

  it("shows a read-only value without a cancel button", async () => {
    const onResult = vi.fn();
    render(<PromptHarness onResult={onResult} readOnly />);

    fireEvent.click(screen.getByText("abrir"));
    expect(await screen.findByRole("textbox")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Listo" })); });
    expect(onResult).toHaveBeenLastCalledWith(null);
  });
});
