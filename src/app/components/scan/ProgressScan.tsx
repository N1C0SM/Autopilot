import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock, PersonStanding, Plus, Quote, Ruler, Sparkles, Sun, Target, X } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import { useAuth } from "@/shared/contexts/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { compressImage, toBrowserFriendlyImage } from "@/shared/lib/imageCompression";
import { formatDecimal } from "@/shared/lib/numberFormat";
import { toLocalDateString } from "@/shared/lib/localDates";
import { recordAcquisitionEvent } from "@/shared/lib/acquisition";
import { hapticTap } from "@/shared/lib/native";
import { scanErrorMessage } from "@/shared/lib/scanErrors";
import { cn } from "@/shared/lib/utils";
import ScanPlusCard from "./ScanPlusCard";
import ScanAnalyzing from "./ScanAnalyzing";
import { useScanProgress } from "@/shared/hooks/useScanProgress";

/**
 * Progreso → Scan con cuenta: calcado de la app (`ScanView.swift`), que es la referencia.
 * Mismas piezas y en el mismo orden: fotos de delante y de atrás, «Tu objetivo», «Cómo tomar
 * las fotos» y «Analizar mi físico»; y el mismo resultado, con el detalle de Plus. El scan
 * público de la landing (`pages/Scan.tsx`) sigue siendo el embudo para visitantes.
 */

type Improvement = { label?: string; priority?: string };
type MuscleScore = { group: string; score: number; verdict?: string };
export type ScanResult = {
  physique?: number;
  potential?: number;
  attractiveness?: number;
  style?: number;
  similarity?: number;
  months_with_plan?: number;
  months_without_plan?: number;
  estimated_months?: number;
  summary?: string;
  improvements?: Improvement[];
  basic?: boolean;
  locked_sections?: string[];
  body_composition?: {
    body_fat_pct?: number; lean_mass_kg?: number; weight_kg?: number;
    somatotype?: string; frame_size?: string; fat_distribution?: string;
  };
  muscle_breakdown?: MuscleScore[];
  posture?: { issues?: string[]; severity?: string; note?: string };
  proportions?: {
    shoulder_to_waist_ratio?: number; v_taper_score?: number; symmetry_score?: number;
    upper_lower_balance?: string; weakest_link?: string;
  };
  genetic_markers?: string[];
  protocol?: {
    training_days_per_week?: number; weekly_sets_priority?: number; calorie_adjustment_kcal?: number;
    protein_g_per_kg?: number; cardio_minutes_per_week?: number; key_lifts?: string[]; avoid?: string[];
  };
};

