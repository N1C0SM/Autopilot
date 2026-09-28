import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { DayPlan } from "@/types/training";

export interface ExerciseMetadata {
  id: string;
  name: string;
  muscle_group: string | null;
  exercise_type: string | null;
  video_url: string | null;
  image_url: string | null;
}

interface ExerciseMetadataIndex {
  byId: Record<string, ExerciseMetadata>;
  byName: Record<string, ExerciseMetadata>;
}

const EMPTY_INDEX: ExerciseMetadataIndex = { byId: {}, byName: {} };

export function useExerciseMetadata(dayPlans: DayPlan[]): ExerciseMetadataIndex {
  const entries = dayPlans.flatMap((day) => day.exercises ?? []);
  const lookupKey = JSON.stringify({
    ids: [...new Set(entries.map((exercise) => exercise.exercise_id).filter(Boolean))].sort(),
    names: [...new Set(entries.filter((exercise) => !exercise.exercise_id).map((exercise) => exercise.name))].sort(),
  });
  const [metadata, setMetadata] = useState(EMPTY_INDEX);

  useEffect(() => {
    const { ids, names } = JSON.parse(lookupKey) as { ids: string[]; names: string[] };
    if (ids.length === 0 && names.length === 0) {
      setMetadata(EMPTY_INDEX);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setMetadata(EMPTY_INDEX);
      try {
        const requests = [];
        if (ids.length > 0) {
          requests.push(
            supabase
              .from("exercises")
              .select("id, name, muscle_group, exercise_type, video_url, image_url")
              .in("id", ids),
          );
        }
        if (names.length > 0) {
          requests.push(
            supabase
              .from("exercises")
              .select("id, name, muscle_group, exercise_type, video_url, image_url")
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
              video_url: row.video_url,
              image_url: row.image_url,
            };
            index.byId[item.id] = item;
            index.byName[item.name] = item;
          }
        }
        if (!cancelled) setMetadata(index);
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
