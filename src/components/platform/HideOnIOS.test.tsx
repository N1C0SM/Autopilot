import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import * as platform from "@/lib/platform";

import { HideOnIOS } from "./HideOnIOS";
import { IosFeatureLocked } from "./IosFeatureLocked";

describe("<HideOnIOS />", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children in web builds", () => {
    vi.spyOn(platform, "isIOSNative").mockReturnValue(false);
    render(
      <HideOnIOS>
        <p>pricing block</p>
      </HideOnIOS>,
    );
    expect(screen.getByText("pricing block")).toBeInTheDocument();
  });

  it("renders nothing by default on iOS builds", () => {
    vi.spyOn(platform, "isIOSNative").mockReturnValue(true);
    render(
      <HideOnIOS>
        <p data-testid="hidden">pricing block</p>
      </HideOnIOS>,
    );
    expect(screen.queryByTestId("hidden")).not.toBeInTheDocument();
  });

  it("renders fallback on iOS when provided", () => {
    vi.spyOn(platform, "isIOSNative").mockReturnValue(true);
    render(
      <HideOnIOS fallback={<p>reader mode</p>}>
        <p>pricing block</p>
      </HideOnIOS>,
    );
    expect(screen.getByText("reader mode")).toBeInTheDocument();
    expect(screen.queryByText("pricing block")).not.toBeInTheDocument();
  });
});

describe("<IosFeatureLocked />", () => {
  it("mentions autopilotplan.com in plain text (no clickable link to checkout)", () => {
    render(<IosFeatureLocked feature="El chat con tu entrenador" />);
    expect(
      screen.getByText(/El chat con tu entrenador está disponible en los planes de pago\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/autopilotplan\.com/i)).toBeInTheDocument();
    // Must NOT render an anchor to checkout. App Store §3.1.3(a) only allows
    // informing about the existence of plans, not linking to the checkout.
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("falls back to a generic feature label", () => {
    render(<IosFeatureLocked />);
    expect(
      screen.getByText(/Esta función está disponible en los planes de pago\./i),
    ).toBeInTheDocument();
  });
});