const GOALS: Record<string, string> = {
  lose_weight: "Perder peso",
  gain_muscle: "Ganar músculo",
  improve_endurance: "Mejorar resistencia",
};

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const whole = (n: number) => Math.round(n).toLocaleString("es-ES");

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
  const [bio, setBio] = useState<{ height?: number; weight?: number; age?: number; gender?: string }>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  // El anillo llega al 100 % antes de enseñar el resultado.
  const [finishing, setFinishing] = useState(false);
  const progress = useScanProgress(analyzing, finishing);

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
        setGoal(GOALS[data.goal ?? ""] ?? "");
      });
  }, [user]);

  const pick = async (file: File, isFront: boolean) => {
    try {
      const url = await toDataUrl(file);
      (isFront ? setFront : setBack)(url);
    } catch {
      setError("No se pudo abrir esa foto. Prueba con otra.");
    }
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
    setAnalyzing(true);
    setError(null);
    setWarning(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("analyze-physique", {
        body: {
          currentImage: front, backImage: back, objectiveImage: null,
          height_cm: bio.height, weight_kg: bio.weight, age: bio.age, gender: bio.gender,
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(String(data.error));
      const r = data as ScanResult;
      void recordAcquisitionEvent("scan");
      // Igual que la app: fotos al bucket privado, resultado a scan_history y fotos a «Físico».
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
      setFinishing(true);
      await new Promise((done) => setTimeout(done, reduceMotion ? 0 : 600));
      setResult(r);
    } catch (e) {
      setError(await scanErrorMessage(e));
    } finally {
      setAnalyzing(false);
      setFinishing(false);
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

  return (
    <AnimatePresence mode="wait" initial={false}>
      {result ? (
        <motion.div key="result" initial={enter} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }} className="flex flex-col gap-[18px]">
          <ScanResultView result={result} onAgain={reset} />
          {warning && <p className="type-footnote text-destructive">{warning}</p>}
        </motion.div>
      ) : analyzing ? (
        <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}>
          <ScanAnalyzing progress={progress} />
        </motion.div>
      ) : (
        <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }} className="flex flex-col gap-[18px]">
          <header className="flex flex-col gap-1">
            <p className="type-caption2 font-bold tracking-[0.15em] text-primary">AI SCAN</p>
            <h2 className="type-title1">Tu análisis corporal</h2>
            <p className="type-subhead text-muted-foreground">
              Sube una foto frontal (y otra de espalda si quieres) y la IA valora tu físico y tu potencial.
            </p>
          </header>

          <div className="grid grid-cols-2 gap-3">
            <PhotoTile title="Delante" hint="Cuerpo completo" badge="Obligatoria" image={front} onFile={(f) => pick(f, true)} />
            <PhotoTile title="Atrás" hint="Opcional" badge="Opcional" image={back} onFile={(f) => pick(f, false)} />
          </div>

          <div className="flex items-start gap-3.5 rounded-media bg-card p-[18px]">
            <IconTile icon={Target} size="md" />
            <div className="flex flex-col gap-0.5">
              <p className="type-headline">Tu objetivo</p>
              <p className="type-subhead text-muted-foreground">{goal || "Sin definir"}</p>
              <p className="type-footnote text-muted-foreground">Se usa para personalizar el análisis.</p>
            </div>
          </div>

          <div className="rounded-media bg-card p-[18px]">
            <h3 className="type-title3 mb-2">Cómo tomar las fotos</h3>
            <TipRow icon={Ruler} title="Distancia" text="Cámara a 2-3 m, a la altura del ombligo, cuerpo entero y móvil en vertical." />
            <TipRow icon={Sun} title="Luz y fondo" text="Luz natural frontal y uniforme, sin contraluz ni flash, con fondo liso y claro." />
            <TipRow icon={PersonStanding} title="Postura y ropa" text="Ropa ajustada, pies a la anchura de los hombros y brazos relajados. Para la de atrás, date la vuelta sin moverte." />
          </div>

          <Button size="lg" className="h-14 w-full" disabled={!front && !back} onClick={() => void analyze()}>
            Analizar mi físico
          </Button>
          {error && <p className="type-footnote text-destructive">{error}</p>}
          <p className="type-footnote text-muted-foreground">
            Con una sola foto ya podemos analizarte: valoraremos solo lo que se vea en esa vista. Con las dos fotos el análisis es más completo.
          </p>
          <p className="flex items-center gap-1.5 type-footnote text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
            Privado: solo para tu análisis · Sin registro · Menos de 1 minuto
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PhotoTile({ title, hint, badge, image, onFile }: {
  title: string; hint: string; badge: string; image: string | null; onFile: (f: File) => void;
}) {
  return (
    <label className="relative block h-[240px] cursor-pointer overflow-hidden rounded-[28px] bg-card transition-transform duration-150 active:scale-[0.98]">
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={image ? `${title} elegida. Pulsa para cambiarla` : `${title}, ${hint}, ${badge}. Pulsa para elegir foto`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <span aria-hidden="true" className="absolute inset-0 rounded-[28px] border-[1.5px] border-dashed border-primary/35" />
          <PersonStanding aria-hidden="true" strokeWidth={0.75}
            className="absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 text-foreground/[0.06]" />
          {/* Todo centrado: cruz, título y pista. */}
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <span className="flex h-[54px] w-[54px] items-center justify-center rounded-[16px] bg-primary/15 text-primary">
              <Plus className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
            </span>
            <span className="type-headline">{title}</span>
            <span className="type-subhead text-muted-foreground">{hint}</span>
          </span>
        </>
      )}
      <span className={cn("absolute right-2.5 top-2.5 rounded-full bg-black/45 px-[9px] py-1 type-caption2 font-semibold",
        badge === "Opcional" ? "text-muted-foreground" : "text-primary")}>{badge}</span>
      {image && (
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/60 px-3 py-[7px] type-footnote font-semibold backdrop-blur-xl">
          Cambiar foto
        </span>
      )}
    </label>
  );
}

function TipRow({ icon: Icon, title, text }: { icon: typeof Ruler; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 py-[7px]">
      <span aria-hidden="true" className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-chip bg-primary/15 text-primary">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
      <div className="flex flex-col gap-px">
        <p className="type-subhead font-semibold">{title}</p>
        <p className="type-footnote text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

/* ===== Resultado: el mismo que `ScanResultView` de la app ===== */

const score = (v?: number) => (v == null ? "—" : formatDecimal(v, 1));

function FigureTile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-media bg-card p-4">
      <p className="truncate type-footnote text-muted-foreground">{label}</p>
      <p className={cn("truncate font-rounded text-[28px] font-bold leading-tight tabular-nums", accent ? "text-primary" : "text-foreground")}>{value}</p>
      {hint && <p className="truncate type-footnote text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Block({ title, trailing, children }: { title: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="type-headline">{title}</h3>
        {trailing}
      </div>
      {children}
    </section>
  );
}

function Meter({ label, value, pct, strong, note }: { label: string; value: string; pct: number; strong: boolean; note?: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="type-subhead font-semibold">{label}</p>
        <p className={cn("type-subhead font-semibold tabular-nums", strong ? "text-primary" : "text-foreground")}>{value}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div className={cn("h-full rounded-full", strong ? "bg-primary" : "bg-foreground/40")}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      {note && <p className="type-footnote text-muted-foreground">{note}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <p className="type-subhead">{label}</p>
      <p className="text-right type-subhead text-muted-foreground tabular-nums">{value}</p>
    </div>
  );
}

const Panel = ({ children }: { children: ReactNode }) => <div className="rounded-media bg-card px-[18px] py-2.5">{children}</div>;

export function ScanResultView({ result, onAgain }: { result: ScanResult; onAgain: () => void }) {
  const bc = result.body_composition;
  const pr = result.proportions;
  const po = result.posture;
  const pc = result.protocol;
  const groups = result.muscle_breakdown ?? [];
  const hasDetail = !!(bc || groups.length || pr || po?.issues?.length || po?.note || result.genetic_markers?.length || pc);
  return (
    <div className="flex flex-col gap-[18px]">
      <section className="rounded-[28px] bg-card p-5"
        aria-label={`Físico: ${result.physique == null ? "sin datos" : `${formatDecimal(result.physique, 1)} sobre 10`}`}>
        <div className="flex items-start justify-between gap-3" aria-hidden="true">
          <div className="flex flex-col gap-0.5">
            <p className="type-caption2 font-bold tracking-[0.15em] text-primary">AI SCAN</p>
            <p className="type-title3">Tu físico</p>
          </div>
          <IconTile icon={Sparkles} size="md" />
        </div>
        <p className="mt-2.5 flex items-baseline gap-1" aria-hidden="true">
          <span className="font-rounded text-[64px] font-bold leading-none tracking-tight tabular-nums">{score(result.physique)}</span>
          {result.physique != null && <span className="type-title3 text-muted-foreground">/10</span>}
        </p>
        <p className="mt-1 type-footnote text-muted-foreground" aria-hidden="true">
          {result.physique == null ? "Sin puntuación global" : "Puntuación global de tu físico"}
        </p>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <FigureTile label="Atractivo" value={score(result.attractiveness)} hint={result.attractiveness == null ? undefined : "/10"} />
        <FigureTile label="Potencial" value={score(result.potential)} hint={result.potential == null ? undefined : "/10"} accent />
        <FigureTile label="Estilo" value={score(result.style)} hint={result.style == null ? undefined : "/10"} />
      </div>

      {result.summary && (
        <div className="flex items-start gap-3 rounded-media bg-card p-[18px]">
          <Quote className="mt-1 h-4 w-4 shrink-0 fill-primary text-primary" aria-hidden="true" />
          <p className="type-body">{result.summary}</p>
        </div>
      )}

      {!!result.improvements?.length && (
        <section className="flex flex-col gap-2.5">
          <h3 className="type-title3">Qué mejorar</h3>
          {result.improvements.map((item, i) => (
            <div key={i} className="flex items-start gap-3 rounded-media bg-card p-4"
              aria-label={`Mejora ${i + 1}: ${item.label ?? ""}. Prioridad ${item.priority ?? "sin definir"}`}>
              <span aria-hidden="true" className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-primary type-subhead font-bold tabular-nums text-primary-foreground">
                {i + 1}
              </span>
              <div className="flex flex-col items-start gap-[3px]" aria-hidden="true">
                {item.label && <p className="type-headline">{item.label}</p>}
                {item.priority && (
                  <span className="rounded-full bg-primary/15 px-2 py-[3px] type-caption2 font-semibold text-primary">
                    Prioridad {item.priority.toLowerCase()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {hasDetail && (
        <section className="flex flex-col gap-[18px]">
          <header className="flex flex-col gap-1">
            <h3 className="type-title3">Lectura estimada por IA</h3>
            <p className="type-footnote text-muted-foreground">Es una estimación visual, no un diagnóstico médico.</p>
          </header>

          {bc && (
            <Block title="Composición corporal estimada">
              <div className="grid grid-cols-3 gap-3">
                {bc.body_fat_pct != null && <FigureTile label="Grasa" value={formatDecimal(bc.body_fat_pct, 1)} hint="%" accent />}
                {bc.lean_mass_kg != null && <FigureTile label="Masa magra" value={formatDecimal(bc.lean_mass_kg, 1)} hint="kg" />}
                {bc.weight_kg != null && <FigureTile label="Peso est." value={formatDecimal(bc.weight_kg, 1)} hint="kg" />}
              </div>
              {(bc.somatotype || bc.frame_size || bc.fat_distribution) && (
                <Panel>
                  {bc.somatotype && <InfoRow label="Somatotipo" value={sentence(bc.somatotype)} />}
                  {bc.frame_size && <InfoRow label="Estructura" value={sentence(bc.frame_size)} />}
                  {bc.fat_distribution && <InfoRow label="Distribución de grasa" value={sentence(bc.fat_distribution)} />}
                </Panel>
              )}
            </Block>
          )}

          {groups.length > 0 && (
            <Block title="Lectura por grupo muscular">
              <Panel>
                {groups.map((m, i) => (
                  <Meter key={i} label={m.group} value={`${formatDecimal(m.score, 1)}/10`} pct={m.score * 10} strong={m.score >= 7} note={m.verdict || undefined} />
                ))}
              </Panel>
            </Block>
          )}

          {pr && (
            <Block title="Proporciones y simetría">
              <Panel>
                {pr.shoulder_to_waist_ratio != null && (
                  <Meter label="Ratio hombro/cintura" value={formatDecimal(pr.shoulder_to_waist_ratio, 2)}
                    pct={(pr.shoulder_to_waist_ratio / 1.8) * 100} strong={pr.shoulder_to_waist_ratio >= 1.5} note="Ideal ~1,60" />
                )}
                {pr.v_taper_score != null && <Meter label="V-taper" value={`${formatDecimal(pr.v_taper_score, 1)}/10`} pct={pr.v_taper_score * 10} strong={pr.v_taper_score >= 7} />}
                {pr.symmetry_score != null && <Meter label="Simetría" value={`${formatDecimal(pr.symmetry_score, 1)}/10`} pct={pr.symmetry_score * 10} strong={pr.symmetry_score >= 7} />}
                {pr.upper_lower_balance && <InfoRow label="Balance" value={sentence(pr.upper_lower_balance)} />}
                {pr.weakest_link && <InfoRow label="Eslabón más débil" value={sentence(pr.weakest_link)} />}
              </Panel>
            </Block>
          )}

          {po && (po.issues?.length || po.note) && (
            <Block title="Postura" trailing={po.severity && (
              <span className={cn("type-subhead font-semibold",
                po.severity === "severa" ? "text-destructive" : po.severity === "moderada" ? "text-primary" : "text-muted-foreground")}>
                {sentence(po.severity)}
              </span>
            )}>
              <Panel>
                {po.issues?.map((issue, i) => <p key={i} className="py-2 type-subhead">{sentence(issue)}</p>)}
                {po.note && <p className="py-2 type-footnote text-muted-foreground">{po.note}</p>}
              </Panel>
            </Block>
          )}

          {!!result.genetic_markers?.length && (
            <Block title="Rasgos visuales que juegan a tu favor (o en contra)">
              <Panel>
                {result.genetic_markers.map((g, i) => <p key={i} className="py-2 type-subhead">{sentence(g)}</p>)}
              </Panel>
              <p className="type-footnote text-muted-foreground">Señales observadas en tus fotos: no es un estudio genético.</p>
            </Block>
          )}

          {pc && (
            <Block title="Protocolo recomendado por la IA">
              <Panel>
                {pc.training_days_per_week != null && <InfoRow label="Días de entreno por semana" value={whole(pc.training_days_per_week)} />}
                {pc.weekly_sets_priority != null && <InfoRow label="Series del grupo prioritario" value={whole(pc.weekly_sets_priority)} />}
                {pc.protein_g_per_kg != null && <InfoRow label="Proteína por kg" value={`${formatDecimal(pc.protein_g_per_kg, 1)} g`} />}
                {pc.calorie_adjustment_kcal != null && (
                  <InfoRow label="Calorías frente a mantenimiento" value={`${pc.calorie_adjustment_kcal > 0 ? "+" : ""}${whole(pc.calorie_adjustment_kcal)} kcal`} />
                )}
                {pc.cardio_minutes_per_week != null && <InfoRow label="Cardio por semana" value={`${whole(pc.cardio_minutes_per_week)} min`} />}
              </Panel>
              {!!pc.key_lifts?.length && (
                <div className="flex flex-col gap-2">
                  <p className="type-subhead font-semibold">Ejercicios clave</p>
                  <div className="flex flex-wrap gap-2">
                    {pc.key_lifts.map((l, i) => <span key={i} className="rounded-full bg-card px-3 py-1.5 type-subhead">{l}</span>)}
                  </div>
                </div>
              )}
              {!!pc.avoid?.length && (
                <div className="flex flex-col gap-1">
                  <p className="type-subhead font-semibold">Evita</p>
                  {pc.avoid.map((a, i) => (
                    <p key={i} className="flex items-start gap-2.5 py-1 type-subhead text-muted-foreground">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                      {a}
                    </p>
                  ))}
                </div>
              )}
            </Block>
          )}
        </section>
      )}

      {result.basic && <ScanPlusCard sections={result.locked_sections} />}

      <Button variant="secondary" size="lg" className="w-full" onClick={() => { void hapticTap(); onAgain(); }}>
        Hacer otro scan
      </Button>
    </div>
  );
}
