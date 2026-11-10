import { supabase } from "@/shared/integrations/supabase/client";

/**
 * Puente entre Autopilot Drive y la biblioteca de ejercicios.
 * Todo vive bajo «Ejercicios» → «Calistenia» | «Gimnasio» → músculo.
 * El Drive guarda el original (bucket privado `library`); el ejercicio usa una
 * copia pública en `site-assets` para que se vea en la app (APNG animado incluido).
 */
export const EXERCISE_ROOT = "Ejercicios";

export const exerciseFolderPath = (type?: string | null, muscle?: string | null): string[] => [
  EXERCISE_ROOT,
  type === "Calistenia" ? "Calistenia" : "Gimnasio",
  muscle?.trim() || "Otros",
];

const extOf = (name: string) => (name.match(/\.([a-z0-9]{1,8})$/i)?.[1] || "").toLowerCase();

export const isAnimatedImage = (url?: string | null) => /\.(apng|gif)(\?|$)/i.test(url || "");

const contentTypeOf = (file: File) => {
  const ext = extOf(file.name);
  if (ext === "apng") return "image/apng";
  return file.type || "application/octet-stream";
};

type Row = { id: string; title: string; parent_id: string | null; is_folder: boolean; kind: string | null; file_path: string | null };

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

const loadRows = async (): Promise<Row[]> => {
  const { data, error } = await supabase.from("library_books").select("id, title, parent_id, is_folder, kind, file_path");
  if (error) throw error;
  return (data || []) as Row[];
};

/** Busca (o crea) la ruta de carpetas y devuelve el id de la última. */
export const ensureFolderPath = async (segments: string[]): Promise<string> => {
  const rows = await loadRows();
  let parent: string | null = null;
  for (const name of segments) {
    const found = rows.find((r) => r.is_folder && (r.parent_id || null) === parent && r.title.trim().toLowerCase() === name.toLowerCase());
    if (found) { parent = found.id; continue; }
    const { data, error } = await supabase
      .from("library_books")
      .insert({ title: name, folder: `folder-${slug(name)}-${Date.now()}`, kind: "folder", is_folder: true, is_pack: false, parent_id: parent, published: false, sort_order: rows.length })
      .select("id")
      .single();
    if (error) throw error;
    parent = (data as { id: string }).id;
    rows.push({ id: parent, title: name, parent_id: null, is_folder: true, kind: "folder", file_path: null });
  }
  return parent as string;
};

export const ensureBaseExerciseFolders = async () => {
  await ensureFolderPath([EXERCISE_ROOT, "Calistenia"]);
  await ensureFolderPath([EXERCISE_ROOT, "Gimnasio"]);
};

/** Ids de todo lo que cuelga de «Ejercicios» (incluida la raíz). */
const exerciseTree = (rows: Row[]) => {
  const root = rows.find((r) => r.is_folder && !r.parent_id && r.title.trim().toLowerCase() === EXERCISE_ROOT.toLowerCase());
  if (!root) return { root: null, ids: new Set<string>() };
  const ids = new Set([root.id]);
  let added = true;
  while (added) {
    added = false;
    for (const r of rows) if (r.parent_id && ids.has(r.parent_id) && !ids.has(r.id)) { ids.add(r.id); added = true; }
  }
  return { root, ids };
};

const labelOf = (rows: Row[], id: string) => {
  const parts: string[] = [];
  let cur = rows.find((r) => r.id === id);
  while (cur) { parts.unshift(cur.title); cur = cur.parent_id ? rows.find((r) => r.id === cur!.parent_id) : undefined; }
  return parts.join(" / ");
};

export type DriveFolderOption = { id: string; label: string };
export type DriveExerciseFile = { id: string; title: string; file_path: string; folder: string };

export const listExerciseFolders = async (): Promise<DriveFolderOption[]> => {
  const rows = await loadRows();
  const { ids } = exerciseTree(rows);
  return rows.filter((r) => r.is_folder && ids.has(r.id)).map((r) => ({ id: r.id, label: labelOf(rows, r.id) })).sort((a, b) => a.label.localeCompare(b.label, "es"));
};

const IMAGE = /\.(apng|png|jpe?g|webp|gif|avif)$/i;

export const listExerciseImages = async (): Promise<DriveExerciseFile[]> => {
  const rows = await loadRows();
  const { ids } = exerciseTree(rows);
  return rows
    .filter((r) => !r.is_folder && r.parent_id && ids.has(r.parent_id) && r.file_path && IMAGE.test(r.file_path))
    .map((r) => ({ id: r.id, title: r.title, file_path: r.file_path as string, folder: labelOf(rows, r.parent_id as string) }));
};

