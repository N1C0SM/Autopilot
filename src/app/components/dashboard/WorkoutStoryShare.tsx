import { useEffect, useMemo, useState } from "react";
import { Share, Download } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { hapticSelection, hapticTap, isNative, shareFileOrImage } from "@/shared/lib/native";
import { toast } from "sonner";
import { bodyRegions, regionMuscles, smoothPath } from "@/app/components/dashboard/MuscleMapFigure";
import { INK, INK_TEXT, SHARE_MUSCLE } from "@/shared/lib/palette";
import { groupedInt, muscleLine, sessionHighlight } from "@/shared/lib/workoutSummaryFormat";
import { STORY, workoutStoryStats } from "@/shared/lib/shareStory";
import {
  centerText, createStoryCanvas, drawBackdrop, drawCapsule, drawHeroFigure, drawPhoto, drawSignature, drawStats,
  exportStory, loadStoryFonts, loadStoryImage,
} from "@/shared/lib/storyCanvas";

interface Props {
  /** Imagen que se comparte. Si se indica, no se muestra el selector. */
  variant?: Variant;
  title: string;
  date: string;
  volumeKg: number;
  sets: number;
  exercises: number;
  records: string[];
  muscles: string[];
  muscleSetCounts?: Record<string, number>;
  previousVolumeKg?: number;
  /** Foto real de un ejercicio hecho (la del primero con series hechas); sin ella, el mapa muscular. */
  photo?: string | null;
  /** Duración real de la sesión (sin pausas), para la cifra de apoyo «Minutos». */
  durationMs?: number | null;
}

type Variant = "resumen" | "musculos";

const W = STORY.width;
const fmt = groupedInt;

/**
 * Mapa muscular de la sesión (frente y espalda), el mismo cuerpo vectorial que la app y solo en
 * el dorado de la marca: 3 series o más, dorado; menos, dorado tenue (como `MuscleBodyFigure`).
 */
function drawFigure(ctx: CanvasRenderingContext2D, side: "front" | "back", p: Props, x: number, y: number, scale: number) {
  const owner = regionMuscles(p.muscles);
  const counts = p.muscleSetCounts || {};
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  const regions = bodyRegions(side).flatMap((region) => region.svgPoints.map((points) => ({ muscle: owner.get(region.muscle), path: new Path2D(smoothPath(points)) })));
  // Silueta continua bajo las zonas, como en la app.
  ctx.fillStyle = INK.line; ctx.strokeStyle = INK.line; ctx.lineWidth = 3.2; ctx.lineJoin = "round";
  for (const r of regions) { ctx.fill(r.path); ctx.stroke(r.path); }
  for (const r of regions) {
    const n = r.muscle ? counts[r.muscle] || 1 : 0;
    ctx.shadowColor = r.muscle ? SHARE_MUSCLE.glow : "transparent";
    ctx.shadowBlur = r.muscle ? 6 : 0;
    ctx.fillStyle = !r.muscle ? SHARE_MUSCLE.none : n >= 3 ? SHARE_MUSCLE.strong : SHARE_MUSCLE.light;
    ctx.fill(r.path);
  }
  ctx.restore();
}

/** Las dos figuras arriba, centradas en la zona del visual (el cuerpo vectorial mide 100 × 200). */
function drawFigures(ctx: CanvasRenderingContext2D, p: Props) {
  const scale = STORY.figureHeight / 200;
  const width = 100 * scale;
  drawFigure(ctx, "front", p, W / 2 - width - STORY.figureGap / 2, STORY.figureTop, scale);
  drawFigure(ctx, "back", p, W / 2 + STORY.figureGap / 2, STORY.figureTop, scale);
}

/** Volumen de hoy, o las series si la sesión es de peso corporal: nunca «0 kg». */
function heroFigure(p: Props): { label: string; value: string; unit: string } {
  if (p.volumeKg > 0) return { label: "Volumen total", value: fmt(p.volumeKg), unit: "kg" };
  return { label: "Series completadas", value: fmt(p.sets), unit: p.sets === 1 ? "serie" : "series" };
}

function muscleSubtitle(p: Props) {
  return muscleLine(p.muscles, p.muscleSetCounts) || "Sesión completada";
}

/**
 * Historia del entreno (1080 × 1920), igual que `WorkoutShareCard` en la app: arriba la foto real
 * de un ejercicio hecho fundida a negro (o, sin foto o en «Músculos», el mapa muscular en dorado);
 * debajo la fecha, el nombre de la sesión y sus músculos, una sola cifra protagonista en Big
 * Shoulders, el logro en dorado (solo si sube), dos o tres cifras de apoyo y el AP con
 * autopilotplan.com al pie, todo dentro de los márgenes seguros de las historias.
 */
