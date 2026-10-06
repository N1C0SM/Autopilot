import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Plus, Trash2, X, ChevronLeft, ChevronRight, RefreshCw, Columns2, ImageOff } from "lucide-react";
import BeforeAfterCompare from "./BeforeAfterCompare";
import { Button } from "@/components/ui/button";
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

interface Photo {
  id: string;
  photo_url: string;
  note: string;
  taken_at: string;
  created_at: string;
}

interface Props {
  userId: string;
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
const PhotoPlaceholder = ({ label = "Cargando foto..." }: { label?: string }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-secondary/60 text-muted-foreground">
    <ImageOff className="h-5 w-5" aria-hidden="true" />
    <span className="px-1 text-center text-[10px] leading-tight">{label}</span>
  </div>
);

const ProgressPhotos = ({ userId }: Props) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signed, setSigned] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [comparing, setComparing] = useState(false);
  const [refreshAt, setRefreshAt] = useState(0);
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
        .select("*")
        .eq("user_id", userId)
        .order("taken_at", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!activeRef.current || requestId !== requestIdRef.current) return;

      const list = (data as Photo[]) || [];
      const batch = await signedUrlsWithExpiry(BUCKET, list.map((p) => p.photo_url));
      if (!activeRef.current || requestId !== requestIdRef.current) return;

      retriedRef.current.clear();
      lastRefreshAttemptRef.current = Date.now();
      setPhotos(list);
      setSigned(batch.urls);
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

  /** Reintenta el firmado de una sola foto cuando su <img> falla. */
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
    } catch (error) {
      console.error("Failed to re-sign a progress photo URL", error);
    }
  }, []);

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
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { upsert: false });
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
        toast.success(uploadedCount === 1 ? "Foto subida correctamente 📸" : `${uploadedCount} fotos subidas correctamente 📸`);
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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold font-display">Fotos de Progreso</h2>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Plus className="w-4 h-4" />
          <span className="ml-1">{uploading ? "Subiendo..." : "Añadir foto"}</span>
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {loading && (
        <div className="grid grid-cols-3 gap-2" aria-label="Cargando fotos de progreso">
          {[0, 1, 2].map((item) => <div key={item} className="aspect-[3/4] animate-pulse rounded-xl bg-secondary/70" />)}
        </div>
      )}

      {loadError && (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-5 text-center">
          <p className="text-sm font-semibold">No se han podido cargar tus fotos</p>
          <p className="mt-1 text-xs text-muted-foreground">Tus fotos no se han modificado.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void loadPhotos()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Reintentar
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !loadError && photos.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex min-h-[55dvh] flex-col items-center justify-center rounded-[1.75rem] border border-border bg-card p-10 text-center"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Camera className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-display font-bold text-lg mb-1">Empieza a documentar tu progreso</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Sube fotos semanales para ver tu evolución. Frente, lateral y espalda.
          </p>
          <Button variant="hero" className="rounded-2xl active:scale-[0.98]" onClick={() => fileRef.current?.click()}>
            <Camera className="w-4 h-4 mr-1" /> Subir primera foto
          </Button>
        </motion.div>
      )}

      {!loading && !loadError && photos.length >= 2 && (
        <Button variant="outline" className="w-full" onClick={() => setComparing(true)}>
          <Columns2 className="w-4 h-4 mr-1" /> Comparar Antes / Después
        </Button>
      )}
      {comparing && photos.length >= 2 && (
        <BeforeAfterCompare photos={photos} signed={signed} onClose={() => setComparing(false)} />
      )}

      {/* Photo grid by month */}
      {!loading && !loadError && Object.entries(grouped).map(([month, monthPhotos]) => (
        <div key={month}>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 capitalize">
            {monthLabel(month)}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {monthPhotos.map((photo, i) => {
              const photoUrl = signed.get(photo.photo_url);
              return (
                <motion.button
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setViewingPhoto(photos.indexOf(photo))}
                  aria-label={`Progreso: ver foto del ${formatDate(photo.taken_at)}`}
                  className="aspect-[3/4] rounded-xl overflow-hidden border border-border hover:border-primary/40 transition-all group relative"
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={`Foto de progreso del ${formatDate(photo.taken_at)}`}
                      loading="lazy"
                      decoding="async"
                      onError={() => void handleImageError(photo)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <PhotoPlaceholder />
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <span className="text-[10px] text-white font-medium">{formatDate(photo.taken_at)}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
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
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setViewingPhoto(null)}
          >
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Eliminar foto"
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoToDelete(photos[viewingPhoto]);
                }}
                className="h-11 w-11 text-white/70 hover:text-destructive hover:bg-white/10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar visor"
                onClick={() => setViewingPhoto(null)}
                className="h-11 w-11 text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {viewingPhoto > 0 && (
              <button
                type="button"
                aria-label="Foto anterior"
                onClick={(e) => { e.stopPropagation(); setViewingPhoto(viewingPhoto - 1); }}
                className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            {viewingPhoto < photos.length - 1 && (
              <button
                type="button"
                aria-label="Foto siguiente"
                onClick={(e) => { e.stopPropagation(); setViewingPhoto(viewingPhoto + 1); }}
                className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}

            <div className="max-w-lg max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              {signed.get(photos[viewingPhoto].photo_url) ? (
                <img
                  src={signed.get(photos[viewingPhoto].photo_url)}
                  alt={`Foto de progreso del ${formatDate(photos[viewingPhoto].taken_at)}`}
                  onError={() => void handleImageError(photos[viewingPhoto])}
                  className="max-h-[75vh] rounded-xl object-contain"
                />
              ) : (
                <div className="flex h-[60vh] w-[80vw] max-w-lg items-center justify-center overflow-hidden rounded-xl bg-white/5">
                  <PhotoPlaceholder label="Preparando la foto..." />
                </div>
              )}
              <p className="text-white/70 text-sm mt-3">
                {formatDate(photos[viewingPhoto].taken_at)}
              </p>
            </div>
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
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                // Mantenemos el diálogo abierto hasta confirmar el borrado real,
                // para poder reintentar si el archivo no se pudo eliminar.
                e.preventDefault();
                if (photoToDelete) void handleDelete(photoToDelete);
              }}
            >
              {deleting ? "Eliminando..." : "Eliminar foto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProgressPhotos;
