import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { fastImage } from "@/shared/lib/fastImage";

const STORE = "autopilot.aiCovers.v1";

function readStore(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; }
}

/** Imagen ya resuelta, recordando a qué clave pertenece: nunca se pinta la de otra. */
interface Cover {
  key: string;
  url: string | null;
}

/**
 * Imagen generada con IA por la edge function session-cover. La función la guarda
 * una vez y la comparte entre usuarios; aquí se recuerda por petición para no volver
 * a pedirla. Mientras no llega, o si falla, devuelve `fallback`.
 *
 * La imagen va atada a su clave: al cambiar de plato o de sesión no se enseña la
 * anterior mientras llega la nueva (era el bug de «muestra otra imagen»).
 */
function useAiCover(cacheKey: string, body: Record<string, unknown> | null, fallback: string | null) {
  const [cover, setCover] = useState<Cover>(() => ({
    key: cacheKey,
    url: cacheKey ? readStore()[cacheKey] ?? null : null,
  }));

  useEffect(() => {
    if (!cacheKey || !body) {
      setCover({ key: cacheKey, url: null });
      return;
    }
    const known = readStore()[cacheKey];
    if (known) { setCover({ key: cacheKey, url: known }); return; }
    // Clave nueva sin caché: se limpia la imagen anterior ANTES de pedir la nueva,
    // para no enseñar el plato/sesión de antes mientras responde la función.
    setCover({ key: cacheKey, url: null });
    let alive = true;
    const invoke = supabase.functions?.invoke?.bind(supabase.functions);
    if (!invoke) return;
    void invoke("session-cover", { body }).then(({ data }) => {
      const next = typeof data?.url === "string" ? data.url : null;
      if (!next) return;
      try { localStorage.setItem(STORE, JSON.stringify({ ...readStore(), [cacheKey]: next })); } catch { /* sin almacenamiento: se pedirá otra vez */ }
      // Solo se aplica la respuesta de la petición vigente: al cambiar de clave, `alive` es false.
      if (alive) setCover({ key: cacheKey, url: next });
    }).catch(() => { /* sin imagen de IA: se queda el respaldo */ });
    return () => { alive = false; };
    // body se deriva de cacheKey: con la misma clave, la misma petición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // Si el estado guardado es de otra clave, todavía no hay imagen para esta: se mira
  // la caché (para no parpadear cuando ya está descargada) y, si no, el respaldo.
  const shown = cover.key === cacheKey
    ? cover.url
    : (cacheKey ? readStore()[cacheKey] ?? null : null);
  return shown ? fastImage(shown, 1000) : fallback;
}

/** Portada de la sesión según sus músculos; mientras tanto, la foto del primer ejercicio. */
export function useSessionCover(exerciseIds: (string | undefined)[], fallback: string | null) {
  const ids = exerciseIds.filter((x): x is string => !!x).sort();
  const key = ids.join(",");
  return useAiCover(key ? `s:${key}` : "", key ? { exercise_ids: ids } : null, fallback);
}

/** Foto del plato descrito; null mientras no existe. */
export function useMealPhoto(dish: string | undefined) {
  const text = (dish || "").trim().slice(0, 120);
  return useAiCover(text.length >= 3 ? `m:${text.toLowerCase()}` : "", text.length >= 3 ? { meal: text } : null, null);
}
