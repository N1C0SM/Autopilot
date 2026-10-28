import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import * as platform from "@/shared/lib/platform";

import { HideOnIOS } from "@/shared/components/platform/HideOnIOS";
import { IosFeatureLocked } from "@/shared/components/platform/IosFeatureLocked";

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
  it("explains that the feature is part of a paid plan without steering to a website", () => {
    render(<IosFeatureLocked feature="El chat con tu entrenador" />);
    expect(
      screen.getByText(/El chat con tu entrenador forma parte de los planes de pago\./i),
    ).toBeInTheDocument();
    // §3.1.1: no domain, no "visit", no link to checkout.
    expect(screen.queryByText(/autopilotplan\.com/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/visita/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("falls back to a generic feature label", () => {
    render(<IosFeatureLocked />);
    expect(
      screen.getByText(/Esta función forma parte de los planes de pago\./i),
    ).toBeInTheDocument();
  });
});
