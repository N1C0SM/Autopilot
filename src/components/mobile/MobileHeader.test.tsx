import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MobileHeader from "./MobileHeader";

vi.mock("@/components/NotificationsBell", () => ({
  default: () => <div aria-label="Notificaciones" />,
}));

afterEach(cleanup);

describe("mobile header", () => {
  it("uses the profile photo as the single entry to profile and settings", () => {
    const onSettings = vi.fn();
    render(
      <MobileHeader
        title="Hoy"
        profileName="Ana"
        profileAvatar="https://example.test/avatar.png"
        onSettings={onSettings}
      />,
    );

    expect(screen.queryByRole("button", { name: "Ajustes" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Perfil y ajustes" }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
