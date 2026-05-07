import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Target, Sparkles, Trash2, Upload, Loader2, Trophy, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

const UserGoalPanel = ({ userId, email }: Props) => {
  const [loading, setLoading] = useState(true);
  const [goalUrl, setGoalUrl] = useState<string | null>(null);
  const [latestPhoto, setLatestPhoto] = useState<PhotoRow | null>(null);
  const [allPhotos, setAllPhotos] = useState<PhotoRow[]>([]);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setComparison(null);
      const [{ data: onb }, { data: photos }] = await Promise.all([
        supabase.from("onboarding").select("goal_photo_url").eq("user_id", userId).maybeSingle(),
        supabase.from("progress_photos").select("id, photo_url, taken_at")
          .eq("user_id", userId).order("taken_at", { ascending: false }).limit(10),
      ]);
      setGoalUrl((onb?.goal_photo_url as string | null) || null);
      const list = (photos as PhotoRow[]) || [];
      setAllPhotos(list);
      setLatestPhoto(list[0] || null);
      setLoading(false);
    };
    load();
  }, [userId]);

  const runComparison = async () => {
    if (!goalUrl || !latestPhoto) {
      toast.error("Faltan fotos para comparar");
      return;
    }
    setComparing(true);
    setComparison(null);
    try {
      const { data, error } = await supabase.functions.invoke("compare-goal-photo", {
        body: { goal_url: goalUrl, current_url: latestPhoto.photo_url },
      });
      if (error || !data || data.error) throw new Error(error?.message || data?.error || "Error IA");
      setComparison(data as Comparison);
      if (data.congratulate) toast.success(`🎉 ¡${data.similarity}%! Muy cerca del objetivo`);
    } catch (e: any) {
      toast.error("Error al comparar: " + e.message);
    }
    setComparing(false);
  };

  const handleUploadGoal = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) { toast.error("Máx 8MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/goal-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("progress-photos").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("progress-photos").getPublicUrl(path);
      const { error: updErr } = await supabase.from("onboarding").update({ goal_photo_url: pub.publicUrl }).eq("user_id", userId);
      if (updErr) throw updErr;
      setGoalUrl(pub.publicUrl);
      setComparison(null);
      toast.success("Foto objetivo actualizada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
    setUploading(false);
  };

  const handleRemoveGoal = async () => {
    setRemoving(true);
    const { error } = await supabase.from("onboarding").update({ goal_photo_url: null }).eq("user_id", userId);
    if (error) toast.error("Error al quitar objetivo");
    else { setGoalUrl(null); setComparison(null); toast.success("Objetivo eliminado"); }
    setRemoving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold">Físico objetivo</h2>
            <p className="text-xs text-muted-foreground">Toda su rutina y nutrición se orienta hacia esta meta visual.</p>
          </div>
        </div>
      </div>

      {/* Goal vs current side by side */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Goal */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-primary">🎯 Objetivo</span>
            {goalUrl && (
              <div className="flex gap-1">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadGoal(e.target.files[0])} />
                  <span className="text-[10px] px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Cambiar
                  </span>
                </label>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-[10px] px-2 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1" disabled={removing}>
                      <Trash2 className="w-3 h-3" /> Quitar
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
                      <AlertDialogAction onClick={handleRemoveGoal} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
          <div className="aspect-[3/4] bg-secondary/30 flex items-center justify-center">
            {goalUrl ? (
              <img src={goalUrl} alt="Físico objetivo" className="w-full h-full object-contain" />
            ) : (
              <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-center p-6">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadGoal(e.target.files[0])} />
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium">Subir foto objetivo</span>
                    <span className="text-xs text-muted-foreground mt-1">JPG/PNG · máx 8MB</span>
                  </>
                )}
              </label>
            )}
          </div>
        </div>

        {/* Latest progress */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">📷 Última foto</span>
            {latestPhoto && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(latestPhoto.taken_at + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <div className="aspect-[3/4] bg-secondary/30 flex items-center justify-center">
            {latestPhoto ? (
              <img src={latestPhoto.photo_url} alt="Estado actual" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center p-6">
                <ImageOff className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">El usuario aún no ha subido fotos de progreso</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Comparison */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-sm">Análisis IA: cercanía al objetivo</h3>
          </div>
          <Button variant="default" size="sm" onClick={runComparison} disabled={comparing || !goalUrl || !latestPhoto}>
            {comparing ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Analizando...</> : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Comparar con IA</>}
          </Button>
        </div>

        {!goalUrl && (
          <p className="text-xs text-muted-foreground">Sube una foto objetivo para empezar.</p>
        )}
        {goalUrl && !latestPhoto && (
          <p className="text-xs text-muted-foreground">Pídele al usuario que suba al menos una foto de progreso.</p>
        )}

        {comparison && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Similitud con el objetivo</span>
                <span className={`text-2xl font-bold font-display ${comparison.congratulate ? "text-primary" : "text-foreground"}`}>
                  {comparison.similarity}%
                </span>
              </div>
              <Progress value={comparison.similarity} className="h-2" />
            </div>

            {comparison.congratulate && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-start gap-2">
                <Trophy className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-primary mb-0.5">¡Enhorabuena!</div>
                  <div className="text-muted-foreground">El usuario está muy cerca del objetivo. Plantéale renovarlo.</div>
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider font-bold text-primary mb-1">✅ Ya conseguido</div>
                <p className="text-xs text-foreground/90">{comparison.strengths}</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider font-bold text-amber-400 mb-1">⚡ A mejorar</div>
                <p className="text-xs text-foreground/90">{comparison.gaps}</p>
              </div>
            </div>

            <div className="bg-secondary/20 rounded-lg p-3 border border-border">
              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">💬 Feedback</div>
              <p className="text-sm">{comparison.feedback}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Timeline of progress photos */}
      {allPhotos.length > 0 && (
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display font-bold text-sm mb-3">Evolución reciente ({allPhotos.length})</h3>
          <div className="grid grid-cols-5 gap-2">
            {allPhotos.map((p) => (
              <div key={p.id} className="aspect-[3/4] rounded-lg overflow-hidden border border-border relative">
                <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                  <span className="text-[9px] text-white font-medium">
                    {new Date(p.taken_at + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserGoalPanel;
