import { describe, expect, it } from "vitest";
import { clearWhiteBackground } from "./removeBackground";

const px = (w: number, h: number, fill: (x: number, y: number) => number[]) => {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a.set(fill(x, y), (y * w + x) * 4);
  return a;
};

describe("clearWhiteBackground", () => {
  it("vuelve transparente el fondo blanco y conserva el atleta oscuro", () => {
    const a = px(5, 5, (x, y) => (x === 2 && y === 2 ? [40, 40, 40, 255] : [255, 255, 255, 255]));
    clearWhiteBackground(a, 5, 5);
    expect(a[3]).toBe(0);
    expect(a[(2 * 5 + 2) * 4 + 3]).toBe(255);
  });

  it("no borra el blanco encerrado dentro de la figura", () => {
    const a = px(5, 5, (x, y) => (x === 2 && y === 2 ? [255, 255, 255, 255] : x >= 1 && x <= 3 && y >= 1 && y <= 3 ? [20, 20, 20, 255] : [255, 255, 255, 255]));
    clearWhiteBackground(a, 5, 5);
    expect(a[(2 * 5 + 2) * 4 + 3]).toBe(255);
  });
});
