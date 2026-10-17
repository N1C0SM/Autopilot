import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { shareFileOrImage } from "./native";

describe("shareFileOrImage", () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("shares via Web Share API when canShare returns true", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    const mockCanShare = vi.fn().mockReturnValue(true);

    Object.defineProperty(global, "navigator", {
      value: {
        share: mockShare,
        canShare: mockCanShare,
      },
      writable: true,
      configurable: true,
    });

    const blob = new Blob(["fake-image-bytes"], { type: "image/png" });
    const result = await shareFileOrImage({
      blob,
      filename: "test.png",
      title: "Test Share",
      text: "Test text",
    });

    expect(mockCanShare).toHaveBeenCalled();
    expect(mockShare).toHaveBeenCalled();
    expect(result.shared).toBe(true);
  });

  it("falls back to download when canShare is false", async () => {
    const mockCanShare = vi.fn().mockReturnValue(false);

    Object.defineProperty(global, "navigator", {
      value: {
        canShare: mockCanShare,
      },
      writable: true,
      configurable: true,
    });

    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === "a") {
        el.click = clickSpy;
      }
      return el;
    });

    const blob = new Blob(["test"], { type: "image/png" });
    const result = await shareFileOrImage({
      blob,
      filename: "test-download.png",
    });

    expect(clickSpy).toHaveBeenCalled();
    expect(result.downloaded).toBe(true);
    expect(result.shared).toBe(false);
  });
});
