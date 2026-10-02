import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProgressCharts from "./ProgressCharts";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  upsert: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: mocks.list }) }) }),
      upsert: mocks.upsert,
    }),
  },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});

describe("weight progress", () => {
  it("shows an explicit retry when the weight history cannot be loaded", async () => {
    mocks.list
      .mockResolvedValueOnce({ data: null, error: new Error("query failed") })
      .mockResolvedValueOnce({ data: [], error: null });
    render(<ProgressCharts userId="user" />);

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByText("Registra tu peso para empezar a ver tu evolución.")).toBeVisible());
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it("does not claim the weight was saved when persistence fails", async () => {
    mocks.upsert.mockResolvedValue({ error: new Error("save failed") });
    render(<ProgressCharts userId="user" />);
    await screen.findByText("Registra tu peso para empezar a ver tu evolución.");
    fireEvent.change(await screen.findByRole("spinbutton", { name: "Peso en kilogramos" }), {
      target: { value: "72.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Error al guardar"));
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
