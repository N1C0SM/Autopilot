import { useState, useEffect, useRef, useCallback } from "react";
import { IconTile } from "@/components/ui/icon-tile";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Trash2, X, ChevronLeft, ChevronRight, Columns2, ImageOff, WifiOff, Sparkles } from "lucide-react";
import BeforeAfterCompare from "./BeforeAfterCompare";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { hapticTap } from "@/lib/native";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { signedUrlsWithExpiry, storagePathFor } from "@/lib/storageSign";
import { toLocalDateString } from "@/lib/localDates";
import { evolutionLabel, photoPose } from "@/components/progress/progressPhotos";
import { compressImage } from "@/lib/imageCompression";

interface Photo {
  id: string;
  photo_url: string;
  note: string;
  taken_at: string;
  created_at: string;
  scan_history_id?: string | null;
  scan?: {
    id: string;
    result: Record<string, unknown>;
    attractiveness: number;
    potential: number;
    physique: number;
    style: number;
  } | null;
}

interface Props {
  userId: string;
  onGoScan?: () => void;
}

const BUCKET = "progress-photos";
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** Reintento del firmado si no se pudo renovar ninguna URL. */
const SIGN_RETRY_MS = 60_000;
/**
 * Antigüedad máxima de una firma antes de renovarla al recuperar el foco.
 * Evita depender solo del temporizador (los navegadores lo estrangulan en
 * pestañas en segundo plano) sin re-firmar en cada cambio de pestaña.
 */
const SIGN_STALE_MS = 25 * 60_000;

/**
 * Lista blanca de tipos MIME admitidos -> extensión normalizada.
 * Evita guardar en el bucket extensiones arbitrarias sacadas del nombre.
 */
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Marcador para fotos cuya URL firmada aún no está lista (nunca `src=""`). */
const PhotoPlaceholder = ({ label = "Cargando foto…" }: { label?: string }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-secondary/70 text-muted-foreground animate-pulse">
    <ImageOff className="h-5 w-5 opacity-40" aria-hidden="true" />
    <span className="px-1 text-center type-caption2">{label}</span>
  </div>
);

type ScanData = NonNullable<Photo["scan"]>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Ficha del análisis ya guardado; nunca vuelve a ejecutar el Scan. */
const ScanSummaryCard = ({ scan, onClose }: { scan: ScanData; onClose: () => void }) => {
  const r = scan.result ?? {};
  const headline = str(r.headline_diagnosis);
  const summary = str(r.summary);
  const bottleneck = str(r.bottleneck);
  const improvements = Array.isArray(r.improvements)
    ? (r.improvements as Array<{ label?: unknown; priority?: unknown }>)
        .map((i) => ({ label: str(i?.label), priority: str(i?.priority) }))
        .filter((i) => i.label)
        .slice(0, 4)
    : [];
  const bc = (r.body_composition ?? {}) as Record<string, unknown>;
  const fat = typeof bc.body_fat_pct === "number" ? bc.body_fat_pct : null;
  const scores = [
    { label: "Físico", value: scan.physique },
    { label: "Potencial", value: scan.potential },
  ].filter((s) => typeof s.value === "number");

  return (
    <motion.div
      role="region"
      aria-label="Análisis de esta foto"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-x-4 bottom-[max(1rem,var(--safe-bottom))] z-20 mx-auto max-h-[60dvh] max-w-md overflow-y-auto rounded-[22px] border border-white/10 bg-black/75 p-5 text-white backdrop-blur-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 type-caption1 font-medium uppercase tracking-wide text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Scan
        </span>
        <button
          type="button"
          aria-label="Cerrar análisis"
          onClick={onClose}
          className="flex h-11 w-11 -mr-2 items-center justify-center rounded-full text-white/70 active:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {(scores.length > 0 || fat !== null) && (
        <div className="mb-4 flex gap-6">
          {scores.map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-semibold tabular-nums">{s.value.toFixed(1)}</p>
              <p className="type-caption1 text-white/60">{s.label}</p>
            </div>
          ))}
          {fat !== null && (
            <div>
              <p className="text-2xl font-semibold tabular-nums">~{Math.round(fat)}%</p>
              <p className="type-caption1 text-white/60">Grasa estimada</p>
            </div>
          )}
        </div>
      )}

      {headline && <p className="mb-2 type-headline">{headline}</p>}
      {summary && <p className="mb-3 type-subhead text-white/75">{summary}</p>}
      {bottleneck && (
        <p className="mb-3 type-subhead"><span className="text-white/60">Lo que más te frena: </span>{bottleneck}</p>
      )}
      {improvements.length > 0 && (
        <ul className="space-y-2 border-t border-white/10 pt-3">
          {improvements.map((i, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3 type-subhead">
              <span>{i.label}</span>
              {i.priority && <span className="shrink-0 type-caption2 text-white/50">{i.priority}</span>}
            </li>
          ))}
        </ul>
      )}
      {!headline && !summary && improvements.length === 0 && (
        <p className="type-subhead text-white/70">Este análisis no tiene detalles guardados.</p>
      )}
      <p className="mt-4 type-caption2 text-white/40">Estimación orientativa a partir de la foto.</p>
    </motion.div>
  );
};

