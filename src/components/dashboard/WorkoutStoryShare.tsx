import { useState } from "react";
import { Share, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { hapticTap, shareFileOrImage } from "@/lib/native";
import { toast } from "sonner";
import frontAnatomy from "@/assets/muscle-map-front.png";
import backAnatomy from "@/assets/muscle-map-back.png";
import autopilotLogo from "@/assets/autopilot-logo.png";
import { FRONT_REGIONS, BACK_REGIONS, FRONT_SILHOUETTE, BACK_SILHOUETTE } from "./MuscleMapFigure";

interface Props {
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

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const img = new Image();
  const t = setTimeout(() => rej(new Error("image timeout")), 5000);
  img.onload = () => { clearTimeout(t); res(img); };
  img.onerror = (e) => { clearTimeout(t); rej(e); };
  img.src = src;
});

// Draws the same anatomy + regions as the in-app map, heat-colored by set load.
function drawFigure(ctx: CanvasRenderingContext2D, img: HTMLImageElement, side: "front" | "back", p: Props, x: number, y: number, scale: number) {
  const regions = side === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const sil = new Path2D(side === "front" ? FRONT_SILHOUETTE : BACK_SILHOUETTE);
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(img, 0, 0, 399, 698);
  ctx.globalAlpha = 1;
  ctx.clip(sil);
  const counts = p.muscleSetCounts || {};
  for (const r of regions) {
    if (!p.muscles.includes(r.muscle)) continue;
    if (r.muscle === "Piernas" && side === "back" && p.muscles.includes("Isquiotibiales")) continue;
    const n = counts[r.muscle] || 1;
    const alpha = n >= 6 ? 0.95 : n >= 3 ? 0.75 : 0.45;
    const path = new Path2D((r.details ?? [r.d]).join(" "));
    ctx.shadowColor = "rgba(255,170,60,0.9)"; ctx.shadowBlur = n >= 3 ? 18 : 8;
    ctx.fillStyle = n >= 6 ? `rgba(255,120,40,${alpha})` : `rgba(240,190,90,${alpha})`;
    ctx.fill(path);
  }
  ctx.restore();
}

type Variant = "resumen" | "musculos";

const F = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif";
const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");

// Firma común a todo lo que sale de Autopilot (stories, scan, emails): discreta, abajo.
function drawSignature(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#71717a"; ctx.font = `500 26px ${F}`;
  ctx.fillText("autopilotplan.com", W / 2, H - 90);
}

function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // Deep obsidian athletic background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#08090b");
  bg.addColorStop(0.35, "#060608");
  bg.addColorStop(1, "#020203");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ambient top gold glow
  const glow = ctx.createRadialGradient(W / 2, 100, 10, W / 2, 100, 650);
  glow.addColorStop(0, "rgba(255, 170, 60, 0.085)");
  glow.addColorStop(0.5, "rgba(255, 170, 60, 0.025)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Subtle top hairline accent
  const line = ctx.createLinearGradient(0, 0, W, 0);
  line.addColorStop(0, "rgba(255, 170, 60, 0)");
  line.addColorStop(0.5, "rgba(255, 170, 60, 0.35)");
  line.addColorStop(1, "rgba(255, 170, 60, 0)");
  ctx.fillStyle = line;
  ctx.fillRect(0, 0, W, 2);
}

// The most share-worthy fact of this session: PR > progress vs last time > nothing.
function highlight(p: Props): { type: "pr" | "progress"; label: string } | null {
  if (p.records.length) {
    return { type: "pr", label: `Nuevo récord · ${p.records[0]}` };
  }
  const prev = p.previousVolumeKg || 0, diff = p.volumeKg - prev;
  if (prev > 0 && diff > 0) {
    return {
      type: "progress",
      label: `+${fmt(diff)} kg vs. la última sesión (+${Math.round((diff / prev) * 100)} %)`,
    };
  }
  return null;
}

function drawHeader(ctx: CanvasRenderingContext2D, W: number, p: Props, logo?: HTMLImageElement | null) {
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  let x = 76;
  if (logo) { ctx.drawImage(logo, x, 82, 48, 48); x += 64; }
  ctx.fillStyle = "#fafafa"; ctx.font = `700 30px ${F}`;
  ctx.fillText("Autopilot", x, 106);
  ctx.textAlign = "right"; ctx.fillStyle = "#a1a1aa"; ctx.font = `500 28px ${F}`;
  ctx.fillText(p.date, W - 76, 106);
}

