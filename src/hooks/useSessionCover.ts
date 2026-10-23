import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORE = "autopilot.sessionCovers.v1";

function readStore(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; }
}

/**
 * Portada de la sesión generada con IA (edge function session-cover). La función
 * la guarda una vez por combinación de músculos; aquí se recuerda por sesión para
 * no volver a pedirla. Mientras no llega, o si falla, devuelve `fallback`.
 */
export function useSessionCover(exerciseIds: (string | undefined)[], fallback: string | null) {
  const ids = exerciseIds.filter((x): x is string => !!x).sort();
  const key = ids.join(",");
  const [url, setUrl] = useState<string | null>(() => (key ? readStore()[key] ?? null : null));

  useEffect(() => {
    if (!key) return;
    const known = readStore()[key];
    if (known) { setUrl(known); return; }
    setUrl(null);
    let alive = true;
    const invoke = supabase.functions?.invoke?.bind(supabase.functions);
    if (!invoke) return;
    void invoke("session-cover", { body: { exercise_ids: key.split(",") } }).then(({ data }) => {
      const next = typeof data?.url === "string" ? data.url : null;
      if (!next) return;
      try { localStorage.setItem(STORE, JSON.stringify({ ...readStore(), [key]: next })); } catch { /* sin almacenamiento: se pedirá otra vez */ }
      if (alive) setUrl(next);
    }).catch(() => { /* sin portada de IA: se queda la foto del primer ejercicio */ });
    return () => { alive = false; };
  }, [key]);

  return url ?? fallback;
}
