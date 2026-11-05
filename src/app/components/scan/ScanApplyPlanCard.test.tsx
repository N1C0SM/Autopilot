import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ScanApplyPlanCard from "@/app/components/scan/ScanApplyPlanCard";

const mocks = vi.hoisted(() => ({ ios: false, haptic: vi.fn() }));

vi.mock("@/shared/lib/platform", () => ({ isIOSNative: () => mocks.ios }));
vi.mock("@/shared/lib/native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/native")>()),
  hapticTap: mocks.haptic,
}));

afterEach(() => {
  cleanup();
  mocks.ios = false;
  mocks.haptic.mockReset();
});

describe("ScanApplyPlanCard", () => {
  it("enseña la rutina y la nutrición que aplica el scan y deja aplicarlo con Plus", () => {
    const onApply = vi.fn();
    render(
      <ScanApplyPlanCard
        protocol={{
          training_days_per_week: 4,
          protein_g_per_kg: 2.2,
          calorie_adjustment_kcal: -300,
          key_lifts: ["Press militar"],
        }}
        priorities={["Hombros", "Pecho"]}
        canApply
        hasChanges
        onApply={onApply}
        onUpgrade={vi.fn()}
      />,
    );

    expect(screen.getByText("Aplicar el scan a mi plan")).toBeTruthy();
    expect(screen.getByText("hombros y pecho")).toBeTruthy();
    expect(screen.getByText("−300 kcal/día")).toBeTruthy();
    expect(screen.getByText(/2,2 g de proteína por kg/)).toBeTruthy();
    expect(screen.getByText(/Clave: Press militar/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Aplicar a mi plan/ }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("Free ve la misma opción bloqueada y puede ir a los planes", () => {
    const onUpgrade = vi.fn();
    render(
      <ScanApplyPlanCard
        canApply={false}
        hasChanges={false}
        plusName="Plus"
        onApply={vi.fn()}
        onUpgrade={onUpgrade}
      />,
    );

    expect(screen.getByText("Bloqueado hasta tener Plus.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Aplicar a mi plan$/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Aplicar con Plus/ }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("en la app de iOS no se vende nada: solo se avisa de que va incluido", () => {
    mocks.ios = true;
    render(
      <ScanApplyPlanCard canApply={false} hasChanges={false} onApply={vi.fn()} onUpgrade={vi.fn()} />,
    );

    expect(screen.queryByRole("button", { name: /Aplicar con Plus/ })).toBeNull();
    expect(screen.getByText("Incluido en Plus.")).toBeTruthy();
  });

  it("con los planes de pago ocultos en Admin tampoco hay CTA de compra", () => {
    render(
      <ScanApplyPlanCard
        canApply={false}
        hasChanges={false}
        canUpgrade={false}
        plusName="Plus"
        onApply={vi.fn()}
        onUpgrade={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Aplicar con Plus/ })).toBeNull();
    expect(screen.getByText("Incluido en Plus.")).toBeTruthy();
  });

  it("con Plus y sin cambios nuevos no ofrece aplicar", () => {
    render(<ScanApplyPlanCard canApply hasChanges={false} onApply={vi.fn()} onUpgrade={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Aplicar a mi plan/ })).toBeNull();
    expect(screen.getByText("Este scan no propone cambios nuevos en tu plan.")).toBeTruthy();
  });
});
