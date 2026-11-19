import { describe, expect, it } from "vitest";
import { LOOP_EXTENSIONS, MAX_LIVE_LOOPS, loopUrl, loopsAllowed, nextLoopIndex } from "@/shared/lib/exerciseLoop";

describe("ejercicio en movimiento", () => {
  it("solo los clips propios en archivo directo se reproducen en bucle", () => {
    const clip = "https://x.supabase.co/storage/v1/object/public/site-assets/exercise-videos/abc.mp4";
    expect(loopUrl(clip)).toBe(clip);
    expect(loopUrl(`${clip}?t=1`)).toBe(`${clip}?t=1`);
    expect(loopUrl("https://x/clip.MOV")).toBe("https://x/clip.MOV");
    expect(loopUrl("https://x/clip.m4v")).toBe("https://x/clip.m4v");
    // Nunca GIF, YouTube, imágenes ni rutas sin protocolo.
    for (const url of ["https://x/ejercicio.gif", "https://www.youtube.com/watch?v=1", "https://x/foto.webp", "/exercise-videos/a.mp4", "", null, undefined]) {
      expect(loopUrl(url)).toBeNull();
    }
    expect([...LOOP_EXTENSIONS]).toEqual(["mp4", "mov", "m4v"]);
  });

  it("con reducir movimiento, ahorro de datos o bajo consumo se queda la foto fija", () => {
    expect(loopsAllowed({ reducedMotion: false, saveData: false })).toBe(true);
    expect(loopsAllowed({ reducedMotion: true, saveData: false })).toBe(false);
    expect(loopsAllowed({ reducedMotion: false, saveData: true })).toBe(false);
    expect(loopsAllowed({ reducedMotion: false, saveData: false, lowPower: true })).toBe(false);
  });

  it("en el entreno se precarga el siguiente ejercicio, y una lista nunca pasa de seis bucles vivos", () => {
    expect(nextLoopIndex(0, 5)).toBe(1);
    expect(nextLoopIndex(3, 5)).toBe(4);
    expect(nextLoopIndex(4, 5)).toBeNull();
    expect(nextLoopIndex(-1, 5)).toBeNull();
    expect(MAX_LIVE_LOOPS).toBe(6);
  });
});
