import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fastImage, HERO_SIDE, imageSide, IMAGE_SIDES, THUMB_SIDE, thumbSide } from "./fastImage";
import { prefetchImages, resetPrefetchForTests, thumbnailMedia, todayMedia, workoutMedia, TODAY_VIDEOS, WORKOUT_VIDEOS } from "./mediaPrefetch";

const BASE = "https://enebrcdrdnfkyduzyrzm.supabase.co";
const photo = (n: number) => `${BASE}/storage/v1/object/public/site-assets/exercise-images/ex-${n}.png`;
const clip = (n: number) => `${BASE}/storage/v1/object/public/site-assets/exercise-videos/ex-${n}.mp4`;
const side = (url: string | null | undefined) => Number(/width=(\d+)/.exec(url ?? "")?.[1]);

describe("tamaños de foto", () => {
  it("cada hueco pide el escalón que cubre su tamaño × 3, como mucho 1000 px", () => {
    expect(IMAGE_SIDES).toEqual([96, 192, 384, 480, 640, 1000]);
    expect(imageSide(32)).toBe(96);
    expect(imageSide(48)).toBe(192);
    expect(imageSide(64)).toBe(192);
    expect(imageSide(112)).toBe(384);
    expect(imageSide(160)).toBe(480);
    expect(imageSide(210)).toBe(640);
    expect(imageSide(393)).toBe(1000);
    expect(THUMB_SIDE).toBe(192);
    expect(HERO_SIDE).toBe(1000);
  });

  it("todas las miniaturas de 32 a 64 px de un ejercicio son la misma petición", () => {
    const urls = new Set([32, 40, 44, 48, 52, 56, 64].map((px) => fastImage(photo(1), thumbSide(px))));
    expect(urls.size).toBe(1);
    expect(side([...urls][0])).toBe(192);
  });

  it("fastImage sube cualquier tamaño a su escalón y nunca pasa de 1000", () => {
    expect(side(fastImage(photo(1), 800))).toBe(1000);
    expect(side(fastImage(photo(1), 500))).toBe(640);
    expect(side(fastImage(photo(1), 10))).toBe(96);
    expect(side(fastImage(photo(1), 4000))).toBe(1000);
    // Una URL ya reducida se vuelve a pedir al tamaño nuevo (la miniatura de una portada).
    expect(side(fastImage(fastImage(photo(1), HERO_SIDE), THUMB_SIDE))).toBe(192);
    // Fuera de Supabase o animada: tal cual.
    expect(fastImage("https://example.com/a.png", 192)).toBe("https://example.com/a.png");
    expect(fastImage(`${BASE}/storage/v1/object/public/site-assets/a.gif`, 192)).toBe(`${BASE}/storage/v1/object/public/site-assets/a.gif`);
  });
});

describe("qué se precarga", () => {
  const session = Array.from({ length: 6 }, (_, i) => ({ image: photo(i), video: clip(i) }));

  it("Hoy: las miniaturas de la sesión, la foto grande del primer ejercicio y un clip", () => {
    const plan = todayMedia(session);
    expect(plan.thumbs).toHaveLength(6);
    expect(plan.thumbs.every((u) => side(u) === 192)).toBe(true);
    expect(plan.heroes).toEqual([fastImage(photo(0), HERO_SIDE)]);
    expect(plan.videos).toEqual([clip(0)].slice(0, TODAY_VIDEOS));
  });

  it("el entreno: todas sus fotos (miniatura y grande) y los dos primeros clips", () => {
    const plan = workoutMedia(session);
    expect(plan.thumbs).toHaveLength(6);
    expect(plan.heroes).toHaveLength(6);
    expect(plan.heroes.every((u) => side(u) === 1000)).toBe(true);
    expect(plan.videos).toEqual([clip(0), clip(1)].slice(0, WORKOUT_VIDEOS));
  });

  it("sin foto o con un vídeo que no es un clip propio, no se pide nada de eso", () => {
    const plan = workoutMedia([{ image: null, video: "https://youtube.com/watch?v=1" }, { image: photo(2), video: null }]);
    expect(plan.thumbs).toHaveLength(1);
    expect(plan.videos).toEqual([]);
    expect(thumbnailMedia([photo(1), photo(1), null]).thumbs).toHaveLength(1);
  });
});

