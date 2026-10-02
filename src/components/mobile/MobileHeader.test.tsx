import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MobileHeader from "./MobileHeader";

vi.mock("@/components/NotificationsBell", () => ({
  default: () => <div aria-label="Notificaciones" />,
}));

afterEach(cleanup);

describe("mobile header", () => {
  it("keeps the profile photo informational and uses the settings control for navigation", () => {
    const onSettings = vi.fn();
    render(
      <MobileHeader
        title="Hoy"
        profileName="Ana"
        profileAvatar="https://example.test/avatar.png"
        onSettings={onSettings}
      />,
    );

    expect(screen.getByRole("img", { name: "Foto de perfil de Ana" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Foto de perfil de Ana" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
