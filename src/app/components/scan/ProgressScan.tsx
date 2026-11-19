import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Target } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import { useAuth } from "@/shared/contexts/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { compressImage, toBrowserFriendlyImage } from "@/shared/lib/imageCompression";
import { toLocalDateString } from "@/shared/lib/localDates";
import { recordAcquisitionEvent } from "@/shared/lib/acquisition";
import { hapticNotify, hapticTap } from "@/shared/lib/native";
import { scanErrorMessage } from "@/shared/lib/scanErrors";
import { SCAN_REVEAL_MS, type ScanStage } from "@/shared/lib/scanLoading";
import { SCAN_GOAL_LABELS, type ScanResultData } from "@/shared/lib/scanResultFormat";
import ScanAnalyzing from "./ScanAnalyzing";
import ScanResultView from "./ScanResultView";
import { ScanShareButton } from "./ScanShareCard";
import {
  ScanErrorNotice, ScanHeader, ScanObjectivePicker, ScanPhotoTile, ScanPrivacyNote, ScanTips, type ObjectivePreset,
} from "./ScanUploadParts";

/**
 * Progreso → Scan con cuenta: calcado de la app (`ScanView.swift`), que es la referencia.
 * Mismas piezas y en el mismo orden: fotos de delante y de atrás, «Tu objetivo», «Tu físico
 * objetivo», «Cómo tomar las fotos» y «Analizar mi físico»; la misma espera por pasos y el mismo
 * resultado (con el detalle de Plus y «Compartir resumen»). El scan público de la landing
 * (`pages/Scan.tsx`) sigue siendo el embudo para visitantes.
 */

export type ScanResult = ScanResultData;

// HEIC pasa a JPEG y la foto se reduce a 1600 px, como en la app: el servidor reconoce la
// misma foto venga del dispositivo que venga (mismo resultado).
const toDataUrl = async (input: File) => {
  const file = await compressImage(await toBrowserFriendlyImage(input), { maxDimension: 1600, quality: 0.85 });
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
};

