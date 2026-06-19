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