import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/shared/components/ui/sidebar";
import TrainerShell from "@/app/components/trainer/TrainerShell";

vi.mock("@/shared/lib/native", () => ({ hapticTap: vi.fn(), isNative: vi.fn().mockReturnValue(false) }));

afterEach(cleanup);

const renderShell = (props: Partial<Parameters<typeof TrainerShell>[0]> = {}) =>
  render(
    <SidebarProvider>
      <TrainerShell title="Clientes" screenKey="users" {...props}>
        <p>Contenido</p>
      </TrainerShell>
    </SidebarProvider>,
  );

describe("trainer shell", () => {
  it("opens a root tab with its large title and no back button", () => {
    renderShell();

    const largeTitle = document.querySelector("[data-nav-title]");
    expect(largeTitle).toHaveTextContent("Clientes");
    expect(screen.queryByRole("button", { name: "Volver a clientes" })).not.toBeInTheDocument();
    expect(screen.getByText("Contenido")).toBeInTheDocument();
  });

  it("shows the back button and the client name in the bar when a client is open", () => {
    const onBack = vi.fn();
    renderShell({
      screenKey: "users:abc",
      detail: { title: "Ana", backLabel: "Clientes", backAriaLabel: "Volver a clientes", onBack },
    });

    fireEvent.click(screen.getByRole("button", { name: "Volver a clientes" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    // La ficha trae su propio titular: el shell no pinta otro título grande encima.
    expect(document.querySelector("[data-nav-title]")).toBeNull();
  });
});
