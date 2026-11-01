import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Sparkles, Upload, Trophy, ImageOff, CheckCircle2, TrendingUp, MessageSquare, type LucideIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { Spinner } from "@/shared/components/ui/spinner";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { toast } from "sonner";
import { signedUrlsFor, signedUrlFor, storagePathFor } from "@/shared/lib/storageSign";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";

interface Props {
  userId: string;
  email: string;
}

interface PhotoRow {
  id: string;
  photo_url: string;
  taken_at: string;
}

interface Comparison {
  similarity: number;
  feedback: string;
  strengths: string;
  gaps: string;
  congratulate: boolean;
}

const BUCKET = "progress-photos";
const MAX_GOAL_BYTES = 8 * 1024 * 1024;

/** Tipos MIME admitidos -> extensión normalizada (evita extensiones arbitrarias). */
const ALLOWED_GOAL_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const UserGoalPanel = ({ userId, email }: Props) => {
  const [loading, setLoading] = useState(true);
  const [goalUrl, setGoalUrl] = useState<string | null>(null);
  const [latestPhoto, setLatestPhoto] = useState<PhotoRow | null>(null);
  const [allPhotos, setAllPhotos] = useState<PhotoRow[]>([]);
  const [signed, setSigned] = useState<Map<string, string>>(new Map());
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setComparison(null);
      try {
        const [onboardingResult, photosResult] = await Promise.all([
          supabase.from("onboarding").select("goal_photo_url").eq("user_id", userId).maybeSingle(),
          supabase.from("progress_photos").select("id, photo_url, taken_at")
            .eq("user_id", userId).order("taken_at", { ascending: false }).limit(10),
        ]);
        if (!active) return;
        if (onboardingResult.error) throw onboardingResult.error;
        if (photosResult.error) throw photosResult.error;

        const onb = onboardingResult.data;
        const list = (photosResult.data as PhotoRow[]) || [];
        setGoalUrl((onb?.goal_photo_url as string | null) || null);
        setAllPhotos(list);
        setLatestPhoto(list[0] || null);
        const urls: string[] = list.map((p) => p.photo_url);
        if (onb?.goal_photo_url) urls.push(onb.goal_photo_url as string);
        const map = await signedUrlsFor(BUCKET, urls);
        if (!active) return;
        setSigned(map);
      } catch (error) {
        if (!active) return;
        console.error("Failed to load goal panel data", error);
        toast.error("No se pudo cargar el objetivo. Inténtalo de nuevo en unos segundos.");
      } finally {
        // Nunca dejamos el spinner infinito si una query falla.
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [userId]);

  const runComparison = async () => {
    if (!goalUrl || !latestPhoto) {
      toast.error("Faltan fotos para comparar");
      return;
    }
    setComparing(true);
    setComparison(null);
    try {
      const [signedGoal, signedCurrent] = await Promise.all([
        signedUrlFor(BUCKET, goalUrl),
        signedUrlFor(BUCKET, latestPhoto.photo_url),
      ]);
      if (!signedGoal || !signedCurrent) throw new Error("No se pudieron firmar las imágenes");
      const { data, error } = await supabase.functions.invoke("compare-goal-photo", {
        body: { goal_url: signedGoal, current_url: signedCurrent },
      });
      if (error || !data || data.error) throw new Error(error?.message || data?.error || "Error IA");
      setComparison(data as Comparison);
      if (data.congratulate) toast.success(`Similitud del ${data.similarity} %: muy cerca del objetivo`);
    } catch (e) {
      toast.error("Error al comparar: " + (e instanceof Error ? e.message : "Inténtalo de nuevo."));
    }
    setComparing(false);
  };

  const handleUploadGoal = async (file: File) => {
    const ext = ALLOWED_GOAL_TYPES[file.type.toLowerCase()];
    if (!ext) {
      toast.error("Formato no válido. Sube una imagen JPG, PNG, WebP o HEIC.");
      return;
    }
    if (file.size > MAX_GOAL_BYTES) { toast.error("Máx 8MB"); return; }
    setUploading(true);
    const path = `${userId}/goal-${Date.now()}.${ext}`;
    try {
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      // Guardamos la RUTA: el bucket es privado y una URL firmada caduca.
      const { error: updErr } = await supabase.from("onboarding").update({ goal_photo_url: path }).eq("user_id", userId);
      if (updErr) {
        // Si no se pudo guardar la referencia, no dejamos el archivo huérfano.
        const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([path]);
        if (cleanupError) {
          console.error("Failed to clean up the goal photo after its record could not be saved", cleanupError);
        }
        throw updErr;
      }
      const signedGoal = await signedUrlFor(BUCKET, path);
      setGoalUrl(path);
      if (signedGoal) setSigned((prev) => new Map(prev).set(path, signedGoal));
      setComparison(null);
      toast.success("Foto objetivo actualizada");
    } catch (e) {
      toast.error("Error: " + (e instanceof Error ? e.message : "Inténtalo de nuevo."));
    }
    setUploading(false);
  };

  const handleRemoveGoal = async () => {
    setRemoving(true);
    try {
      // 1) Borramos primero el archivo del bucket privado.
      const path = storagePathFor(BUCKET, goalUrl);
      if (path) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove([path]);
        if (removeError) {
          console.error("Failed to delete the goal photo file", removeError);
          toast.error("No se pudo borrar la foto objetivo. Inténtalo de nuevo.");
          return;
        }
      }
      // 2) Solo cuando el archivo ya no existe quitamos la referencia.
      const { error } = await supabase.from("onboarding").update({ goal_photo_url: null }).eq("user_id", userId);
      if (error) {
        console.error("Goal photo file deleted but its record could not be cleared", error);
        toast.error("La foto ya no está almacenada, pero no se pudo quitar el objetivo. Vuelve a intentarlo.");
        return;
      }
      setGoalUrl(null);
      setComparison(null);
      toast.success("Objetivo eliminado");
    } catch (e) {
      console.error("Failed to remove the goal photo", e);
      toast.error("Error al quitar objetivo");
    } finally {
      setRemoving(false);
    }
  };

  // Evitamos `src=""` (petición a la propia página) mientras no haya firma.
  const goalSignedUrl = goalUrl ? signed.get(goalUrl) : undefined;
  const latestSignedUrl = latestPhoto ? signed.get(latestPhoto.photo_url) : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" className="text-primary" label="Cargando objetivo" />
      </div>
    );
  }

  const takenAt = (photo: PhotoRow, options: Intl.DateTimeFormatOptions) =>
    new Date(photo.taken_at + "T00:00:00").toLocaleDateString("es-ES", options);

  return (
    <div className="space-y-8">
      <p className="type-subhead text-muted-foreground">Toda su rutina y su nutrición se orientan hacia esta meta visual.</p>

      {/* Objetivo y estado actual, lado a lado */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <figure className="min-w-0 space-y-2">
          <figcaption className="px-1 type-footnote text-muted-foreground">Objetivo</figcaption>
          {goalUrl ? (
            <PhotoFrame src={goalSignedUrl} alt="Físico objetivo" pendingText="Preparando la foto objetivo…" />
          ) : (
            <label className={cn("flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center rounded-media bg-card p-4 text-center transition-colors duration-150 active:bg-accent", uploading && "pointer-events-none")}>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadGoal(e.target.files[0])} />
              {uploading ? (
                <Spinner size="lg" className="text-primary" label="Subiendo" />
              ) : (
                <>
                  <Upload className="h-7 w-7 text-primary" strokeWidth={1.75} />
                  <span className="mt-3 type-headline">Subir foto objetivo</span>
                  <span className="mt-1 type-footnote text-muted-foreground">JPG o PNG · máx. 8 MB</span>
                </>
              )}
            </label>
          )}
          {goalUrl && (
            <div className="flex items-center gap-4 px-1">
              <label className="inline-flex min-h-11 cursor-pointer items-center type-subhead text-primary transition-opacity active:opacity-60">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadGoal(e.target.files[0])} />
                {uploading ? "Subiendo…" : "Cambiar"}
              </label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button type="button" className="min-h-11 type-subhead text-destructive transition-opacity active:opacity-60 disabled:opacity-40" disabled={removing} onPointerDown={() => void hapticTap()}>
                    Quitar
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar objetivo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se quitará la foto objetivo de {email}. Podrás subir otra después.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction destructive onClick={handleRemoveGoal}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </figure>

        <figure className="min-w-0 space-y-2">
          <figcaption className="truncate px-1 type-footnote text-muted-foreground">
            Última foto{latestPhoto ? ` · ${takenAt(latestPhoto, { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </figcaption>
          {latestPhoto ? (
            <PhotoFrame src={latestSignedUrl} alt="Estado actual" pendingText="Preparando la última foto…" />
          ) : (
            <div className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-media bg-card p-4 text-center">
              <ImageOff className="h-7 w-7 text-muted-foreground" strokeWidth={1.75} />
              <p className="mt-3 type-footnote text-muted-foreground">Aún no ha subido fotos de progreso</p>
            </div>
          )}
        </figure>
      </div>

      {/* Análisis con IA: la cifra de similitud es la protagonista */}
      <section className="space-y-4">
        <div className="flex items-start gap-4">
          <Sparkles className="mt-0.5 h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <h3 className="type-headline">Cercanía al objetivo</h3>
            <p className="mt-0.5 type-subhead text-muted-foreground">
              {!goalUrl
                ? "Sube una foto objetivo para empezar."
                : !latestPhoto
                  ? "Pídele al usuario que suba al menos una foto de progreso."
                  : "Compara su última foto con el objetivo."}
            </p>
            <Button
              variant="plain"
              size="sm"
              className="-ml-3.5 mt-1"
              onClick={() => { void hapticTap(); void runComparison(); }}
              disabled={comparing || !goalUrl || !latestPhoto}
            >
              {comparing ? <><Spinner size="sm" className="text-primary" label="Analizando" /> Analizando…</> : "Comparar con IA"}
            </Button>
          </div>
        </div>

        {comparison && (
          <div className="space-y-6">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="type-subhead text-muted-foreground">Similitud con el objetivo</span>
                <span className={cn("font-rounded text-[34px] font-bold leading-[41px] tabular-nums", comparison.congratulate ? "text-primary" : "text-foreground")}>
                  {comparison.similarity}
                  <span className="ml-0.5 type-title3 text-muted-foreground">%</span>
                </span>
              </div>
              <Progress value={comparison.similarity} className="mt-2" />
            </div>

            {comparison.congratulate && (
              <Insight icon={Trophy} title="Muy cerca del objetivo" tint>
                El usuario está muy cerca del objetivo. Plantéale renovarlo.
              </Insight>
            )}
            <Insight icon={CheckCircle2} title="Ya conseguido">{comparison.strengths}</Insight>
            <Insight icon={TrendingUp} title="A mejorar">{comparison.gaps}</Insight>
            <Insight icon={MessageSquare} title="Valoración">{comparison.feedback}</Insight>
          </div>
        )}
      </section>

      {/* Evolución de fotos */}
      {allPhotos.length > 0 && (
        <section className="space-y-3">
          <SectionHeader size="sm" title="Evolución reciente" hint={`${allPhotos.length} ${allPhotos.length === 1 ? "foto" : "fotos"}`} />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {allPhotos.map((p) => (
              <figure key={p.id} className="min-w-0 space-y-1">
                <PhotoFrame src={signed.get(p.photo_url)} alt="" cover />
                <figcaption className="px-0.5 type-caption1 text-muted-foreground tabular-nums">{takenAt(p, { day: "numeric", month: "short" })}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

/** Foto en un hueco 3:4 con respaldo compuesto si aún no hay URL firmada o la carga falla. */
const PhotoFrame = ({ src, alt, pendingText, cover }: { src?: string; alt: string; pendingText?: string; cover?: boolean }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return (
    <div className={cn("flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-card", cover ? "rounded-media" : "rounded-media")}>
      {src && !failed ? (
        <img
          loading="lazy"
          decoding="async"
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className={cn("h-full w-full", cover ? "object-cover" : "object-contain")}
        />
      ) : (
        <div className="flex flex-col items-center p-4 text-center">
          <ImageOff className={cn("text-muted-foreground", cover ? "h-5 w-5" : "h-7 w-7")} strokeWidth={1.75} aria-hidden="true" />
          {pendingText && !failed ? <p className="mt-3 type-footnote text-muted-foreground">{pendingText}</p> : null}
        </div>
      )}
    </div>
  );
};

const Insight = ({ icon: Icon, title, tint, children }: { icon: LucideIcon; title: string; tint?: boolean; children: ReactNode }) => (
  <div className="flex items-start gap-4">
    <Icon className={cn("mt-0.5 h-6 w-6 shrink-0", tint ? "text-primary" : "text-muted-foreground")} strokeWidth={1.75} aria-hidden="true" />
    <div className="min-w-0">
      <p className="type-headline">{title}</p>
      <p className="mt-0.5 break-words type-subhead text-muted-foreground">{children}</p>
    </div>
  </div>
);

export default UserGoalPanel;
