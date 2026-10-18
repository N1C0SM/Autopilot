import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminMobileHeader from "./AdminMobileHeader";

vi.mock("@/lib/native", () => ({ hapticTap: vi.fn(), isNative: vi.fn().mockReturnValue(false) }));

afterEach(cleanup);

const renderHeader = (props: Partial<Parameters<typeof AdminMobileHeader>[0]> = {}) =>
  render(
    <AdminMobileHeader
      title="Dashboard"
      section="dashboard"
      onNavigate={vi.fn()}
      onSignOut={vi.fn()}
      contentRef={createRef<HTMLElement>()}
      layoutKey="dashboard:"
      {...props}
    />,
  );

describe("admin mobile header", () => {
  it("shows a back button to the users list only when a detail is open", () => {
    const onBack = vi.fn();
    renderHeader({ title: "Ana", section: "users", onBack, backLabel: "Usuarios" });

    fireEvent.click(screen.getByRole("button", { name: "Usuarios" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("has no back button on a root section", () => {
    renderHeader();
    expect(screen.queryByRole("button", { name: "Usuarios" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menú de administración" })).toBeInTheDocument();
  });

  it("navigates from the menu sheet and marks the current section", () => {
    const onNavigate = vi.fn();
    renderHeader({ section: "trainers", onNavigate });

    fireEvent.click(screen.getByRole("button", { name: "Menú de administración" }));
    expect(screen.getByRole("button", { name: "Entrenadores" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Blog" }));
    expect(onNavigate).toHaveBeenCalledWith("blog");
  });
});
