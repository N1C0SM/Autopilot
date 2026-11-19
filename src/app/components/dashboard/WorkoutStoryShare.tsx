import { useState } from "react";
import { Share, Download } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { hapticSelection, hapticTap, isNative, shareFileOrImage } from "@/shared/lib/native";
import { toast } from "sonner";
import { BRAND_A, BRAND_P, BRAND_VIEWBOX } from "@/shared/components/ui/brand-mark";
import { bodyRegions, regionMuscles, smoothPath } from "@/app/components/dashboard/MuscleMapFigure";
import { BRAND_GOLD, INK, INK_TEXT, MUSCLE_HEAT } from "@/shared/lib/palette";
import { groupedInt, muscleLine, sessionHighlight } from "@/shared/lib/workoutSummaryFormat";

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
}

// Dibuja el mismo cuerpo vectorial que el mapa de la app, coloreado por series.
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
    ctx.shadowColor = r.muscle ? MUSCLE_HEAT.glow : "transparent";
    ctx.shadowBlur = r.muscle ? 6 : 0;
    ctx.fillStyle = !r.muscle ? MUSCLE_HEAT.none : n >= 6 ? MUSCLE_HEAT.high : n >= 3 ? MUSCLE_HEAT.mid : MUSCLE_HEAT.low;
    ctx.fill(r.path);
  }
  ctx.restore();
}

type Variant = "resumen" | "musculos";

const F = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif";
// Cifras con la firma de marca (Big Shoulders, .claude/design/marca.md).
const FIG = `"Big Shoulders", ${F}`;
const fmt = groupedInt;

// Monograma AP de la marca, a lo ancho del cuadro (x, y, size) y centrado en vertical.
export function drawBrandA(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color = BRAND_GOLD) {
  const k = size / BRAND_VIEWBOX.width;
  ctx.save();
  ctx.translate(x, y + (size - BRAND_VIEWBOX.height * k) / 2); ctx.scale(k, k); ctx.translate(-BRAND_VIEWBOX.x, -BRAND_VIEWBOX.y);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(BRAND_A)); ctx.fill(new Path2D(BRAND_P));
  ctx.restore();
}

// Firma común a todo lo que sale de Autopilot (stories, scan, emails): el AP y la web, abajo.
function drawSignature(ctx: CanvasRenderingContext2D, W: number, H: number) {
  drawBrandA(ctx, W / 2 - 36, H - 224, 72);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = INK_TEXT.tertiary; ctx.font = `500 39px ${F}`;
  ctx.fillText("autopilotplan.com", W / 2, H - 120);
}

