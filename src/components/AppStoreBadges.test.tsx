import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppStoreBadges from "./AppStoreBadges";

const rpc = vi.fn();
let iosNative = false;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

vi.mock("@/lib/platform", () => ({
  isIOSNative: () => iosNative,
}));

vi.mock("@/lib/native", () => ({ hapticTap: vi.fn() }));

beforeEach(() => {
  rpc.mockReset();
  iosNative = false;
});

afterEach(cleanup);

describe("app store badges", () => {
  it("renders nothing and fetches nothing inside the iOS app", () => {
    iosNative = true;
    const { container } = render(<AppStoreBadges wrap={(badges) => <section><p>Llévate tu plan al gimnasio</p>{badges}</section>} />);

    expect(container).toBeEmptyDOMElement();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("shows its context only together with a configured store link", async () => {
    rpc.mockResolvedValue({ data: [{ app_store_url: "https://apps.apple.com/app/id1", play_store_url: "" }], error: null });
    render(<AppStoreBadges wrap={(badges) => <section><p>Llévate tu plan al gimnasio</p>{badges}</section>} />);

    expect(await screen.findByRole("link", { name: "Descargar en la App Store" })).toHaveAttribute(
      "href",
      "https://apps.apple.com/app/id1",
    );
    expect(screen.getByText("Llévate tu plan al gimnasio")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Disponible en Google Play" })).not.toBeInTheDocument();
  });

  it("hides its context when no store link is configured", async () => {
    rpc.mockResolvedValue({ data: [{ app_store_url: "", play_store_url: "" }], error: null });
    render(<AppStoreBadges wrap={(badges) => <section><p>Llévate tu plan al gimnasio</p>{badges}</section>} />);

    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith("get_public_settings"));
    expect(screen.queryByText("Llévate tu plan al gimnasio")).not.toBeInTheDocument();
  });
});