// Logro de la sesión como cápsula centrada (récord en dorado, progreso en verde).
function drawHighlight(ctx: CanvasRenderingContext2D, p: Props, W: number, y: number) {
  const hi = highlight(p);
  if (!hi) return;
  const isPr = hi.type === "pr";
  const color = isPr ? "#FFAA3C" : "#34d399";
  let fs = 30;
  ctx.font = `600 ${fs}px ${F}`;
  while (ctx.measureText(hi.label).width + 72 > W - 152 && fs > 20) { fs -= 1; ctx.font = `600 ${fs}px ${F}`; }
  const bw = ctx.measureText(hi.label).width + 72, bh = 68, bx = (W - bw) / 2;
  ctx.fillStyle = isPr ? "rgba(255,170,60,0.14)" : "rgba(52,211,153,0.14)";
  ctx.beginPath(); ctx.roundRect(bx, y, bw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(hi.label, W / 2, y + bh / 2 + 1);
}

function drawBigKg(ctx: CanvasRenderingContext2D, value: string, cx: number, baseline: number, maxW: number, size: number) {
  ctx.textBaseline = "alphabetic";
  let s = size;
  const measure = () => { ctx.font = `800 ${s}px ${F}`; const a = ctx.measureText(value).width; ctx.font = `600 ${s * 0.27}px ${F}`; return a + ctx.measureText("kg").width + 18; };
  while (measure() > maxW && s > 80) s -= 8;
  ctx.font = `800 ${s}px ${F}`; const nw = ctx.measureText(value).width;
  ctx.font = `600 ${s * 0.27}px ${F}`; const kw = ctx.measureText("kg").width;
  const x0 = cx - (nw + kw + 18) / 2;
  ctx.textAlign = "left";
  ctx.font = `800 ${s}px ${F}`; ctx.fillStyle = "#fafafa";
  ctx.fillText(value, x0, baseline);
  ctx.font = `600 ${s * 0.27}px ${F}`; ctx.fillStyle = "#a1a1aa";
  ctx.fillText("kg", x0 + nw + 18, baseline);
  return s;
}

function muscleSubtitle(p: Props) {
  const top = [...p.muscles].sort((a, b) => (p.muscleSetCounts?.[b] || 0) - (p.muscleSetCounts?.[a] || 0)).slice(0, 3);
  if (!top.length) return "Sesión completada";
  const low = top.map((m, i) => (i ? m.toLowerCase() : m));
  return low.length > 1 ? `${low.slice(0, -1).join(", ")} y ${low[low.length - 1]}` : low[0];
}

function drawTitle(ctx: CanvasRenderingContext2D, p: Props, y: number, W: number) {
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#fafafa";
  let s = 76; const t = p.title || "Sesión de hoy";
  ctx.font = `800 ${s}px ${F}`;
  while (ctx.measureText(t).width > W - 152 && s > 44) { s -= 2; ctx.font = `800 ${s}px ${F}`; }
  ctx.fillText(t, W / 2, y);
  ctx.fillStyle = "#a1a1aa"; ctx.font = `500 34px ${F}`;
  ctx.fillText(muscleSubtitle(p), W / 2, y + 58);
}

// Fila de métricas sin cajas, separadas por líneas finas (como un resumen de Fitness).
function drawStats(ctx: CanvasRenderingContext2D, stats: [string, string][], W: number, y: number) {
  const cw = (W - 152) / stats.length;
  stats.forEach(([value, label], i) => {
    const cx = 76 + cw * i + cw / 2;
    if (i) { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(76 + cw * i, y - 70, 2, 130); }
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fafafa"; ctx.font = `700 84px ${F}`; ctx.fillText(value, cx, y);
    ctx.fillStyle = "#a1a1aa"; ctx.font = `500 28px ${F}`; ctx.fillText(label, cx, y + 50);
  });
}

function drawResumen(ctx: CanvasRenderingContext2D, p: Props, W: number, H: number, logo?: HTMLImageElement | null) {
  drawBackdrop(ctx, W, H);
  drawHeader(ctx, W, p, logo);
  drawTitle(ctx, p, 600, W);

  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#a1a1aa"; ctx.font = `600 28px ${F}`;
  ctx.fillText(p.volumeKg > 0 ? "Volumen total" : "Series", W / 2, 830);
  drawBigKg(ctx, p.volumeKg > 0 ? fmt(p.volumeKg) : String(p.sets), W / 2, 1050, W - 190, 240);
  drawHighlight(ctx, p, W, 1120);

  drawStats(ctx, [
    [String(p.sets), "Series"],
    [String(p.exercises), "Ejercicios"],
    [String(p.muscles.length), "Músculos"],
  ], W, 1460);
  drawSignature(ctx, W, H);
}

function drawMusculos(ctx: CanvasRenderingContext2D, p: Props, W: number, H: number, front: HTMLImageElement, back: HTMLImageElement, logo?: HTMLImageElement | null) {
  drawBackdrop(ctx, W, H);
  drawHeader(ctx, W, p, logo);
  drawTitle(ctx, p, 330, W);
  drawHighlight(ctx, p, W, 420);
  const scale = 0.95, fw = 399 * scale, fy = 560;
  drawFigure(ctx, front, "front", p, W / 2 - fw - 8, fy, scale);
  drawFigure(ctx, back, "back", p, W / 2 + 8, fy, scale);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#a1a1aa"; ctx.font = `600 28px ${F}`;
  ctx.fillText(p.volumeKg > 0 ? "Volumen total" : "Series", W / 2, 1330);
  const s = drawBigKg(ctx, p.volumeKg > 0 ? fmt(p.volumeKg) : String(p.sets), W / 2, 1510, W - 240, 190);
  ctx.textAlign = "center"; ctx.fillStyle = "#a1a1aa"; ctx.font = `500 34px ${F}`;
  ctx.fillText(`${p.sets} series · ${p.exercises} ejercicios`, W / 2, 1510 + Math.min(90, s * 0.45));
  drawSignature(ctx, W, H);
}

export async function renderStory(p: Props, variant: Variant): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  const logo = await loadImage(autopilotLogo).catch(() => null);
  if (variant === "resumen") {
    drawResumen(ctx, p, W, H, logo);
  } else {
    const [front, back] = await Promise.all([loadImage(frontAnatomy), loadImage(backAnatomy)]);
    drawMusculos(ctx, p, W, H, front, back, logo);
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
  const [activeVariant, setActiveVariant] = useState<Variant>("resumen");

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Texto enriquecido para compartir por WhatsApp / mensajes
  const shareText = () => {
    const lines: string[] = [];
    if (props.records.length) lines.push(`🏆 ${props.records[0]}`);
    if (props.volumeKg > 0) lines.push(`💪 ${Math.round(props.volumeKg).toLocaleString("es-ES")} kg de carga total`);
    lines.push(`${props.sets} series · ${props.exercises} ejercicios`);
    if (props.muscles.length) lines.push(props.muscles.slice(0, 3).join(", "));
    lines.push("Autopilot — autopilotplan.com");
    return lines.join("\n");
  };

  const run = async (mode: "share" | "download") => {
    console.log("[WORKOUT-SHARE] Starting run, mode:", mode, "busy:", busy);
    if (busy) {
      console.log("[WORKOUT-SHARE] Already busy, ignoring");
      return;
    }
    
    setBusy(true);
    console.log("[WORKOUT-SHARE] Set busy to true");
    
    try {
      const filename = `autopilot-entreno-${activeVariant}-${Date.now()}.png`;
      console.log("[WORKOUT-SHARE] Rendering story, variant:", activeVariant);
      
      const blob = await renderStory(props, activeVariant);
      console.log("[WORKOUT-SHARE] Story rendered, blob size:", blob.size);

      if (mode === "download") {
        console.log("[WORKOUT-SHARE] Download mode");
        download(blob, filename);
        toast.success("Imagen descargada");
        setBusy(false);
        return;
      }

      console.log("[WORKOUT-SHARE] Calling shareFileOrImage");
      
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
        console.log("[WORKOUT-SHARE] Share completed:", res);
        if (res.shared) {
          toast.success("Compartido");
        } else if (res.downloaded) {
          toast.success("Imagen descargada");
        }
      }).catch((e: unknown) => {
        const name = (e as Error)?.name || "";
        const msg = (e as Error)?.message || "";
        console.error("[WORKOUT-SHARE] Share error:", { name, msg, error: e });
        
        if (name !== "AbortError" && !msg.toLowerCase().includes("cancel")) {
          toast.error("No se pudo compartir");
        }
      });
      
    } catch (e: unknown) {
      const name = (e as Error)?.name || "";
      const msg = (e as Error)?.message || "";
      console.error("[WORKOUT-SHARE] Render error:", { name, msg, error: e });
      
      toast.error("No se pudo crear la imagen");
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {/* Selector de variante */}
      <div className="flex gap-2" role="group" aria-label="Tipo de imagen">
        {(["resumen", "musculos"] as Variant[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => { void hapticTap(); setActiveVariant(v); }}
            className={`flex-1 rounded-xl py-2 type-footnote font-semibold transition-colors duration-150 ${
              activeVariant === v
                ? "bg-primary/15 text-primary"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {v === "resumen" ? "Resumen" : "Músculos"}
          </button>
        ))}
      </div>

      {/* Botones de acción */}
      <div className="flex w-full min-w-0 gap-2">
        <Button
          type="button"
          variant="hero"
          size="lg"
          disabled={busy}
          onClick={() => { void hapticTap(); void run("share"); }}
          className="min-w-0 flex-1 px-4 shadow-sm"
        >
          {busy
            ? <Spinner size="sm" label="Creando imagen" className="text-primary-foreground [&>svg]:!size-full" />
            : <Share aria-hidden="true" />}
          <span className="truncate">Compartir</span>
        </Button>
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
      </div>
    </div>
  );
}