const ProgressPhotos = ({ userId, onGoScan }: Props) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signed, setSigned] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null);
  const [showScan, setShowScan] = useState(false);
  useEffect(() => { setShowScan(false); }, [viewingPhoto]);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [comparing, setComparing] = useState(false);
  const [refreshAt, setRefreshAt] = useState(0);
  /** Fotos cuya imagen falló al cargar: se muestra un hueco compuesto, nunca la imagen rota del navegador. */
  const [broken, setBroken] = useState<Set<string>>(new Set());
  /** Fotos con el primer reintento de firmado en curso: mientras dura no se dice "no disponible". */
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef(true);
  const requestIdRef = useRef(0);
  const photosRef = useRef<Photo[]>([]);
  const refreshAtRef = useRef(0);
  const lastRefreshAttemptRef = useRef(0);
  /** Evita bucles de reintento sobre la misma URL rota. */
  const retriedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const loadPhotos = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from("progress_photos")
        .select(`
          id,
          photo_url,
          note,
          taken_at,
          created_at,
          scan_history_id
        `)
        .eq("user_id", userId)
        .order("taken_at", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!activeRef.current || requestId !== requestIdRef.current) return;

      const list = (data as any[]) || [];
      
      // Cargar los datos del scan si hay ID (solo para nueva funcionalidad)
      const photosWithScan = await Promise.all(list.map(async (photo) => {
        if (photo.scan_history_id) {
          try {
            const { data: scan } = await supabase
              .from("scan_history")
              .select("id, result, attractiveness, potential, physique, style")
              .eq("id", photo.scan_history_id)
              .maybeSingle();
            return { ...photo, scan };
          } catch (scanError) {
            console.warn("Failed to load scan for photo", photo.id, scanError);
            return { ...photo, scan: null };
          }
        }
        return { ...photo, scan: null };
      }));
      
      const batch = await signedUrlsWithExpiry(BUCKET, list.map((p) => p.photo_url));
      if (!activeRef.current || requestId !== requestIdRef.current) return;

      retriedRef.current.clear();
      lastRefreshAttemptRef.current = Date.now();
      setPhotos(photosWithScan as Photo[]);
      setSigned(batch.urls);
      setBroken(new Set());
      refreshAtRef.current = batch.refreshAtMs;
      setRefreshAt(batch.refreshAtMs);
    } catch (error) {
      if (!activeRef.current || requestId !== requestIdRef.current) return;
      console.error("Failed to load progress photos", error);
      setLoadError(true);
      toast.error("No se pudieron cargar tus fotos de progreso. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      if (activeRef.current && requestId === requestIdRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  /** Renueva las firmas sin tocar el estado de carga (fallo silencioso). */
  const refreshSigned = useCallback(async () => {
    const list = photosRef.current;
    if (!list.length) return;
    lastRefreshAttemptRef.current = Date.now();
    try {
      const batch = await signedUrlsWithExpiry(BUCKET, list.map((p) => p.photo_url));
      if (!activeRef.current) return;
      if (batch.urls.size > 0) {
        // Merge: si alguna firma falla mantenemos la anterior en lugar de
        // vaciar el grid, y el `onError` de la imagen reintenta puntualmente.
        setSigned((prev) => {
          const next = new Map(prev);
          batch.urls.forEach((url, key) => next.set(key, url));
          return next;
        });
        retriedRef.current.clear();
        setBroken(new Set());
      }
      const nextRefresh = batch.urls.size > 0 ? batch.refreshAtMs : Date.now() + SIGN_RETRY_MS;
      refreshAtRef.current = nextRefresh;
      setRefreshAt(nextRefresh);
    } catch (error) {
      console.error("Failed to refresh signed progress photo URLs", error);
    }
  }, []);

  // Renovación programada antes de que caduquen las firmas (TTL 3600 s).
  useEffect(() => {
    if (!refreshAt) return;
    const delay = Math.max(15_000, refreshAt - Date.now());
    const timer = window.setTimeout(() => {
      void refreshSigned();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [refreshAt, refreshSigned]);

  // Los temporizadores se estrangulan en pestañas en segundo plano: al volver
  // el foco o la visibilidad renovamos si ya tocaba o si la firma está vieja.
  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState === "hidden") return;
      if (!photosRef.current.length) return;
      const now = Date.now();
      const due = refreshAtRef.current > 0 && now >= refreshAtRef.current;
      const stale = now - lastRefreshAttemptRef.current >= SIGN_STALE_MS;
      if (due || stale) void refreshSigned();
    };
    document.addEventListener("visibilitychange", maybeRefresh);
    window.addEventListener("focus", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", maybeRefresh);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [refreshSigned]);

  /** Reintenta el firmado de una sola foto cuando su <img loading="lazy" decoding="async"> falla. */
  const handleImageError = useCallback(async (photo: Photo) => {
    const key = photo.photo_url;
    if (!key || retriedRef.current.has(key)) return;
    retriedRef.current.add(key);
    try {
      const batch = await signedUrlsWithExpiry(BUCKET, [key]);
      if (!activeRef.current) return;
      const url = batch.urls.get(key);
      if (!url) return;
      setSigned((prev) => new Map(prev).set(key, url));
      setBroken((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } catch (error) {
      console.error("Failed to re-sign a progress photo URL", error);
    }
  }, []);

  const onImageError = (photo: Photo) => {
    const key = photo.photo_url;
    const firstFailure = !retriedRef.current.has(key);
    setBroken((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    if (firstFailure) setRetrying((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    void handleImageError(photo).finally(() => {
      if (!firstFailure) return;
      setRetrying((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    });
  };

  /** Etiqueta del hueco de una foto que falló: neutra mientras se reintenta, "no disponible" solo cuando ya no hay más intentos. */
  const failedLabel = (key: string, pending?: string) => (retrying.has(key) ? pending : "Foto no disponible");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let uploadedCount = 0;
    const skipped: string[] = [];
    const failures: string[] = [];
    try {
      for (const file of Array.from(files)) {
        // Un fichero inválido no debe abortar el resto del lote.
        const ext = ALLOWED_IMAGE_TYPES[file.type.toLowerCase()];
        if (!ext) {
          skipped.push(file.name);
          continue;
        }
        if (file.size > MAX_PHOTO_BYTES) {
          skipped.push(file.name);
          continue;
        }
        try {
          const optimizedFile = await compressImage(file, { maxDimension: 1600, quality: 0.82 });
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(path, optimizedFile, { upsert: false });
          if (uploadError) throw uploadError;

          // Guardamos la RUTA (no una URL pública: el bucket es privado).
          // storageSign acepta rutas y también las URLs antiguas.
          const { error: insertError } = await supabase.from("progress_photos").insert({
            user_id: userId,
            photo_url: path,
            taken_at: toLocalDateString(),
          });
          if (insertError) {
            const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([path]);
            if (cleanupError) {
              console.error("Failed to clean up a progress photo after its record could not be saved", cleanupError);
              throw new Error(`${insertError.message} No se pudo limpiar el archivo temporal.`);
            }
            throw insertError;
          }
          uploadedCount++;
        } catch (error) {
          console.error("Failed to upload a progress photo", error);
          const detail = error instanceof Error ? error.message : "Comprueba la conexión e inténtalo de nuevo.";
          failures.push(`${file.name}: ${detail}`);
        }
      }

      if (skipped.length > 0) {
        toast.warning(
          skipped.length === 1
            ? `Se omitió 1 archivo: solo se admiten imágenes JPG, PNG, WebP o HEIC de menos de 10 MB (${skipped[0]}).`
            : `Se omitieron ${skipped.length} archivos: solo se admiten imágenes JPG, PNG, WebP o HEIC de menos de 10 MB.`
        );
      }
      if (uploadedCount > 0) {
        toast.success(uploadedCount === 1 ? "Foto subida correctamente" : `${uploadedCount} fotos subidas correctamente`);
      }
      if (failures.length > 0) {
        toast.error(
          failures.length === 1
            ? `No se pudo subir la foto. ${failures[0]}`
            : `No se pudieron subir ${failures.length} fotos. ${failures[0]}`
        );
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (uploadedCount > 0) void loadPhotos();
    }
  };

  const handleDelete = async (photo: Photo) => {
    setDeleting(true);
    const path = storagePathFor(BUCKET, photo.photo_url);
    try {
      // 1) Borramos primero el objeto del bucket privado. Si falla, la fila se
      //    queda y el usuario puede reintentar: nunca damos por borrada una
      //    foto cuyo archivo sigue almacenado.
      if (path) {
        const { error: removeFileError } = await supabase.storage.from(BUCKET).remove([path]);
        if (removeFileError) {
          console.error("Failed to delete the stored progress photo file", removeFileError);
          toast.error("No se pudo eliminar el archivo de la foto. Inténtalo de nuevo.");
          return;
        }
      }

      // 2) Solo cuando el archivo ya no existe quitamos el registro.
      const { error: deleteRecordError } = await supabase
        .from("progress_photos")
        .delete()
        .eq("id", photo.id);
      if (deleteRecordError) {
        console.error("Progress photo file removed but its record could not be deleted", deleteRecordError);
        toast.error("La foto ya no está almacenada, pero no se pudo quitar de tu progreso. Vuelve a intentarlo.");
        return;
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setSigned((prev) => {
        const next = new Map(prev);
        next.delete(photo.photo_url);
        return next;
      });
      setPhotoToDelete(null);
      setViewingPhoto(null);
      toast.success("Foto eliminada");
    } catch (error) {
      console.error("Failed to delete progress photo", error);
      toast.error("No se pudo eliminar la foto. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setDeleting(false);
    }
  };

  // Visor: Escape cierra y las flechas navegan entre fotos.
  useEffect(() => {
    if (viewingPhoto === null || photoToDelete) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewingPhoto(null);
      else if (event.key === "ArrowLeft") setViewingPhoto((i) => (i === null ? i : Math.max(0, i - 1)));
      else if (event.key === "ArrowRight") {
        setViewingPhoto((i) => (i === null ? i : Math.min(photosRef.current.length - 1, i + 1)));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewingPhoto, photoToDelete]);

  const formatDate = (d: string) => {
    return new Date(d + "T00:00:00").toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Group by month
  const grouped = photos.reduce<Record<string, Photo[]>>((acc, p) => {
    const key = p.taken_at.slice(0, 7); // YYYY-MM
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  };

  const shortDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });

  // Antes y ahora del mismo ángulo que abre la comparación (frente si hay dos, si no espalda).
  const frontPhotos = photos.filter((p) => photoPose(p.note) === "front");
  const backPhotos = photos.filter((p) => photoPose(p.note) === "back");
  const posePhotos = frontPhotos.length >= 2 ? frontPhotos : backPhotos.length >= 2 ? backPhotos : [];
  const heroAfter = posePhotos[0];
  const heroBefore = posePhotos[posePhotos.length - 1];
  const ready = !loading && !loadError;

  const openCompare = () => {
    void hapticTap();
    setComparing(true);
  };

  const heroPhoto = (photo: Photo, caption: string) => {
    const url = signed.get(photo.photo_url);
    return (
      <span className="block min-w-0">
        <span className="block aspect-[3/4] overflow-hidden rounded-xl bg-secondary">
          {url && !broken.has(photo.photo_url) ? (
            <img
              src={url}
              alt={`${caption}: foto del ${formatDate(photo.taken_at)}`}
              decoding="async"
              onError={() => onImageError(photo)}
              className="h-full w-full object-cover"
            />
          ) : (
            <PhotoPlaceholder label={url ? failedLabel(photo.photo_url) : undefined} />
          )}
        </span>
        <span className="mt-2 block type-headline">{caption}</span>
        <span className="block type-footnote text-muted-foreground tabular-nums">{formatDate(photo.taken_at)}</span>
      </span>
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-5xl space-y-8">
      {loading && (
        <div className="grid grid-cols-3 gap-2" role="status" aria-label="Cargando fotos de progreso">
          {[0, 1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="aspect-[3/4] rounded-[10px]" />)}
        </div>
      )}

      {loadError && (
        <div role="alert">
          <EmptyState
            icon={WifiOff}
            title="No se han podido cargar tus fotos"
            description="Tus fotos no se han modificado."
            className="min-h-[55dvh]"
            action={
              <Button
                type="button"
                variant="plain"
                onClick={() => {
                  void hapticTap();
                  void loadPhotos();
                }}
              >
                Reintentar
              </Button>
            }
          />
        </div>
      )}

      {/* Empty state */}
      {ready && photos.length === 0 && (
        <EmptyState
          icon={Camera}
          title="Empieza a documentar tu progreso"
          description="Tus fotos se guardan solas cada vez que haces un análisis físico en Scan."
          className="min-h-[55dvh]"
          action={
            onGoScan ? (
              <Button
                size="lg"
                onClick={() => {
                  void hapticTap();
                  onGoScan();
                }}
              >
                Hacer mi primer scan
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Protagonista: el antes y el ahora del mismo ángulo */}
      {ready && heroBefore && heroAfter && heroBefore.id !== heroAfter.id && (
        <section aria-labelledby="progress-photos-evolution">
          <h2 id="progress-photos-evolution" className="type-title2">
            {heroBefore.taken_at === heroAfter.taken_at ? "Tu evolución" : evolutionLabel(heroBefore.taken_at, heroAfter.taken_at)}
          </h2>
          <button
            type="button"
            onClick={openCompare}
            aria-label="Abrir comparación"
            className="mt-4 grid w-full grid-cols-2 lg:grid-cols-2 lg:max-w-xl gap-3 text-left transition-opacity duration-150 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {heroPhoto(heroBefore, "Antes")}
            {heroPhoto(heroAfter, "Ahora")}
          </button>
          <Button size="lg" className="mt-6 w-full" onClick={openCompare}>
            Comparar antes y después
          </Button>
        </section>
      )}

      {/* Aún no hay dos fotos del mismo ángulo: aviso con el patrón de la bienvenida */}
      {ready && photos.length > 0 && posePhotos.length < 2 && (
        <section className="flex items-start gap-3.5 rounded-2xl bg-card p-4">
          <IconTile icon={Columns2} />
          <div className="min-w-0 flex-1">
            <h2 className="type-headline">Compara tu evolución</h2>
            <p className="mt-1 type-subhead text-muted-foreground">
              Con dos scans del mismo ángulo verás el antes y el después lado a lado.
            </p>
            {onGoScan && (
              <Button
                variant="plain"
                className="-ml-4 mt-0.5"
                onClick={() => {
                  void hapticTap();
                  onGoScan();
                }}
              >
                Hacer un scan
              </Button>
            )}
          </div>
        </section>
      )}

      {comparing && photos.length >= 2 && (
        <BeforeAfterCompare photos={photos} signed={signed} onClose={() => setComparing(false)} />
      )}

      {/* Photo grid by month */}
      {ready && Object.entries(grouped).map(([month, monthPhotos]) => (
        <section key={month}>
          <h3 className="mb-3 type-headline first-letter:uppercase">{monthLabel(month)}</h3>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6">
            {monthPhotos.map((photo) => {
              const photoUrl = signed.get(photo.photo_url);
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    setViewingPhoto(photos.indexOf(photo));
                  }}
                  aria-label={`Progreso: ver foto del ${formatDate(photo.taken_at)}`}
                  className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-secondary transition-opacity duration-150 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {photoUrl && !broken.has(photo.photo_url) ? (
                    <img
                      src={photoUrl}
                      alt={`Foto de progreso del ${formatDate(photo.taken_at)}`}
                      loading="lazy"
                      decoding="async"
                      onError={() => onImageError(photo)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <PhotoPlaceholder label={photoUrl ? failedLabel(photo.photo_url) : undefined} />
                  )}
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-1.5 py-0.5 type-caption2 font-medium tabular-nums text-white backdrop-blur-md">
                    {shortDate(photo.taken_at)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* Lightbox */}
      <AnimatePresence>
        {viewingPhoto !== null && photos[viewingPhoto] && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Foto de progreso del ${formatDate(photos[viewingPhoto].taken_at)}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
            onClick={() => setViewingPhoto(null)}
          >
            <div className="absolute right-[max(1rem,var(--safe-right))] top-[max(1rem,var(--safe-top))] z-10 flex gap-2">
              {photos[viewingPhoto].scan && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ver análisis"
                  aria-pressed={showScan}
                  onClick={(e) => {
                    e.stopPropagation();
                    void hapticTap();
                    setShowScan((v) => !v);
                  }}
                  className={showScan ? "bg-primary text-primary-foreground backdrop-blur-md" : "bg-white/15 text-white backdrop-blur-md active:bg-white/25"}
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Eliminar foto"
                onClick={(e) => {
                  e.stopPropagation();
                  void hapticTap();
                  setPhotoToDelete(photos[viewingPhoto]);
                }}
                className="bg-white/15 text-destructive backdrop-blur-md active:bg-white/25"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar visor"
                onClick={() => {
                  void hapticTap();
                  setViewingPhoto(null);
                }}
                className="bg-white/15 text-white backdrop-blur-md active:bg-white/25"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {viewingPhoto > 0 && (
              <button
                type="button"
                aria-label="Foto anterior"
                onClick={(e) => { e.stopPropagation(); void hapticTap(); setViewingPhoto(viewingPhoto - 1); }}
                className="absolute left-[max(1rem,var(--safe-left))] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors active:bg-white/25"
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
              </button>
            )}

            {viewingPhoto < photos.length - 1 && (
              <button
                type="button"
                aria-label="Foto siguiente"
                onClick={(e) => { e.stopPropagation(); void hapticTap(); setViewingPhoto(viewingPhoto + 1); }}
                className="absolute right-[max(1rem,var(--safe-right))] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors active:bg-white/25"
              >
                <ChevronRight className="h-6 w-6" strokeWidth={1.75} />
              </button>
            )}

            <div className="flex max-h-[85dvh] max-w-lg flex-col items-center" onClick={(e) => e.stopPropagation()}>
              {signed.get(photos[viewingPhoto].photo_url) && !broken.has(photos[viewingPhoto].photo_url) ? (
                <img loading="lazy" decoding="async"
                  src={signed.get(photos[viewingPhoto].photo_url)}
                  alt={`Foto de progreso del ${formatDate(photos[viewingPhoto].taken_at)}`}
                  onError={() => onImageError(photos[viewingPhoto])}
                  className="max-h-[75dvh] rounded-xl object-contain"
                />
              ) : (
                <div className="flex h-[60dvh] w-[80vw] max-w-lg items-center justify-center overflow-hidden rounded-xl bg-secondary">
                  <PhotoPlaceholder label={signed.get(photos[viewingPhoto].photo_url) ? failedLabel(photos[viewingPhoto].photo_url, "Preparando la foto…") : "Preparando la foto…"} />
                </div>
              )}
              <p className="mt-3 type-subhead text-white/70">
                {formatDate(photos[viewingPhoto].taken_at)}
              </p>
            </div>

            <AnimatePresence>
              {showScan && photos[viewingPhoto].scan && (
                <ScanSummaryCard
                  scan={photos[viewingPhoto].scan!}
                  onClose={() => setShowScan(false)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog
        open={photoToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPhotoToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará de tu progreso y no se podrá recuperar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={deleting}
              onClick={(e) => {
                // Mantenemos el diálogo abierto hasta confirmar el borrado real,
                // para poder reintentar si el archivo no se pudo eliminar.
                e.preventDefault();
                if (photoToDelete) void handleDelete(photoToDelete);
              }}
            >
              {deleting ? "Eliminando…" : "Eliminar foto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
};

export default ProgressPhotos;