export default function ProgressScan({ onScanned }: { onScanned?: () => void }) {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  // Físico objetivo, igual que el Scan público y la app: referencias del admin o foto propia.
  const [presets, setPresets] = useState<ObjectivePreset[]>([]);
  const [objective, setObjective] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [bio, setBio] = useState<{ height?: number; weight?: number; age?: number; gender?: string }>({});
  const [stage, setStage] = useState<ScanStage | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    void supabase.from("goal_physiques").select("id, name, image_url").order("sort_order", { ascending: true })
      .then(({ data }) => setPresets(((data ?? []) as ObjectivePreset[]).filter((p) => /^https?:/i.test(p.image_url ?? ""))));
  }, []);

  useEffect(() => {
    if (!user) return;
    void supabase.from("onboarding").select("height, weight, age, goal, sex").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setBio({
          height: data.height ? Number(data.height) : undefined,
          weight: data.weight ? Number(data.weight) : undefined,
          age: data.age ? Math.trunc(Number(data.age)) : undefined,
          gender: data.sex || undefined,
        });
        // Sin objetivo conocido se deja vacío y la tarjeta dice «Sin definir».
        setGoal(SCAN_GOAL_LABELS[data.goal ?? ""] ?? "");
      });
  }, [user]);

  const pick = async (file: File, isFront: boolean) => {
    try {
      const url = await toDataUrl(file);
      (isFront ? setFront : setBack)(url);
      setError(null);
    } catch {
      setError("No se pudo abrir esa foto. Prueba con otra.");
    }
  };

  const pickObjective = async (file: File) => {
    try {
      setObjective(await toDataUrl(file));
      setPresetId(null);
      setError(null);
    } catch { setError("No se pudo abrir esa foto. Prueba con otra."); }
  };

  const upload = async (dataUrl: string | null, suffix: string, stamp: number) => {
    if (!dataUrl || !user) return null;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${user.id}/scan_${stamp}_${suffix}.jpg`;
      const { error: upErr } = await supabase.storage.from("progress-photos").upload(path, blob, { contentType: "image/jpeg" });
      return upErr ? null : path;
    } catch {
      return null;
    }
  };

  const analyze = async () => {
    if (!user || (!front && !back)) return;
    void hapticTap();
    setStage("analyzing");
    setError(null);
    setWarning(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("analyze-physique", {
        body: {
          currentImage: front, backImage: back, objectiveImage: objective,
          height_cm: bio.height, weight_kg: bio.weight, age: bio.age, gender: bio.gender,
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(String(data.error));
      const r = data as ScanResult;
      void recordAcquisitionEvent("scan");
      // Igual que la app: fotos al bucket privado, resultado a scan_history y fotos a «Físico».
      setStage("saving");
      const stamp = Date.now();
      const [frontPath, backPath] = await Promise.all([upload(front, "front", stamp), upload(back, "back", stamp)]);
      const { data: row, error: insErr } = await supabase.from("scan_history").insert({
        user_id: user.id,
        current_photo_url: frontPath,
        back_photo_url: backPath,
        result: r,
        attractiveness: r.attractiveness ?? null,
        potential: r.potential ?? null,
        physique: r.physique ?? null,
        style: r.style ?? null,
        months_with_plan: r.months_with_plan ?? null,
        emailed_to: user.email ?? null,
      }).select("id").single();
      let photosSaved = true;
      if (!insErr && row?.id) {
        const rows = [[frontPath, "Scan · frente"], [backPath, "Scan · espalda"]]
          .filter((entry): entry is [string, string] => !!entry[0])
          .map(([path, note]) => ({ user_id: user.id, photo_url: path, note, taken_at: toLocalDateString(), scan_history_id: row.id }));
        if (rows.length) {
          const { error: phErr } = await supabase.from("progress_photos").insert(rows);
          if (phErr) photosSaved = false;
          else onScanned?.();
        }
      }
      const photosLost = (!!front && !frontPath) || (!!back && !backPath);
      setWarning(insErr
        ? "El análisis no se pudo guardar en tu historial."
        : (!photosSaved || photosLost) ? "Las fotos no se pudieron guardar en tu historial." : null);
      // Todos los pasos marcados: el último check se ve un instante antes del resultado.
      setStage("done");
      await new Promise((done) => setTimeout(done, reduceMotion ? 0 : SCAN_REVEAL_MS));
      // Como la app: vibración de éxito al enseñar el resultado y de error si falla.
      void hapticNotify("success");
      setResult(r);
    } catch (e) {
      void hapticNotify("error");
      setError(await scanErrorMessage(e));
    } finally {
      setStage(null);
    }
  };

  // Vuelve al formulario limpio: sin fotos ni resultado del scan anterior.
  const reset = () => {
    setResult(null);
    setError(null);
    setWarning(null);
    setFront(null);
    setBack(null);
  };

  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 };
  const photo = front ?? back;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {result ? (
        <motion.div key="result" initial={enter} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }} className="flex flex-col gap-[18px]">
          <ScanResultView result={result} photo={photo} objectivePhoto={objective} />
          <ScanShareButton result={result} />
          <Button variant="secondary" size="lg" className="w-full" onClick={() => { void hapticTap(); reset(); }}>
            Hacer otro scan
          </Button>
          {/* El análisis se muestra aunque el guardado haya fallado, pero se dice. */}
          {warning && <p role="alert" className="type-footnote text-destructive">{warning}</p>}
        </motion.div>
      ) : stage ? (
        <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}>
          <ScanAnalyzing photo={photo} stage={stage} saves />
        </motion.div>
      ) : (
        <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }} className="flex flex-col gap-[18px]">
          <ScanHeader
            title="Análisis físico con IA"
            subtitle="Sube tus fotos y la IA analiza tu físico y tu potencial para personalizar aún más tu plan."
          />

          <div className="grid grid-cols-2 gap-3">
            <ScanPhotoTile title="Foto de delante" hint="Cuerpo completo" badge="Recomendada" image={front} onFile={(f) => pick(f, true)} />
            <ScanPhotoTile title="Foto de atrás" hint="Cuerpo completo" badge="Opcional" image={back} onFile={(f) => pick(f, false)} />
          </div>

          <div className="flex items-center gap-3.5 rounded-card bg-card p-[18px]">
            <IconTile icon={Target} size="md" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="type-headline">Tu objetivo</p>
              <p className="type-subhead text-muted-foreground">{goal || "Sin definir"}</p>
              <p className="type-footnote text-muted-foreground">Se usa para personalizar el análisis.</p>
            </div>
          </div>

          <ScanObjectivePicker
            presets={presets}
            objective={objective}
            presetId={presetId}
            onPick={(f) => void pickObjective(f)}
            onPreset={(p) => { setPresetId(p.id); setObjective(p.image_url); }}
            onClear={() => { setObjective(null); setPresetId(null); }}
          />

          <ScanTips />

          {error && <ScanErrorNotice message={error} />}
          <Button size="lg" className="h-14 w-full" disabled={!front && !back} onClick={() => void analyze()}>
            Analizar mi físico
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
          <p className="type-footnote text-muted-foreground">
            Con una sola foto ya podemos analizarte: valoraremos solo lo que se vea en esa vista. Con las dos fotos el análisis es más completo.
          </p>
          <ScanPrivacyNote text="Privado: solo para tu análisis · Menos de 1 minuto" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
