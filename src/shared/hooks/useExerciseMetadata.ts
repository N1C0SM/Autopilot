import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/shared/integrations/supabase/client";
import type { DayPlan } from "@/shared/types/training";
import { fastImage } from "@/shared/lib/fastImage";

export interface ExerciseMetadata {
  id: string;
  name: string;
  muscle_group: string | null;
  exercise_type: string | null;
  movement_pattern: string | null;
  stimulus_type?: string | null;
  load_level?: string | null;
  skill_tag: string | null;
  video_url: string | null;
  image_url: string | null;
  tracking_mode?: string | null;
}

interface ExerciseMetadataIndex {
  byId: Record<string, ExerciseMetadata>;
  byName: Record<string, ExerciseMetadata>;
}

const EMPTY_INDEX: ExerciseMetadataIndex = { byId: {}, byName: {} };

/**
 * Lo ya leído en esta sesión: al volver a Hoy, Entrenar o al entreno, las fotos y los clips
 * salen al instante de memoria y la red solo los pone al día (nunca un parpadeo sin foto).
 */
const memory: ExerciseMetadataIndex = { byId: {}, byName: {} };

const fromMemory = (ids: string[], names: string[]): ExerciseMetadataIndex => {
  const index: ExerciseMetadataIndex = { byId: {}, byName: {} };
  for (const id of ids) {
    const item = memory.byId[id];
    if (item) { index.byId[id] = item; index.byName[item.name] = item; }
  }
  for (const name of names) {
    const item = memory.byName[name];
    if (item) { index.byName[name] = item; index.byId[item.id] = item; }
  }
  return index;
};

export function useExerciseMetadata(dayPlans: DayPlan[]): ExerciseMetadataIndex {
  const entries = dayPlans.flatMap((day) => day.exercises ?? []);
  const lookupKey = JSON.stringify({
    ids: [...new Set(entries.map((exercise) => exercise.exercise_id).filter(Boolean))].sort(),
    names: [...new Set(entries.filter((exercise) => !exercise.exercise_id).map((exercise) => exercise.name))].sort(),
  });
  const [metadata, setMetadata] = useState(() => {
    const { ids, names } = JSON.parse(lookupKey) as { ids: string[]; names: string[] };
    return fromMemory(ids, names);
  });

  useEffect(() => {
    const { ids, names } = JSON.parse(lookupKey) as { ids: string[]; names: string[] };
    if (ids.length === 0 && names.length === 0) {
      setMetadata(EMPTY_INDEX);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setMetadata(fromMemory(ids, names));
      try {
        const requests = [];
        if (ids.length > 0) {
          requests.push(
            supabase
              .from("exercises")
              .select("id, name, muscle_group, exercise_type, movement_pattern, stimulus_type, load_level, skill_tag, video_url, image_url, tracking_mode")
              .in("id", ids),
          );
        }
        if (names.length > 0) {
          requests.push(
            supabase
              .from("exercises")
              .select("id, name, muscle_group, exercise_type, movement_pattern, stimulus_type, load_level, skill_tag, video_url, image_url, tracking_mode")
              .in("name", names),
          );
        }

        const results = await Promise.all(requests);
        const failed = results.find((result) => result.error);
        if (failed?.error) throw failed.error;

        const index: ExerciseMetadataIndex = { byId: {}, byName: {} };
        for (const result of results) {
          for (const row of result.data ?? []) {
            const item: ExerciseMetadata = {
              id: row.id,
              name: row.name,
              muscle_group: row.muscle_group,
              exercise_type: row.exercise_type,
              movement_pattern: row.movement_pattern,
              stimulus_type: row.stimulus_type,
              load_level: row.load_level,
              skill_tag: row.skill_tag,
              video_url: row.video_url,
              image_url: fastImage(row.image_url, 800),
            };
            index.byId[item.id] = item;
            index.byName[item.name] = item;
            memory.byId[item.id] = item;
            memory.byName[item.name] = item;
          }
        }
        if (!cancelled) {
          setMetadata(index);
          // Precarga proactiva en caché de navegador para carga instantánea
          if (typeof window !== "undefined") {
            for (const item of Object.values(index.byId)) {
              if (item.image_url) {
                const img = new Image();
                img.src = item.image_url;
              }
            }
          }
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load exercise categories and videos", error);
        toast.error("No se pudieron cargar las categorías y vídeos de los ejercicios");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [lookupKey]);

  return metadata;
}