function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = INK.base;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 100, 0, W / 2, 100, 650);
  glow.addColorStop(0, "rgba(216, 178, 94, 0.14)");
  glow.addColorStop(1, "rgba(216, 178, 94, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

// Cabecera sin el nombre de la marca (marca.md): solo la fecha; el AP firma al pie.
function drawHeader(ctx: CanvasRenderingContext2D, W: number, p: Props) {
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  ctx.fillStyle = INK_TEXT.secondary; ctx.font = `500 39px ${F}`;
  ctx.fillText(`Completado · ${p.date}`, W / 2, 130);
}

// Logro de la sesión como cápsula centrada, en el único acento de marca (solo lo que sube).
function drawHighlight(ctx: CanvasRenderingContext2D, p: Props, W: number, y: number) {
  const label = sessionHighlight(p);
  if (!label) return;
  let fs = 34;
  ctx.font = `600 ${fs}px ${F}`;
  while (ctx.measureText(label).width + 72 > W - 152 && fs > 20) { fs -= 1; ctx.font = `600 ${fs}px ${F}`; }
  const bw = ctx.measureText(label).width + 72, bh = 68, bx = (W - bw) / 2;
  ctx.fillStyle = "rgba(216,178,94,0.14)";
  ctx.beginPath(); ctx.roundRect(bx, y, bw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = BRAND_GOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, W / 2, y + bh / 2 + 1);
}

// Cifra protagonista con su unidad al lado («12.450 kg», «18 series»), siempre en una línea.
function drawBigFigure(ctx: CanvasRenderingContext2D, value: string, unit: string, cx: number, baseline: number, maxW: number, size: number) {
  ctx.textBaseline = "alphabetic";
  let s = size;
  const measure = () => { ctx.font = `800 ${s}px ${FIG}`; const a = ctx.measureText(value).width; ctx.font = `600 ${s * 0.27}px ${F}`; return a + ctx.measureText(unit).width + 18; };
  while (measure() > maxW && s > 80) s -= 8;
  ctx.font = `800 ${s}px ${FIG}`; const nw = ctx.measureText(value).width;
  ctx.font = `600 ${s * 0.27}px ${F}`; const kw = ctx.measureText(unit).width;
  const x0 = cx - (nw + kw + 18) / 2;
  ctx.textAlign = "left";
  ctx.font = `800 ${s}px ${FIG}`; ctx.fillStyle = INK_TEXT.primary;
  ctx.fillText(value, x0, baseline);
  ctx.font = `600 ${s * 0.27}px ${F}`; ctx.fillStyle = INK_TEXT.secondary;
  ctx.fillText(unit, x0 + nw + 18, baseline);
  return s;
}

/** Volumen de hoy, o las series si la sesión es de peso corporal: nunca «0 kg». */
function heroFigure(p: Props): { label: string; value: string; unit: string } {
  if (p.volumeKg > 0) return { label: "Volumen total", value: fmt(p.volumeKg), unit: "kg" };
  return { label: "Series completadas", value: fmt(p.sets), unit: p.sets === 1 ? "serie" : "series" };
}

function muscleSubtitle(p: Props) {
  return muscleLine(p.muscles, p.muscleSetCounts) || "Sesión completada";
}

function drawTitle(ctx: CanvasRenderingContext2D, p: Props, y: number, W: number) {
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = INK_TEXT.primary;
  let s = 84; const t = p.title || "Sesión de hoy";
  ctx.font = `800 ${s}px ${F}`;
  while (ctx.measureText(t).width > W - 152 && s > 44) { s -= 2; ctx.font = `800 ${s}px ${F}`; }
  ctx.fillText(t, W / 2, y);
  ctx.fillStyle = INK_TEXT.secondary; ctx.font = `500 45px ${F}`;
  ctx.fillText(muscleSubtitle(p), W / 2, y + 58);
}

// Fila de métricas sin cajas, separadas por líneas finas (como un resumen de Fitness).
function drawStats(ctx: CanvasRenderingContext2D, stats: [string, string][], W: number, y: number) {
  const cw = (W - 152) / stats.length;
  stats.forEach(([value, label], i) => {
    const cx = 76 + cw * i + cw / 2;
    if (i) { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(76 + cw * i, y - 70, 2, 130); }
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = INK_TEXT.primary; ctx.font = `800 96px ${FIG}`; ctx.fillText(value, cx, y);
    ctx.fillStyle = INK_TEXT.secondary; ctx.font = `500 39px ${F}`; ctx.fillText(label, cx, y + 50);
  });
}

function drawResumen(ctx: CanvasRenderingContext2D, p: Props, W: number, H: number) {
  drawBackdrop(ctx, W, H);
  drawHeader(ctx, W, p);
  drawTitle(ctx, p, 600, W);

  const hero = heroFigure(p);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK_TEXT.secondary; ctx.font = `600 34px ${F}`;
  ctx.fillText(hero.label, W / 2, 830);
  drawBigFigure(ctx, hero.value, hero.unit, W / 2, 1050, W - 190, 240);
  drawHighlight(ctx, p, W, 1120);

  drawStats(ctx, [
    [String(p.sets), "Series"],
    [String(p.exercises), "Ejercicios"],
    [String(p.muscles.length), "Músculos"],
  ], W, 1460);
  drawSignature(ctx, W, H);
}

function drawMusculos(ctx: CanvasRenderingContext2D, p: Props, W: number, H: number) {
  drawBackdrop(ctx, W, H);
  drawHeader(ctx, W, p);
  drawTitle(ctx, p, 330, W);
  drawHighlight(ctx, p, W, 420);
  const scale = 3.3, fw = 100 * scale, fy = 570;
  drawFigure(ctx, "front", p, W / 2 - fw - 30, fy, scale);
  drawFigure(ctx, "back", p, W / 2 + 30, fy, scale);
  const hero = heroFigure(p);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = INK_TEXT.secondary; ctx.font = `600 34px ${F}`;
  ctx.fillText(hero.label, W / 2, 1330);
  const s = drawBigFigure(ctx, hero.value, hero.unit, W / 2, 1510, W - 240, 190);
  ctx.textAlign = "center"; ctx.fillStyle = INK_TEXT.secondary; ctx.font = `500 34px ${F}`;
  ctx.fillText(`${p.sets} ${p.sets === 1 ? "serie" : "series"} · ${p.exercises} ${p.exercises === 1 ? "ejercicio" : "ejercicios"}`, W / 2, 1510 + Math.min(90, s * 0.45));
  drawSignature(ctx, W, H);
}

export async function renderStory(p: Props, variant: Variant): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  await document.fonts?.load(`800 120px "Big Shoulders"`).catch(() => undefined);
  if (variant === "resumen") {
    drawResumen(ctx, p, W, H);
  } else {
    drawMusculos(ctx, p, W, H);
  }
  const blob = await new Promise<Blob | null>((res) => {
    try { c.toBlob((b) => res(b), "image/png"); } catch { res(null); }
  });
  if (blob && blob.size > 0) return blob;
  // Respaldo: algunos WebKit fallan con toBlob; usamos dataURL.
  const dataUrl = c.toDataURL("image/png");
  return await (await fetch(dataUrl)).blob();
}

export function WorkoutStoryShare(props: Props) {
  const [busy, setBusy] = useState(false);
  const [chosenVariant, setActiveVariant] = useState<Variant>("resumen");
  const activeVariant = props.variant ?? chosenVariant;

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
      const blob = await renderStory(props, activeVariant);

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
      {/* Control segmentado de iOS: qué imagen se comparte. */}
      {!props.variant && <div className="grid h-10 grid-cols-2 rounded-media bg-card p-1" role="radiogroup" aria-label="Imagen para compartir">
        {(["resumen", "musculos"] as Variant[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={activeVariant === v}
            onClick={() => { void hapticSelection(); setActiveVariant(v); }}
            className={`rounded-[9px] type-footnote font-semibold transition-all duration-200 ${
              activeVariant === v
                ? "bg-accent text-foreground shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]"
                : "text-muted-foreground"
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