export const isInExerciseTree = async (id: string) => exerciseTree(await loadRows()).ids.has(id);

/** Copia pública que usa el ejercicio. */
const publish = async (file: Blob, ext: string, type: string) => {
  const path = `exercise-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "png"}`;
  const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true, contentType: type });
  if (error) throw error;
  return supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
};

/** Sube el archivo al Drive (en la carpeta indicada) y devuelve la URL pública para el ejercicio. */
export const uploadExerciseFile = async (file: File, folderId: string, title: string): Promise<string> => {
  const ext = extOf(file.name) || "png";
  const type = contentTypeOf(file);
  const drivePath = `ejercicios/${slug(title)}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("library").upload(drivePath, file, { upsert: false, contentType: type });
  if (error) throw error;
  const { error: rowError } = await supabase.from("library_books").insert({
    title, folder: `file-${slug(title)}-${Date.now()}`, kind: "file", is_folder: false, is_pack: false,
    parent_id: folderId, file_path: drivePath, published: false, sort_order: 0,
  });
  if (rowError) { await supabase.storage.from("library").remove([drivePath]); throw rowError; }
  return publish(file, ext, type);
};

/** Toma un archivo que ya está en el Drive y lo convierte en la imagen pública de un ejercicio. */
export const publishDriveFile = async (drivePath: string): Promise<string> => {
  const { data, error } = await supabase.storage.from("library").download(drivePath);
  if (error || !data) throw error || new Error("No se pudo leer el archivo del Drive");
  const ext = extOf(drivePath) || "png";
  return publish(data, ext, ext === "apng" ? "image/apng" : data.type || "image/png");
};

export const assignDriveFileToExercise = async (drivePath: string, exerciseId: string) => {
  const url = await publishDriveFile(drivePath);
  const { error } = await supabase.from("exercises").update({ image_url: url }).eq("id", exerciseId);
  if (error) throw error;
  return url;
};

export type SyncableExercise = { id: string; name: string; exercise_type?: string | null; muscle_group?: string | null; image_url?: string | null };

/** Pure: carpeta destino de cada ejercicio (Ejercicios / Calistenia|Gimnasio / músculo). */
export const plannedDriveLayout = (exercises: SyncableExercise[]) =>
  exercises.map((e) => ({ id: e.id, path: exerciseFolderPath(e.exercise_type, e.muscle_group) }));

/**
 * Refleja la biblioteca en el Drive: crea Calistenia/Gimnasio con cada músculo,
 * copia la imagen de cada ejercicio a su carpeta y mueve las que cambiaron de tipo o músculo.
 * Cada archivo se identifica por `folder = exercise-<id>`, así no se duplica.
 */
export const syncLibraryToDrive = async (exercises: SyncableExercise[], muscles: readonly string[] = []) => {
  for (const type of ["Calistenia", "Gimnasio"]) for (const m of muscles) await ensureFolderPath([EXERCISE_ROOT, type, m]);
  const { data, error } = await supabase.from("library_books").select("id, parent_id, folder, file_path").like("folder", "exercise-%");
  if (error) throw error;
  const existing = new Map((data || []).map((r: { id: string; parent_id: string | null; folder: string; file_path: string | null }) => [r.folder, r]));
  const folderCache = new Map<string, string>();
  let copied = 0, moved = 0, failed = 0;
  for (const ex of exercises) {
    if (!ex.image_url) continue;
    const path = exerciseFolderPath(ex.exercise_type, ex.muscle_group);
    const key = path.join("/");
    try {
      if (!folderCache.has(key)) folderCache.set(key, await ensureFolderPath(path));
      const folderId = folderCache.get(key)!;
      const row = existing.get(`exercise-${ex.id}`);
      if (row) {
        if (row.parent_id !== folderId) {
          await supabase.from("library_books").update({ parent_id: folderId, title: ex.name }).eq("id", row.id);
          moved++;
        }
        continue;
      }
      const res = await fetch(ex.image_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext = extOf(new URL(ex.image_url).pathname) || "png";
      const drivePath = `ejercicios/${slug(ex.name)}-${ex.id.slice(0, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("library").upload(drivePath, blob, { upsert: true, contentType: ext === "apng" ? "image/apng" : blob.type || "image/png" });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("library_books").insert({
        title: ex.name, folder: `exercise-${ex.id}`, kind: "file", is_folder: false, is_pack: false,
        parent_id: folderId, file_path: drivePath, published: false, sort_order: 0,
      });
      if (insErr) throw insErr;
      copied++;
    } catch (e) { console.warn("Drive sync failed for", ex.name, e); failed++; }
  }
  return { copied, moved, failed };
};
