import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus";

const Probe = () => <span>{useOnlineStatus() ? "online" : "offline"}</span>;

afterEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

it("refleja los eventos online y offline del sistema", () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  render(<Probe />);
  expect(screen.getByText("online")).toBeInTheDocument();

  act(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
  });
  expect(screen.getByText("offline")).toBeInTheDocument();

  act(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
  });
  expect(screen.getByText("online")).toBeInTheDocument();
});
