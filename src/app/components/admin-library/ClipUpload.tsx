import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import type { TablesUpdate } from "@/shared/integrations/supabase/types";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { Switch } from "@/shared/components/ui/switch";
import { errorMessage } from "@/shared/lib/runtimeValues";
import { hapticNotify, hapticTap } from "@/shared/lib/native";
import {
  clipContentType,
  filesAsSources,
  groupClipFiles,
  matchExercise,
  readZip,
  type ClipGroup,
  type ClipMatch,
  type ExerciseRef,
} from "@/shared/lib/clipImport";

/** Debe coincidir con MEDIA_STYLE_VERSION de la biblioteca: un clip propio cuenta como actual. */
const MEDIA_STYLE_VERSION = 4;
/** Lado mayor de la foto que se saca del primer fotograma. */
const POSTER_SIDE = 1280;

const SELECT_CLASS =
  "field w-full min-w-0 text-foreground focus-visible:outline-none md:focus-visible:ring-2 md:focus-visible:ring-primary/40";

type Row = ClipGroup & { match: ClipMatch; exerciseId: string };
type Run = { current: number; total: number; name: string };
type Outcome = { done: number; failures: { name: string; message: string }[] };

/** Primer fotograma del clip como foto (WebP o, si el navegador no lo codifica, JPEG). */
const posterFrom = (video: Blob): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(video);
    const el = document.createElement("video");
    let settled = false;
    const finish = (blob: Blob | null, error?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (blob) resolve(blob);
      else reject(new Error(error ?? "No se pudo sacar la foto del vídeo."));
    };
    const timer = window.setTimeout(() => finish(null, "El vídeo tardó demasiado en abrirse."), 20000);
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    el.onerror = () => finish(null, "El navegador no puede abrir este vídeo.");
    // Safari no pinta el fotograma hasta un salto de tiempo.
    el.onloadeddata = () => { el.currentTime = 0.04; };
    el.onseeked = () => {
      const scale = Math.min(1, POSTER_SIDE / Math.max(el.videoWidth, el.videoHeight, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(el.videoWidth * scale);
      canvas.height = Math.round(el.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx || canvas.width === 0) return finish(null);
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((webp) => {
        if (webp && webp.type === "image/webp") return finish(webp);
        canvas.toBlob((jpeg) => finish(jpeg), "image/jpeg", 0.86);
      }, "image/webp", 0.86);
    };
    el.src = url;
  });

const extensionOf = (path: string) => path.toLowerCase().split(".").pop() || "mp4";

