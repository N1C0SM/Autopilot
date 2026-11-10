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

describe("borde limpio", () => {
  it("el gris claro del tramado junto al fondo también desaparece", () => {
    const a = px(5, 5, (x, y) => (x === 2 && y === 2 ? [30, 30, 30, 255] : x === 1 && y === 2 ? [222, 222, 222, 255] : [255, 255, 255, 255]));
    clearWhiteBackground(a, 5, 5);
    expect(a[(2 * 5 + 1) * 4 + 3]).toBe(0);
  });
});

import { upscaleFactor } from "./removeBackground";
describe("ampliación de GIF pequeños", () => {
  it("un GIF de 180 px se amplía x3 a 540 px; uno grande no se toca", () => {
    expect(upscaleFactor(180, 180)).toBe(3);
    expect(upscaleFactor(1200, 671)).toBe(1);
  });
});
