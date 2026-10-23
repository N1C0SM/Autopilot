import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";

/**
 * Foto de cada ejercicio por nombre (biblioteca de ejercicios). Es decoración:
 * si falla la consulta, las pantallas se quedan sin foto en vez de avisar.
 */
export function useExerciseImages(names: string[]): Record<string, string> {
  const key = [...new Set(names.filter(Boolean))].sort().join("\n");
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!key) { setImages({}); return; }
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.from("exercises").select("name, image_url").in("name", key.split("\n"));
        if (!alive) return;
        const next: Record<string, string> = {};
        for (const row of data ?? []) if (row.image_url) next[row.name] = row.image_url;
        setImages(next);
      } catch { /* sin fotos */ }
    })();
    return () => { alive = false; };
  }, [key]);

  return images;
}