export function drawWorkoutStory(ctx: CanvasRenderingContext2D, p: Props, variant: Variant, photo: HTMLImageElement | null) {
  drawBackdrop(ctx);
  if (variant === "resumen" && photo) drawPhoto(ctx, photo);
  else drawFigures(ctx, p);

  centerText(ctx, `Completado · ${p.date}`, STORY.eyebrow, 500, 36, 26, INK_TEXT.secondary);
  centerText(ctx, p.title || "Sesión de hoy", STORY.title, 800, 76, 48, INK_TEXT.primary);
  centerText(ctx, muscleSubtitle(p), STORY.subtitle, 500, 38, 28, INK_TEXT.secondary);

  const hero = heroFigure(p);
  centerText(ctx, hero.label, STORY.heroLabel, 600, 32, 26, INK_TEXT.secondary);
  drawHeroFigure(ctx, hero.value, hero.unit, STORY.hero, STORY.heroSize);

  const highlight = sessionHighlight(p);
  if (highlight) drawCapsule(ctx, highlight, STORY.highlight);

  drawStats(ctx, workoutStoryStats(p));
  drawSignature(ctx);
}

export async function renderStory(p: Props, variant: Variant, photo?: HTMLImageElement | null): Promise<Blob> {
  await loadStoryFonts();
  const draw = async (img: HTMLImageElement | null) => {
    const { canvas, ctx } = createStoryCanvas();
    drawWorkoutStory(ctx, p, variant, img);
    return exportStory(canvas);
  };
  try {
    return await draw(photo ?? null);
  } catch (error) {
    // Una foto sin permiso de CORS «mancha» el lienzo: se repite sin ella (con el mapa muscular).
    if (photo) return await draw(null);
    throw error;
  }
}

export function WorkoutStoryShare(props: Props) {
  const [busy, setBusy] = useState(false);
  const [chosenVariant, setActiveVariant] = useState<Variant>("resumen");
  const activeVariant = props.variant ?? chosenVariant;
  // La foto y las fuentes se piden al abrir el resumen: al tocar «Compartir» ya están listas.
  const photoReady = useMemo(() => loadStoryImage(props.photo), [props.photo]);
  useEffect(() => { void loadStoryFonts(); }, []);

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Texto enriquecido para compartir por WhatsApp / mensajes
  const shareText = () => {
    const lines: string[] = [];
    if (props.records.length) lines.push(`Nuevo récord: ${props.records[0]}`);
    if (props.volumeKg > 0) lines.push(`Volumen total: ${fmt(props.volumeKg)} kg`);
    lines.push(`${props.sets} ${props.sets === 1 ? "serie" : "series"} · ${props.exercises} ${props.exercises === 1 ? "ejercicio" : "ejercicios"}`);
    if (props.muscles.length) lines.push(props.muscles.slice(0, 3).join(", "));
    lines.push("Autopilot — autopilotplan.com");
    return lines.join("\n");
  };

  const run = async (mode: "share" | "download") => {
    if (busy) return;

    setBusy(true);

    try {
      const filename = `autopilot-entreno-${activeVariant}-${Date.now()}.png`;
      const blob = await renderStory(props, activeVariant, await photoReady);

      if (mode === "download") {
        download(blob, filename);
        toast.success("Imagen descargada");
        setBusy(false);
        return;
      }

      // Desbloquear el botón ANTES de abrir el menú nativo
      // El menú nativo de iOS/Android puede tardar en resolverse o no resolverse nunca
      setBusy(false);

      // Compartir en background (fire-and-forget)
      shareFileOrImage({
        blob,
        filename,
        title: props.title || "Mi entrenamiento en Autopilot",
        text: shareText(),
      }).then(res => {
        if (res.shared) {
          toast.success("Compartido");
        } else if (res.downloaded) {
          toast.success("Imagen descargada");
        }
      }).catch((e: unknown) => {
        const name = (e as Error)?.name || "";
        const msg = (e as Error)?.message || "";

        if (name !== "AbortError" && !msg.toLowerCase().includes("cancel")) {
          toast.error("No se pudo compartir");
        }
      });

    } catch {
      toast.error("No se pudo crear la imagen. Inténtalo de nuevo.");
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {/* Control segmentado: qué imagen se comparte (solo si no la decide la página del resumen). */}
      {!props.variant && <div className="grid h-11 grid-cols-2 rounded-full bg-card p-1" role="radiogroup" aria-label="Imagen para compartir">
        {(["resumen", "musculos"] as Variant[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={activeVariant === v}
            onClick={() => { void hapticSelection(); setActiveVariant(v); }}
            className={`rounded-full type-footnote font-semibold transition-colors duration-200 ${
              activeVariant === v ? "btn-raised text-foreground" : "text-muted-foreground"
            }`}
          >
            {v === "resumen" ? "Resumen" : "Músculos"}
          </button>
        ))}
      </div>}

      {/* Una sola acción principal. En la app, la hoja de compartir ya incluye «Guardar imagen». */}
      <div className="flex w-full min-w-0 gap-2">
        <Button
          type="button"
          size="lg"
          disabled={busy}
          onClick={() => { void hapticTap(); void run("share"); }}
          className="min-w-0 flex-1 px-4"
        >
          {busy
            ? <Spinner size="sm" label="Creando imagen" className="text-primary-foreground [&>svg]:!size-full" />
            : <Share aria-hidden="true" />}
          <span className="truncate">Compartir</span>
        </Button>
        {!isNative() && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={busy}
            onClick={() => { void hapticTap(); void run("download"); }}
            className="w-[50px] shrink-0 px-0"
            aria-label="Descargar imagen"
          >
            <Download aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
