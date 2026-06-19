import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Plus, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { signedUrlsFor } from "@/lib/storageSign";

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
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPhotos();
  }, [userId]);

  const loadPhotos = async () => {
    const { data } = await supabase
      .from("progress_photos")
      .select("*")
      .eq("user_id", userId)
      .order("taken_at", { ascending: false });
    const list = (data as Photo[]) || [];
    setPhotos(list);
    const map = await signedUrlsFor("progress-photos", list.map((p) => p.photo_url));
    setSigned(map);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("progress-photos")
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("progress-photos")
          .getPublicUrl(path);

        await supabase.from("progress_photos").insert({
          user_id: userId,
          photo_url: urlData.publicUrl,
          taken_at: new Date().toISOString().split("T")[0],
        });
      }
      toast.success("Foto subida correctamente 📸");
      loadPhotos();
    } catch (err: any) {
      toast.error("Error al subir: " + (err.message || ""));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (photo: Photo) => {
    const pathMatch = photo.photo_url.match(/progress-photos\/(.+)$/);
    if (pathMatch) {
      await supabase.storage.from("progress-photos").remove([pathMatch[1]]);
    }
    await supabase.from("progress_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setViewingPhoto(null);
    toast.success("Foto eliminada");
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
    <div className="max-w-2xl mx-auto space-y-6">
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

      {/* Empty state */}
      {!loading && photos.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-2xl p-10 border border-border text-center"
        >
          <div className="text-4xl mb-3">📷</div>
          <h3 className="font-display font-bold text-lg mb-1">Empieza a documentar tu progreso</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Sube fotos semanales para ver tu evolución. Frente, lateral y espalda.
          </p>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Camera className="w-4 h-4 mr-1" /> Subir primera foto
          </Button>
        </motion.div>
      )}

      {/* Photo grid by month */}
      {Object.entries(grouped).map(([month, monthPhotos]) => (
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(photos[viewingPhoto]);
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
    </div>
  );
};

export default ProgressPhotos;
