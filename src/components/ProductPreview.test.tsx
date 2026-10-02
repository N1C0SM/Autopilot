import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import ProductPreview from "./ProductPreview";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/components/dashboard/ExerciseProgressChart", () => ({
  default: ({ exerciseName, metric, onMetricChange }: {
    exerciseName: string;
    metric: string;
    onMetricChange: (value: "volumeKg" | "bestEstimated1RmKg") => void;
  }) => createElement(
    "div",
    { role: "img", "aria-label": `Gráfica de ${metric === "volumeKg" ? "volumen" : "fuerza estimada"} para ${exerciseName}` },
    createElement("button", { onClick: () => onMetricChange("bestEstimated1RmKg") }, "Fuerza estimada"),
  ),
}));
afterEach(cleanup);

describe("public product preview", () => {
  it("records, undoes and resets sample exercises", async () => {
    render(<ProductPreview onPlans={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar serie 1 de Sentadilla goblet" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar serie 2 de Sentadilla goblet" }));
    expect(await screen.findByRole("status")).toHaveTextContent("2 de 9 series");
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar serie 1 de Sentadilla goblet" }));
    expect(await screen.findByRole("status")).toHaveTextContent("1 de 9 series");
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar demo" }));
    expect(await screen.findByRole("status")).toHaveTextContent("0 de 9 series");
  });

  it("retains the demo session across views and labels illustrative data", async () => {
    render(<ProductPreview onPlans={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));
    fireEvent.click(screen.getByRole("button", { name: /Remo con mancuerna/ }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar serie 1 de Remo con mancuerna" }));
    fireEvent.click(screen.getByRole("button", { name: "Nutrición" }));
    await waitFor(() => expect(screen.getByText(/Comidas ilustrativas/)).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Progreso" }));
    await waitFor(() => expect(screen.getByText(/gráficas se construyen con tus propias series completadas/)).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Plan" }));
    expect(await screen.findByRole("status")).toHaveTextContent("1 de 9 series");
    expect(screen.getByText(/Demo con datos ficticios/)).toBeVisible();
  });

  it("uses the same exercise progression chart as the real progress screen", async () => {
    render(<ProductPreview onPlans={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Progreso" }));

    await waitFor(() => expect(screen.getByRole("img", { name: "Gráfica de volumen para Sentadilla goblet" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Fuerza estimada" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "Gráfica de fuerza estimada para Sentadilla goblet" })).toBeVisible());
    expect(screen.getByText("Récords personales")).toBeVisible();
    expect(screen.queryByText("Cintura")).not.toBeInTheDocument();
  });

  it("marks paid-only chat and nutrition features in the demo", async () => {
    render(<ProductPreview onPlans={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Nutrición" }));
    await waitFor(() => expect(screen.getByText(/Función de pago/)).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => expect(screen.getByText(/No incluido en Gratis/)).toBeVisible());
  });

  it("lets a visitor move to pricing without registering", () => {
    const onPlans = vi.fn();
    render(<ProductPreview onPlans={onPlans} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver qué incluye cada plan/ }));
    expect(onPlans).toHaveBeenCalledOnce();
  });
  it("offers free signup separately from paid plans", () => {
    const onFree = vi.fn();
    const onPlans = vi.fn();
    render(<ProductPreview onPlans={onPlans} onFree={onFree} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta gratis y guardar mi progreso" }));
    expect(onFree).toHaveBeenCalledOnce();
    expect(onPlans).not.toHaveBeenCalled();
  });

});