describe("prefetchImages", () => {
  const created: string[] = [];
  const RealImage = globalThis.Image;

  beforeEach(() => {
    resetPrefetchForTests();
    created.length = 0;
    vi.useFakeTimers();
    // Sin red: cada foto «carga» en cuanto se le pone la URL.
    globalThis.Image = class {
      decoding = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) { created.push(value); queueMicrotask(() => this.onload?.()); }
    } as unknown as typeof Image;
  });

  afterEach(() => {
    globalThis.Image = RealImage;
    vi.useRealTimers();
  });

  it("espera a que el navegador esté libre y pide cada foto una sola vez", async () => {
    prefetchImages([photo(1), photo(1), photo(2)]);
    prefetchImages([photo(2), photo(3)]);
    expect(created).toEqual([]);
    await vi.runAllTimersAsync();
    expect(created).toEqual([photo(1), photo(2), photo(3)]);
  });
});

/**
 * Banco de medida: lo que pedía Hoy al abrirse antes y después, con una rutina de muestra de 4
 * sesiones × 6 ejercicios (24 fotos distintas), contado con las reglas reales de tamaño. Los KB
 * por foto (1 KB = 1.000 bytes) son la media de las 3 fotos de marca del repositorio que hacen de
 * respaldo (`src/shared/assets/academy/{fases-de-la-repeticion,tecnica-eficiente,palancas-en-calistenia}.jpg`,
 * 1600 × 912) pasadas a WebP calidad 55 (el formato del render) con `cwebp -q 55 -resize <lado> 0`.
 * Es una estimación del orden de magnitud, no una medida de red: el número de peticiones sí es exacto.
 */
describe("banco de medida de Hoy (antes / después)", () => {
  const KB: Record<number, number> = { 192: 0.79, 420: 2.11, 800: 5.14, 1000: 6.79 };
  const plan = Array.from({ length: 4 }, (_, s) => Array.from({ length: 6 }, (_, e) => photo(s * 6 + e)));
  const today = plan[0];
  const cost = (urls: Set<string>) => [...urls].reduce((kb, url) => kb + KB[side(url)], 0);

  it("web: antes 24 fotos de 800 px precargadas compitiendo con la portada; ahora la portada y miniaturas de 192", () => {
    // Antes: useExerciseMetadata precargaba la foto de 800 px de cada ejercicio del plan, la portada
    // usaba esa misma de 800 y «Tu plan» pintaba la primera de cada sesión a 192.
    const before = new Set([...plan.flat().map((u) => `${u}?width=800`), ...plan.map((s) => fastImage(s[0], 192))]);
    // Ahora: la portada a 1000 (la misma que abre el entreno), «Tu plan» a 192 y, por detrás, las
    // miniaturas de la sesión de hoy y de todo el plan (192) y la foto grande del primero (la portada).
    const firstScreen = new Set([fastImage(today[0], HERO_SIDE), ...plan.map((s) => fastImage(s[0], THUMB_SIDE))]);
    const after = new Set([...firstScreen, ...todayMedia(today.map((image) => ({ image }))).thumbs, ...todayMedia(today.map((image) => ({ image }))).heroes,
      ...thumbnailMedia(plan.flat()).thumbs]);
    expect(before.size).toBe(28);
    expect(Math.round(cost(before))).toBe(127);
    expect(after.size).toBe(25);
    expect(Math.round(cost(after))).toBe(26);
    // Lo que compite con la primera foto al abrir: antes 28 peticiones (~127 KB); ahora 5 (~10 KB).
    expect(firstScreen.size).toBe(5);
    expect(Math.round(cost(firstScreen))).toBe(10);
  });

  it("app: antes cada miniatura de rutina de 56 pt pedía 1000 px; ahora 192", () => {
    // Antes: `routineThumb` y la portada con el tamaño por defecto (900 pt → 1000 px).
    const before = new Set(plan.map((s) => fastImage(s[0], 1000)));
    // Ahora: miniaturas a 192, la portada a 1000 y la precarga de la sesión de hoy (192 + la portada).
    const after = new Set([fastImage(today[0], HERO_SIDE), ...plan.map((s) => fastImage(s[0], THUMB_SIDE)), ...todayMedia(today.map((image) => ({ image }))).thumbs]);
    expect(Math.round(cost(before))).toBe(27);
    expect(after.size).toBe(10);
    expect(Math.round(cost(after))).toBe(14);
    // Memoria decodificada de las 4 miniaturas visibles (RGBA, foto 16:10): ~10 MB antes, ~0,4 MB ahora.
    const decoded = (px: number) => (px * px * 0.63 * 4) / 1e6;
    expect(Math.round(4 * decoded(1000))).toBe(10);
    expect(4 * decoded(192)).toBeLessThan(0.5);
  });
});
