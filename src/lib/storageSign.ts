import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a stored value (either a full public URL or a storage path) within a
 * private bucket to a short-lived signed URL.
 *
 * If the bucket is the same as the one in a legacy public URL, we extract the
 * object path and create a signed URL. Returns null on failure.
 */
export async function signedUrlFor(
  bucket: string,
  urlOrPath: string | null | undefined,
  expiresInSec = 3600
): Promise<string | null> {
  if (!urlOrPath) return null;
  let path = urlOrPath;
  // Strip "https://.../object/(public|sign)/{bucket}/" prefix if present
  const marker = `/${bucket}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx >= 0) {
    path = urlOrPath.substring(idx + marker.length).split("?")[0];
  }
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSec);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/** TTL por defecto (segundos) de las URLs firmadas. */
export const DEFAULT_SIGNED_URL_TTL_SEC = 3600;

/** Margen (segundos) con el que conviene renovar antes de que la firma caduque. */
export const SIGNED_URL_REFRESH_MARGIN_SEC = 300;

/**
 * Extrae la ruta del objeto dentro del bucket a partir de una URL completa
 * (pública o firmada) o de una ruta ya almacenada. Descarta el query string
 * (por ejemplo `?token=...`) y devuelve null si no queda ruta utilizable.
 *
 * Se usa para borrar el objeto del bucket sin depender del formato con el que
 * se guardó el valor (rutas nuevas o URLs antiguas).
 */
export function storagePathFor(bucket: string, urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const marker = `/${bucket}/`;
  const idx = urlOrPath.indexOf(marker);
  const raw = idx >= 0 ? urlOrPath.substring(idx + marker.length) : urlOrPath;
  const path = raw.split("?")[0].trim();
  return path || null;
}

export interface SignedUrlBatch {
  /** Mapa con las URLs firmadas, igual que en `signedUrlsFor`. */
  urls: Map<string, string>;
  /** Momento (epoch ms) en el que las firmas dejan de ser válidas. */
  expiresAtMs: number;
  /** Momento (epoch ms) recomendado para volver a firmar (caducidad - margen). */
  refreshAtMs: number;
}

/**
 * Igual que `signedUrlsFor`, pero además informa de cuándo caducan las firmas
 * para que quien las consume pueda renovarlas antes de que las imágenes se
 * rompan (pestañas abiertas mucho tiempo). Nunca lanza: si una firma falla,
 * simplemente no aparece en el mapa.
 */
export async function signedUrlsWithExpiry(
  bucket: string,
  values: (string | null | undefined)[],
  expiresInSec = DEFAULT_SIGNED_URL_TTL_SEC
): Promise<SignedUrlBatch> {
  const urls = await signedUrlsFor(bucket, values, expiresInSec);
  const now = Date.now();
  const expiresAtMs = now + expiresInSec * 1000;
  const marginSec = Math.min(SIGNED_URL_REFRESH_MARGIN_SEC, Math.max(1, expiresInSec / 2));
  return { urls, expiresAtMs, refreshAtMs: expiresAtMs - marginSec * 1000 };
}

/**
 * Batch-sign multiple URLs/paths. Returns a Map keyed by the original value.
 */
export async function signedUrlsFor(
  bucket: string,
  values: (string | null | undefined)[],
  expiresInSec = 3600
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(values.filter(Boolean) as string[]));
  await Promise.all(
    unique.map(async (v) => {
      const url = await signedUrlFor(bucket, v, expiresInSec);
      if (url) out.set(v, url);
    })
  );
  return out;
}