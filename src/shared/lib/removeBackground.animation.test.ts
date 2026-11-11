// @vitest-environment node
import { describe, expect, it } from "vitest";
import UPNG from "upng-js";
import { removeWhiteBackground } from "./removeBackground";

describe("GIF de técnica", () => {
  it("conserva los dos fotogramas, sus tiempos y el fondo transparente al ampliar", async () => {
    const bytes = Buffer.from("R0lGODlhBAAEAIEAAP///x4eHgAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQICgAAACwAAAAABAAEAAAICwABCBw4MABBgQEBACH5BAgPAAAALAAAAAAEAAQAgf///x4eHgAAAAAAAAgLAAEIHEgwAEEAAQEAOw==", "base64");
    const output = await removeWhiteBackground(new File([bytes], "crunch.gif", { type: "image/gif" }));
    const decoded = UPNG.decode(await output.arrayBuffer());
    expect([decoded.width, decoded.height]).toEqual([16, 16]);
    expect(decoded.frames.map((frame: { delay: number }) => frame.delay)).toEqual([100, 150]);
    const frames = UPNG.toRGBA8(decoded).map((frame: ArrayBuffer) => new Uint8Array(frame));
    expect(frames).toHaveLength(2);
    expect(frames[0][3]).toBe(0);
    expect(frames[1][3]).toBe(0);
    expect(frames[0]).not.toEqual(frames[1]);
    expect(frames[0].some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
  });
});