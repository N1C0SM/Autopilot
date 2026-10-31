import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { legacyGroups, legacyModalities, type LibraryExercise } from "@/shared/lib/exerciseLibrary";

type MuscleLink = { role: string; muscles: { name: string; filter_group: string | null; sort: number } | null };
type Row = {
  id: string;
  name: string;
  slug?: string | null;
  alt_names?: string[] | null;
  muscle_group: string | null;
  exercise_type: string | null;
  movement_pattern: string | null;
  level: number | null;
  image_url: string | null;
  video_url: string | null;
  description?: string | null;
  instructions?: string[] | null;
  common_mistakes?: string[] | null;
  tips?: string[] | null;
  safety_notes?: string[] | null;
  source?: string | null;
  license?: string | null;
  license_author?: string | null;
  source_url?: string | null;
  exercise_muscles?: MuscleLink[] | null;
  exercise_equipment?: { equipment: { name: string; sort: number } | null }[] | null;
  exercise_categories?: { exercise_categories_catalog: { name: string } | null }[] | null;
};

const BASE = "id, name, muscle_group, exercise_type, movement_pattern, stimulus_type, load_level, level, image_url, video_url";
const FULL = `${BASE}, slug, alt_names, description, instructions, common_mistakes, tips, safety_notes, source, license, license_author, source_url, `
  + "exercise_muscles(role, muscles(name, filter_group, sort)), exercise_equipment(equipment(name, sort)), "
  + "exercise_categories(exercise_categories_catalog(name))";
const PAGE = 1000;

const uniq = (values: (string | null | undefined)[]) => [...new Set(values.filter((v): v is string => !!v))];

export const toLibraryExercise = (r: Row): LibraryExercise => {
  const links = [...(r.exercise_muscles ?? [])]
    .filter((m) => m.muscles)
    .sort((a, b) => (a.role === b.role ? (a.muscles?.sort ?? 0) - (b.muscles?.sort ?? 0) : a.role === "primary" ? -1 : 1));
  const primary = links.filter((m) => m.role === "primary");
  const linkedGroups = uniq(primary.map((m) => m.muscles?.filter_group));
  const modalities = uniq((r.exercise_categories ?? []).map((c) => c.exercise_categories_catalog?.name));
  return {
    id: r.id,
    slug: r.slug ?? null,
    name: r.name,
    altNames: r.alt_names ?? [],
    groups: linkedGroups.length ? linkedGroups : legacyGroups(r.muscle_group),
    primaryMuscles: uniq(primary.map((m) => m.muscles?.name)),
    secondaryMuscles: uniq(links.filter((m) => m.role !== "primary").map((m) => m.muscles?.name)),
    equipment: uniq([...(r.exercise_equipment ?? [])]
      .sort((a, b) => (a.equipment?.sort ?? 0) - (b.equipment?.sort ?? 0))
      .map((e) => e.equipment?.name)),
    modalities: modalities.length ? modalities : legacyModalities(r.exercise_type),
    pattern: r.movement_pattern,
    level: r.level,
    stimulus: r.stimulus_type ?? null,
    load: r.load_level ?? null,
    image: r.image_url,
    video: r.video_url,
    description: r.description ?? null,
    instructions: r.instructions ?? [],
    mistakes: r.common_mistakes ?? [],
    tips: r.tips ?? [],
    safety: r.safety_notes ?? [],
    source: r.source ?? "autopilot",
    license: r.license ?? null,
    licenseAuthor: r.license_author ?? null,
    sourceUrl: r.source_url ?? null,
  };
};

/** Toda la biblioteca publicada, por páginas (PostgREST corta en 1.000 filas). */
async function fetchCatalog(): Promise<LibraryExercise[]> {
  const load = async (select: string, published: boolean) => {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      let query = supabase.from("exercises").select(select).order("name").range(from, from + PAGE - 1);
      if (published) query = query.eq("status", "published");
      const { data, error } = await query;
      if (error) throw error;
      const page = (data ?? []) as unknown as Row[];
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  };
  try {
    return (await load(FULL, true)).map(toLibraryExercise);
  } catch {
    // Sin la migración de la biblioteca todavía: mismos ejercicios, filtros por su grupo de siempre.
    return (await load(BASE, false)).map(toLibraryExercise);
  }
}

let cache: Promise<LibraryExercise[]> | null = null;

/** Índice de la biblioteca (una descarga por sesión) + favoritos y recientes del usuario. */
export function useExerciseLibrary(userId: string | null | undefined, enabled = true) {
  const [items, setItems] = useState<LibraryExercise[] | null>(null);
  const [error, setError] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<string[]>([]);
  const [personal, setPersonal] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    cache ??= fetchCatalog();
    cache.then((list) => { if (alive) { setItems(list); setError(false); } })
      .catch(() => { cache = null; if (alive) setError(true); });
    return () => { alive = false; };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !userId) return;
    let alive = true;
    void (async () => {
      const [fav, rec] = await Promise.all([
        supabase.from("exercise_favorites").select("exercise_id").eq("user_id", userId),
        supabase.from("exercise_recent").select("exercise_id").eq("user_id", userId).order("viewed_at", { ascending: false }).limit(12),
      ]);
      if (!alive || fav.error || rec.error) return;
      setFavorites(new Set((fav.data ?? []).map((r) => r.exercise_id)));
      setRecent((rec.data ?? []).map((r) => r.exercise_id));
      setPersonal(true);
    })();
    return () => { alive = false; };
  }, [enabled, userId]);

  const toggleFavorite = useCallback(async (exerciseId: string) => {
    if (!userId) return;
    const wasOn = favorites.has(exerciseId);
    const flip = (on: boolean) => setFavorites((prev) => {
      const next = new Set(prev);
      if (on) next.add(exerciseId); else next.delete(exerciseId);
      return next;
    });
    flip(!wasOn);
    const { error: err } = wasOn
      ? await supabase.from("exercise_favorites").delete().eq("user_id", userId).eq("exercise_id", exerciseId)
      : await supabase.from("exercise_favorites").insert({ user_id: userId, exercise_id: exerciseId });
    if (err) flip(wasOn);
  }, [favorites, userId]);

  const markViewed = useCallback((exerciseId: string) => {
    setRecent((prev) => [exerciseId, ...prev.filter((id) => id !== exerciseId)].slice(0, 12));
    if (!userId || !personal) return;
    void supabase.from("exercise_recent")
      .upsert({ user_id: userId, exercise_id: exerciseId, viewed_at: new Date().toISOString() }, { onConflict: "user_id,exercise_id" });
  }, [personal, userId]);

  const retry = useCallback(() => { cache = null; setError(false); setItems(null); cache = fetchCatalog(); cache.then(setItems).catch(() => { cache = null; setError(true); }); }, []);

  return { items, error, retry, favorites, recent, personal, toggleFavorite, markViewed };
}
