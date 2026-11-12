import { describe, expect, it } from "vitest";
import { BRAND_PHOTO_EXERCISES, pickBrandPhotos } from "./brandPhotos";

describe("pickBrandPhotos", () => {
  it("usa la foto que eligió el servidor para cada hueco", () => {
    expect(pickBrandPhotos([{ slot: "gym", image_url: "g.webp" }, { slot: "otro", image_url: "x.webp" }])).toEqual({ gym: "g.webp" });
  });

  it("prefiere el ejercicio de cada foto y, si ya no está, uno parecido y distinto en cada hueco", () => {
    const picked = pickBrandPhotos([
      { id: BRAND_PHOTO_EXERCISES.gym, name: "Press militar", image_url: "own-gym.webp" },
      { id: "1", name: "Dominadas pronas", image_url: "dom.webp" },
      { id: "2", name: "Press con mancuernas", image_url: "pm.webp" },
      { id: "3", name: "Flexiones", image_url: "flex.webp" },
      { id: "4", name: "Curl con mancuerna", image_url: null },
    ]);
    expect(picked).toEqual({ pullupBar: "dom.webp", dumbbells: "pm.webp", home: "flex.webp", gym: "own-gym.webp" });
  });

  it("sin acentos ni mayúsculas y sin repetir foto", () => {
    const picked = pickBrandPhotos([
      { id: "1", name: "Flexión diamante", image_url: "flex.webp" },
      { id: "2", name: "Sentadilla con barra", image_url: "sb.webp" },
    ]);
    expect(picked).toEqual({ home: "flex.webp", gym: "sb.webp" });
  });
});

describe("pickBrandPhotos: solo fotos fijas", () => {
  it("salta GIF y APNG y el pullover no cuenta como dominada", () => {
    const picked = pickBrandPhotos([
      { slot: "dumbbells", image_url: "x/press-anim.gif" },
      { id: "1", name: "Press inclinado con mancuernas", image_url: "x/anim.gif" },
      { id: "2", name: "Remo con mancuerna", image_url: "x/remo.webp" },
      { id: "3", name: "Pullover con mancuerna", image_url: "x/pullover.webp" },
      { id: "4", name: "Jalón al pecho (pull down)", image_url: "x/jalon.webp" },
    ]);
    // Por orden alfabético, «Pullover con mancuerna» va a mancuernas, no a dominadas.
    expect(picked).toEqual({ pullupBar: "x/jalon.webp", dumbbells: "x/pullover.webp" });
  });
});
