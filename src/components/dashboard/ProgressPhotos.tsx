import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Plus, Trash2, X, ChevronLeft, ChevronRight, RefreshCw, Columns2 } from "lucide-react";
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
import { signedUrlsFor } from "@/lib/storageSign";
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

const ProgressPhotos = ({ userId }: Props) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signed, setSigned] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [comparing, setComparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from("progress_photos")
        .select("*")
        .eq("user_id", userId)
        .order("taken_at", { ascending: false });
      if (error) throw error;
      const list = (data as Photo[]) || [];
      const map = await signedUrlsFor("progress-photos", list.map((p) => p.photo_url));
      setPhotos(list);
      setSigned(map);
    } catch (error) {
      console.error("Failed to load progress photos", error);
      setLoadError(true);
      toast.error("No se pudieron cargar tus fotos de progreso. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let uploadedCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          throw new Error("Selecciona solo archivos de imagen.");
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error("Cada foto debe ocupar menos de 10 MB.");
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("progress-photos")
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("progress-photos")
          .getPublicUrl(path);

        const { error: insertError } = await supabase.from("progress_photos").insert({
          user_id: userId,
          photo_url: urlData.publicUrl,
          taken_at: toLocalDateString(),
        });
        if (insertError) {
          const { error: cleanupError } = await supabase.storage.from("progress-photos").remove([path]);
          if (cleanupError) {
            console.error("Failed to clean up a progress photo after its record could not be saved", cleanupError);
            throw new Error(`${insertError.message} No se pudo limpiar el archivo temporal.`);
          }
          throw insertError;
        }
        uploadedCount++;
      }
      toast.success(uploadedCount === 1 ? "Foto subida correctamente 📸" : `${uploadedCount} fotos subidas correctamente 📸`);
    } catch (error) {
      console.error("Failed to upload progress photos", error);
      const detail = error instanceof Error ? error.message : "Comprueba la conexión e inténtalo de nuevo.";
      toast.error(uploadedCount > 0
        ? `Se subieron ${uploadedCount} fotos, pero no se pudieron guardar todas. ${detail}`
        : `No se pudo subir la foto. ${detail}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (uploadedCount > 0) void loadPhotos();
    }
  };

  const handleDelete = async (photo: Photo) => {
    try {
      const { error: deleteRecordError } = await supabase
        .from("progress_photos")
        .delete()
        .eq("id", photo.id);
      if (deleteRecordError) throw deleteRecordError;

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setViewingPhoto(null);
      toast.success("Foto eliminada");

      const pathMatch = photo.photo_url.match(/progress-photos\/(.+)$/);
      if (pathMatch) {
        const { error: removeFileError } = await supabase.storage.from("progress-photos").remove([pathMatch[1]]);
        if (removeFileError) {
          console.error("Progress photo record deleted but its storage file could not be removed", removeFileError);
          toast.error("La foto se quitó de tu progreso, pero no se pudo borrar el archivo almacenado.");
        }
      }
    } catch (error) {
      console.error("Failed to delete progress photo", error);
      toast.error("No se pudo eliminar la foto. Comprueba la conexión e inténtalo de nuevo.");
    }
  };

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
            {monthPhotos.map((photo, i) => (
              <motion.button
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setViewingPhoto(photos.indexOf(photo))}
                className="aspect-[3/4] rounded-xl overflow-hidden border border-border hover:border-primary/40 transition-all group relative"
              >
                <img
                  src={signed.get(photo.photo_url) || ""}
                  alt={`Progreso ${formatDate(photo.taken_at)}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <span className="text-[10px] text-white font-medium">{formatDate(photo.taken_at)}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      ))}

      {/* Lightbox */}
      <AnimatePresence>
        {viewingPhoto !== null && photos[viewingPhoto] && (
          <motion.div
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
                className="text-white/70 hover:text-destructive hover:bg-white/10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewingPhoto(null)}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {viewingPhoto > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setViewingPhoto(viewingPhoto - 1); }}
                className="absolute left-4 text-white/70 hover:text-white p-2"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            {viewingPhoto < photos.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setViewingPhoto(viewingPhoto + 1); }}
                className="absolute right-4 text-white/70 hover:text-white p-2"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}

            <div className="max-w-lg max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={signed.get(photos[viewingPhoto].photo_url) || ""}
                alt=""
                className="max-h-[75vh] rounded-xl object-contain"
              />
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (photoToDelete) void handleDelete(photoToDelete);
                setPhotoToDelete(null);
              }}
            >
              Eliminar foto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProgressPhotos;
