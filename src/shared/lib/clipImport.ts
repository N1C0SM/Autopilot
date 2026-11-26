/**
 * Clips propios de ejercicios (Admin → Ejercicios → «Clips propios»): un .zip o una carpeta con
 * una subcarpeta por ejercicio, cada una con `video.mp4` y, si hay, `miniatura.png`.
 * Agrupa los archivos, los empareja con la biblioteca por nombre y lee el .zip sin librerías.
 * Sin DOM salvo `Blob`/`DecompressionStream`, que también existen en Node.
 */

/** Un archivo del .zip o de la carpeta: su ruta y cómo leerlo. */
export type ClipSource = { path: string; size: number; read: () => Promise<Blob> };

/** Lo que hay para un ejercicio. */
export type ClipGroup = { folder: string; video: ClipSource | null; thumb: ClipSource | null };

export type ExerciseRef = { id: string; name: string };

/** Emparejamiento: exacto por nombre, sugerido por parecido (hay que revisarlo) o ninguno. */
export type ClipMatch = { id: string | null; kind: "exact" | "suggested" | "none" };

const VIDEO = /\.(mp4|m4v|mov)$/i;
const IMAGE = /\.(png|jpe?g|webp)$/i;

/** Parecido mínimo (Dice sobre pares de letras) para sugerir un ejercicio. */
export const SUGGEST_THRESHOLD = 0.75;

/** Nombre comparable: sin tildes, sin mayúsculas y solo letras y números. */
export const normalizeName = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Carpetas y archivos que no son material: `__MACOSX`, `.DS_Store`, `._x` y borradores `_x`. */
const isHidden = (segment: string) => segment.startsWith(".") || segment.startsWith("_");

const stem = (name: string) => name.replace(/\.[^.]+$/, "");

/**
 * Agrupa por ejercicio: el nombre de la carpeta que contiene el archivo o, si se eligieron
 * archivos sueltos, el nombre del archivo. Ignora todo lo oculto o de borrador.
 */
export const groupClipFiles = (files: ClipSource[]): ClipGroup[] => {
  const groups = new Map<string, { folder: string; videos: ClipSource[]; images: ClipSource[] }>();
  for (const file of files) {
    const parts = file.path.normalize("NFC").split("/").filter(Boolean);
    if (parts.length === 0 || parts.some(isHidden)) continue;
    const name = parts[parts.length - 1];
    const isVideo = VIDEO.test(name);
    if (!isVideo && !IMAGE.test(name)) continue;
    const folder = (parts.length > 1 ? parts[parts.length - 2] : stem(name)).trim();
    const key = normalizeName(folder);
    if (!key) continue;
    const group = groups.get(key) ?? { folder, videos: [], images: [] };
    (isVideo ? group.videos : group.images).push(file);
    groups.set(key, group);
  }
  const pick = (list: ClipSource[], preferred: string) => {
    const named = list.find((f) => stem(f.path.split("/").pop() ?? "").toLowerCase() === preferred);
    return named ?? list[0] ?? null;
  };
  return [...groups.values()]
    .map((g) => ({ folder: g.folder, video: pick(g.videos, "video"), thumb: pick(g.images, "miniatura") }))
    .sort((a, b) => a.folder.localeCompare(b.folder, "es"));
};

const bigrams = (value: string): string[] => {
  const s = value.replace(/ /g, "");
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
};

/** Parecido entre dos nombres ya normalizados (0–1). */
export const nameSimilarity = (a: string, b: string): number => {
  if (a === b) return 1;
  const x = bigrams(a);
  const y = bigrams(b);
  if (x.length === 0 || y.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const g of y) pool.set(g, (pool.get(g) ?? 0) + 1);
  let shared = 0;
  for (const g of x) {
    const left = pool.get(g) ?? 0;
    if (left > 0) { shared++; pool.set(g, left - 1); }
  }
  return (2 * shared) / (x.length + y.length);
};

/** El ejercicio de una carpeta: por nombre exacto o, si no, el más parecido por encima del umbral. */
export const matchExercise = (folder: string, exercises: ExerciseRef[]): ClipMatch => {
  const key = normalizeName(folder);
  const exact = exercises.find((e) => normalizeName(e.name) === key);
  if (exact) return { id: exact.id, kind: "exact" };
  let best: { id: string; score: number } | null = null;
  for (const e of exercises) {
    const score = nameSimilarity(key, normalizeName(e.name));
    if (score >= SUGGEST_THRESHOLD && (!best || score > best.score)) best = { id: e.id, score };
  }
  return best ? { id: best.id, kind: "suggested" } : { id: null, kind: "none" };
};

/** Tipo de contenido por extensión (para subirlo con el tipo correcto). */
export const clipContentType = (path: string): string => {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (ext === "mov") return "video/quicktime";
  if (ext === "m4v") return "video/x-m4v";
  if (ext === "mp4") return "video/mp4";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
};

/**
 * Lee el índice de un .zip (sin ZIP64: hasta 4 GB) y devuelve sus archivos; cada uno se
 * descomprime solo al leerlo. Admite «sin comprimir» y «deflate», los dos que crea el Finder.
 */
export const readZip = async (file: Blob): Promise<ClipSource[]> => {
  const tailLength = Math.min(file.size, 22 + 0xffff);
  const tail = new DataView(await file.slice(file.size - tailLength).arrayBuffer());
  let end = -1;
  for (let i = tailLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("El archivo no es un .zip válido.");
  const count = tail.getUint16(end + 10, true);
  const directorySize = tail.getUint32(end + 12, true);
  const directoryOffset = tail.getUint32(end + 16, true);
  const directory = new DataView(await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer());
  const decoder = new TextDecoder("utf-8");
  const out: ClipSource[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= directory.byteLength; n++) {
    if (directory.getUint32(p, true) !== 0x02014b50) break;
    const method = directory.getUint16(p + 10, true);
    const compressedSize = directory.getUint32(p + 20, true);
    const size = directory.getUint32(p + 24, true);
    const nameLength = directory.getUint16(p + 28, true);
    const extraLength = directory.getUint16(p + 30, true);
    const commentLength = directory.getUint16(p + 32, true);
    const localOffset = directory.getUint32(p + 42, true);
    const path = decoder.decode(new Uint8Array(directory.buffer, directory.byteOffset + p + 46, nameLength));
    p += 46 + nameLength + extraLength + commentLength;
    if (path.endsWith("/")) continue;
    out.push({
      path,
      size,
      read: async () => {
        const local = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer());
        if (local.getUint32(0, true) !== 0x04034b50) throw new Error(`No se pudo leer ${path} del .zip.`);
        const start = localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
        const data = file.slice(start, start + compressedSize);
        if (method === 0) return data;
        if (method !== 8) throw new Error(`${path} usa una compresión que no se puede leer.`);
        const stream = data.stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Response(stream).blob();
      },
    });
  }
  return out;
};

/** Archivos elegidos en el navegador (carpeta o sueltos) como fuentes. */
export const filesAsSources = (files: Iterable<File>): ClipSource[] =>
  [...files].map((file) => ({
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    size: file.size,
    read: async () => file,
  }));
