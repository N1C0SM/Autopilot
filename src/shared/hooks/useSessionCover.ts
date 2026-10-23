import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";

const STORE = "autopilot.aiCovers.v1";

function readStore(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; }
}

/**
 * Imagen generada con IA por la edge function session-cover. La función la guarda
 * una vez y la comparte entre usuarios; aquí se recuerda por petición para no volver
 * a pedirla. Mientras no llega, o si falla, devuelve `fallback`.
 */
function useAiCover(cacheKey: string, body: Record<string, unknown> | null, fallback: string | null) {
  const [url, setUrl] = useState<string | null>(() => (cacheKey ? readStore()[cacheKey] ?? null : null));

  useEffect(() => {
    if (!cacheKey || !body) return;
    const known = readStore()[cacheKey];
    if (known) { setUrl(known); return; }
    setUrl(null);
    let alive = true;
    const invoke = supabase.functions?.invoke?.bind(supabase.functions);
    if (!invoke) return;
    void invoke("session-cover", { body }).then(({ data }) => {
      const next = typeof data?.url === "string" ? data.url : null;
      if (!next) return;
      try { localStorage.setItem(STORE, JSON.stringify({ ...readStore(), [cacheKey]: next })); } catch { /* sin almacenamiento: se pedirá otra vez */ }
      if (alive) setUrl(next);
    }).catch(() => { /* sin imagen de IA: se queda el respaldo */ });
    return () => { alive = false; };
    // body se deriva de cacheKey: con la misma clave, la misma petición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return url ?? fallback;
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