const upload = async (path: string, blob: Blob, contentType: string) => {
  // Con un Blob, Storage guarda el tipo del propio Blob (lo leído del .zip no lo trae).
  const typed = blob.type === contentType ? blob : new Blob([blob], { type: contentType });
  const { error } = await supabase.storage.from("site-assets").upload(path, typed, {
    upsert: false,
    contentType,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
};

/**
 * Admin → Ejercicios: sube clips propios (un .zip o una carpeta con una carpeta por ejercicio)
 * y los pone en movimiento en el entreno, la ficha y la biblioteca. Cada archivo va a una ruta
 * nueva, así que nada de lo que ya había se sobrescribe.
 */
export default function ClipUpload({ exercises, mediaColumns, onChanged }: {
  exercises: ExerciseRef[];
  mediaColumns: boolean;
  onChanged: () => void;
}) {
  const zipInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [usePoster, setUsePoster] = useState(true);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // `webkitdirectory` no está en los tipos de React: se pone a mano.
  useEffect(() => { folderInput.current?.setAttribute("webkitdirectory", ""); }, []);

  const sorted = useMemo(() => [...exercises].sort((a, b) => a.name.localeCompare(b.name, "es")), [exercises]);
  const ready = (rows ?? []).filter((r) => r.video && r.exerciseId);

  const load = async (pick: () => Promise<ReturnType<typeof groupClipFiles>>) => {
    setReading(true);
    setReadError(null);
    setOutcome(null);
    try {
      const groups = await pick();
      setRows(groups.map((g) => {
        const match = matchExercise(g.folder, exercises);
        return { ...g, match, exerciseId: g.video ? match.id ?? "" : "" };
      }));
    } catch (error) {
      setRows(null);
      setReadError(errorMessage(error));
    } finally {
      setReading(false);
    }
  };

  const onZip = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void load(async () => groupClipFiles(await readZip(file)));
  };
  const onFolder = (files: FileList | null) => {
    if (files?.length) void load(async () => groupClipFiles(filesAsSources(Array.from(files))));
  };

  const setExercise = (folder: string, exerciseId: string) =>
    setRows((current) => current?.map((r) => (r.folder === folder ? { ...r, exerciseId } : r)) ?? null);

  const start = async () => {
    void hapticTap();
    const queue = ready;
    const failures: Outcome["failures"] = [];
    let done = 0;
    for (let index = 0; index < queue.length; index++) {
      const row = queue[index];
      const exercise = exercises.find((e) => e.id === row.exerciseId);
      setRun({ current: index + 1, total: queue.length, name: exercise?.name ?? row.folder });
      try {
        const video = await row.video!.read();
        const stamp = Date.now();
        const videoExt = extensionOf(row.video!.path);
        const videoUrl = await upload(`exercise-videos/${row.exerciseId}-clip-${stamp}.${videoExt}`, video, clipContentType(row.video!.path));
        let imageUrl: string | null = null;
        if (usePoster) {
          let poster: Blob | null = await posterFrom(video).catch(() => null);
          let posterExt = poster?.type === "image/webp" ? "webp" : "jpg";
          if (!poster && row.thumb) { poster = await row.thumb.read(); posterExt = extensionOf(row.thumb.path); }
          if (poster) imageUrl = await upload(`exercise-images/${row.exerciseId}-clip-${stamp}.${posterExt}`, poster, clipContentType(`x.${posterExt}`));
        }
        const now = new Date().toISOString();
        const patch: TablesUpdate<"exercises"> = { video_url: videoUrl };
        if (imageUrl) patch.image_url = imageUrl;
        if (mediaColumns) {
          // Versión actual: la cola de IA y «Vídeos de los planes» no lo vuelven a generar.
          Object.assign(patch, { media_style_version: MEDIA_STYLE_VERSION, video_generated_at: now, media_error: null });
          if (imageUrl) patch.image_generated_at = now;
        }
        const { error } = await supabase.from("exercises").update(patch).eq("id", row.exerciseId);
        if (error) throw error;
        done++;
      } catch (error) {
        failures.push({ name: exercise?.name ?? row.folder, message: errorMessage(error) });
      }
    }
    setRun(null);
    setOutcome({ done, failures });
    void hapticNotify(failures.length ? "warning" : "success");
    if (done > 0) {
      setRows(null);
      onChanged();
    }
  };

  const busy = reading || Boolean(run);

  return (
    <section aria-labelledby="clip-upload-title" className="space-y-3 rounded-[22px] bg-card p-5">
      <h2 id="clip-upload-title" className="type-headline">Clips propios</h2>
      <p className="type-footnote text-muted-foreground">
        Elige el .zip o la carpeta: una carpeta por ejercicio con su video.mp4. Se verán en movimiento en el entreno, la ficha y la biblioteca.
      </p>

      <input ref={zipInput} type="file" accept=".zip,application/zip" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { onZip(e.target.files); e.target.value = ""; }} />
      <input ref={folderInput} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { onFolder(e.target.files); e.target.value = ""; }} />

      {!run && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => { void hapticTap(); zipInput.current?.click(); }}>
            Elegir .zip
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => { void hapticTap(); folderInput.current?.click(); }}>
            Elegir carpeta
          </Button>
        </div>
      )}

      {reading && <p role="status" className="type-footnote text-muted-foreground">Leyendo…</p>}
      {readError && <p role="alert" className="type-footnote text-destructive">{readError}</p>}

      {rows && !run && (
        rows.length === 0 ? (
          <p role="status" className="type-footnote text-muted-foreground">No hay vídeos dentro. Cada ejercicio va en su carpeta con un video.mp4.</p>
        ) : (
          <div className="space-y-3">
            <p role="status" className="type-footnote tabular-nums">
              {ready.length} de {rows.length} listos para subir
            </p>
            <ul className="divide-y divide-border/60 overflow-hidden rounded-[16px] bg-secondary">
              {rows.map((row) => (
                <li key={row.folder} className="space-y-1.5 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 break-words type-subhead font-semibold">{row.folder}</span>
                    <span className="shrink-0 type-caption text-muted-foreground">
                      {!row.video ? "Sin video.mp4" : row.match.kind === "exact" && row.exerciseId === row.match.id ? "Encontrado" : row.exerciseId ? "Revísalo" : "Elige el ejercicio"}
                    </span>
                  </div>
                  {row.video && (
                    <select
                      aria-label={`Ejercicio para ${row.folder}`}
                      className={SELECT_CLASS}
                      value={row.exerciseId}
                      onChange={(e) => setExercise(row.folder, e.target.value)}
                    >
                      <option value="">No subir</option>
                      {sorted.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  )}
                </li>
              ))}
            </ul>
            <label className="flex items-center justify-between gap-3">
              <span className="type-subhead">Usar el primer fotograma como foto</span>
              <Switch checked={usePoster} onCheckedChange={setUsePoster} aria-label="Usar el primer fotograma como foto" />
            </label>
            <Button type="button" className="w-full" disabled={ready.length === 0} onClick={() => void start()}>
              {ready.length === 1 ? "Subir 1 clip" : `Subir ${ready.length} clips`}
            </Button>
          </div>
        )
      )}

      {run && (
        <div className="space-y-2" aria-live="polite">
          <p role="status" className="type-subhead font-semibold tabular-nums">Subiendo {run.current} de {run.total}</p>
          <p className="truncate type-footnote text-muted-foreground">{run.name}</p>
          <Progress value={((run.current - 1) / run.total) * 100} aria-label="Progreso de la subida" />
          <p className="type-footnote text-muted-foreground">Mantén esta pantalla abierta hasta que termine.</p>
        </div>
      )}

      {outcome && !run && (
        <div className="space-y-1">
          <p role="status" className="type-footnote">
            {outcome.done === 1 ? "1 clip subido." : `${outcome.done} clips subidos.`}
          </p>
          {outcome.failures.length > 0 && (
            <ul className="space-y-1">
              {outcome.failures.map((f, i) => (
                <li key={`${f.name}-${i}`} className="type-footnote text-muted-foreground">
                  <span className="text-foreground">{f.name}</span> · {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
