// Las fotos públicas de Supabase son PNG de ~2 MB sin caché. Supabase las sirve reducidas
// (WebP, ~5–15 KB) con su endpoint de render: la misma foto llega al instante.
// La app nativa hace lo mismo en `ImageCache.fastURL` (Components.swift).
const OBJECT = "/storage/v1/object/public/";
const RENDER = "/storage/v1/render/image/public/";

/**
 * Tamaños de foto: cada miniatura y cada portada pide la foto al tamaño al que se pinta (sus
 * puntos × 3, subidos al escalón siguiente), nunca la original ni una de 1000 px para un hueco de
 * 48 px. Los escalones hacen que la misma foto se comparta: todas las miniaturas de 32 a 64 px de
 * un ejercicio son la misma petición (192 px) en Hoy, Entrenar y el entreno. Los mismos valores que
 * `MediaSizing` en la app (Components.swift).
 */
export const IMAGE_SIDES = [96, 192, 384, 480, 640, 1000] as const;
/** Densidad con la que se calcula (iPhone @3x; las pantallas @2x reciben de sobra). */
export const IMAGE_SCALE = 3;
/** Miniaturas de ejercicio, comida y rutina (32–64 px): 192 px. */
export const THUMB_POINTS = 64;
/** Portadas, visor del entreno y ficha a todo el ancho: 1000 px. */
export const HERO_POINTS = 400;

const LARGEST = IMAGE_SIDES[IMAGE_SIDES.length - 1];

/** El escalón que cubre `px` píxeles (como mucho 1000). */
const snap = (px: number): number => IMAGE_SIDES.find((side) => side >= px) ?? LARGEST;

/** Px que se piden para algo pintado a `points` (px CSS o pt): el escalón que cubre points × 3. */
export const imageSide = (points: number): number => snap(points * IMAGE_SCALE);

/** Una miniatura de `points` (nunca por debajo de `THUMB_POINTS`): la misma foto en todas partes. */
export const thumbSide = (points: number): number => imageSide(Math.max(points, THUMB_POINTS));

/** 192 px: todas las miniaturas. */
export const THUMB_SIDE = imageSide(THUMB_POINTS);
/** 1000 px: portadas, visor y ficha. */
export const HERO_SIDE = imageSide(HERO_POINTS);

/**
 * Foto pública de Supabase reducida a `px` de lado mayor (subido a su escalón de `IMAGE_SIDES`);
 * cualquier otra URL se deja igual.
 */
export function fastImage(url: string, px: number): string;
export function fastImage(url: string | null | undefined, px: number): string | null | undefined;
export function fastImage(url: string | null | undefined, px: number) {
  if (!url || !url.includes(".supabase.co/")) return url;
  // Las animaciones (APNG/GIF) se sirven tal cual: el render las congelaría en el primer fotograma.
  if (/\.(apng|gif)(\?|$)/i.test(url)) return url;
  const [base] = url.split("?");
  const path = base.includes(OBJECT) ? base.split(OBJECT)[1] : base.includes(RENDER) ? base.split(RENDER)[1] : null;
  if (!path) return url;
  // El escalón que cubre el tamaño pedido (máximo 1000 px), el mismo que pide la app.
  const side = snap(Math.min(Math.max(px, 64), 1000));
  return `${base.split(/\/storage\/v1\//)[0]}${RENDER}${path}?width=${side}&height=${side}&resize=contain&quality=55`;
}
