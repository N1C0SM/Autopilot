// Las fotos públicas de Supabase son PNG de ~2 MB sin caché. Supabase las sirve reducidas
// (WebP, ~5–15 KB) con su endpoint de render: la misma foto llega al instante.
// La app nativa hace lo mismo en `ImageCache.fastURL` (Components.swift).
const OBJECT = "/storage/v1/object/public/";
const RENDER = "/storage/v1/render/image/public/";

/** Foto pública de Supabase reducida a `px` de lado mayor; cualquier otra URL se deja igual. */
export function fastImage(url: string, px: number): string;
export function fastImage(url: string | null | undefined, px: number): string | null | undefined;
export function fastImage(url: string | null | undefined, px: number) {
  if (!url || !url.includes(".supabase.co/")) return url;
  const [base] = url.split("?");
  const path = base.includes(OBJECT) ? base.split(OBJECT)[1] : base.includes(RENDER) ? base.split(RENDER)[1] : null;
  if (!path) return url;
  const side = Math.round(Math.min(Math.max(px, 64), 1000));
  return `${base.split(/\/storage\/v1\//)[0]}${RENDER}${path}?width=${side}&height=${side}&resize=contain&quality=55`;
}
