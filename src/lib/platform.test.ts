import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Capacitor } from "@capacitor/core";

import { isIOSNative, isNativeApp } from "./platform";

const originalLocation = window.location;

/** Reasigna window.location con una URL arbitraria sin afectar al resto del DOM. */
function setLocationSearch(search: string) {
  const url = new URL(`http://localhost/${search}`);
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: {
      ...originalLocation,
      href: url.href,
      search: url.search,
      pathname: url.pathname,
      origin: url.origin,
    } as Location,
  });
}

function restoreLocation() {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
}

describe("isNativeApp", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    restoreLocation();
  });

  afterEach(() => {
    restoreLocation();
  });

  it("returns true when running inside a Capacitor native platform", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    expect(isNativeApp()).toBe(true);
  });

  it("returns false in a plain web browser", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    expect(isNativeApp()).toBe(false);
  });

  it("respects the ?native=1 override even on the web", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    setLocationSearch("?native=1");
    expect(isNativeApp()).toBe(true);
  });
});

describe("isIOSNative", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    restoreLocation();
  });

  afterEach(() => {
    restoreLocation();
  });

  it("returns true when Capacitor reports native + platform === 'ios'", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
    expect(isIOSNative()).toBe(true);
  });

  it("returns false on native Android", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    expect(isIOSNative()).toBe(false);
  });

  it("returns false in a plain web browser", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("web");
    expect(isIOSNative()).toBe(false);
  });

  it("activates with ?native=1&platform=ios from the web for QA preview", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("web");
    setLocationSearch("?native=1&platform=ios");
    expect(isIOSNative()).toBe(true);
  });

  it("stays web when only ?native=1 is set (requires platform=ios)", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("web");
    setLocationSearch("?native=1");
    expect(isIOSNative()).toBe(false);
  });

  it("?platform=web force-opts-out of iOS even when Capacitor reports iOS", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
    setLocationSearch("?platform=web");
    expect(isIOSNative()).toBe(false);
  });
});
