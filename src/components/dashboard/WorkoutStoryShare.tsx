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

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, maxLines = 2) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, y);
      y += lh; line = w; lines++;
      if (lines >= maxLines - 1) break;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

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

function roundedPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill = "rgba(255,255,255,0.045)") {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // Deep obsidian athletic background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#09090c");
  bg.addColorStop(0.35, "#060608");
  bg.addColorStop(1, "#020203");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ambient top gold glow
  const glow = ctx.createRadialGradient(W / 2, 100, 10, W / 2, 100, 650);
  glow.addColorStop(0, "rgba(234, 179, 8, 0.085)");
  glow.addColorStop(0.5, "rgba(234, 179, 8, 0.025)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Subtle top hairline accent
  const line = ctx.createLinearGradient(0, 0, W, 0);
  line.addColorStop(0, "rgba(234, 179, 8, 0)");
  line.addColorStop(0.5, "rgba(234, 179, 8, 0.35)");
  line.addColorStop(1, "rgba(234, 179, 8, 0)");
  ctx.fillStyle = line;
  ctx.fillRect(0, 0, W, 2);
}

// The most share-worthy fact of this session: PR > progress vs last time > nothing.
function highlight(p: Props): { type: "pr" | "progress"; label: string } | null {
  if (p.records.length) {
    return { type: "pr", label: `NUEVO RÉCORD · ${p.records[0]}`.toUpperCase() };
  }
  const prev = p.previousVolumeKg || 0, diff = p.volumeKg - prev;
  if (prev > 0 && diff > 0) {
    return {
      type: "progress",
      label: `+${fmt(diff)} KG VS ÚLTIMA SESIÓN (+${Math.round((diff / prev) * 100)} %)`,
    };
  }
  return null;
}

function drawHeader(ctx: CanvasRenderingContext2D, W: number, p: Props, logo?: HTMLImageElement | null) {
  // Official Autopilot Brand Header
  if (logo) {
    ctx.drawImage(logo, 76, 78, 54, 54);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fafafa";
    ctx.font = `800 36px ${F}`;
    ctx.fillText("AUTOPILOT", 76 + 54 + 18, 106);
  } else {
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fafafa";
    ctx.font = `800 42px ${F}`;
    ctx.fillText("AUTOPILOT", 76, 106);
  }

  // Date capsule badge in top right
  const dateStr = p.date.toUpperCase();
  ctx.font = `600 24px ${F}`;
  const dateW = ctx.measureText(dateStr).width + 36;
  const dateX = W - 76 - dateW;
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.beginPath();
  ctx.roundRect(dateX, 80, dateW, 52, 26);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#a1a1aa";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(dateStr, dateX + dateW / 2, 106);

  // Highlight badge (PR or Progress)
  const hi = highlight(p);
  if (!hi) return;

  const isPr = hi.type === "pr";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let fs = 27;
  ctx.font = `700 ${fs}px ${F}`;
  while (ctx.measureText(hi.label).width + 90 > W - 152 && fs > 20) {
    fs -= 1;
    ctx.font = `700 ${fs}px ${F}`;
  }
  const tw = ctx.measureText(hi.label).width;
  const bw = tw + 72;
  const bh = 62;
  const by = 168;

  ctx.save();
  ctx.shadowColor = isPr ? "rgba(234, 179, 8, 0.35)" : "rgba(16, 185, 129, 0.35)";
  ctx.shadowBlur = 16;
  const grad = ctx.createLinearGradient(76, by, 76 + bw, by);
  if (isPr) {
    grad.addColorStop(0, "rgba(234, 179, 8, 0.2)");
    grad.addColorStop(1, "rgba(245, 158, 11, 0.08)");
  } else {
    grad.addColorStop(0, "rgba(16, 185, 129, 0.2)");
    grad.addColorStop(1, "rgba(5, 150, 105, 0.08)");
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(76, by, bw, bh, 31);
  ctx.fill();
  ctx.strokeStyle = isPr ? "rgba(234, 179, 8, 0.45)" : "rgba(16, 185, 129, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Badge icon dot & label
  ctx.fillStyle = isPr ? "#facc15" : "#34d399";
  ctx.beginPath();
  ctx.arc(106, by + bh / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isPr ? "#facc15" : "#34d399";
  ctx.font = `700 ${fs}px ${F}`;
  ctx.fillText(hi.label, 124, by + bh / 2);
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
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#fafafa";
  let s = 68; const t = p.title || "Sesión de hoy";
  ctx.font = `800 ${s}px ${F}`;
  while (ctx.measureText(t).width > W - 152 && s > 42) { s -= 2; ctx.font = `800 ${s}px ${F}`; }
  ctx.fillText(t, 76, y);
  ctx.fillStyle = "#a1a1aa"; ctx.font = `500 32px ${F}`;
  wrap(ctx, muscleSubtitle(p), 76, y + 54, W - 152, 40, 1);
}

function drawResumen(ctx: CanvasRenderingContext2D, p: Props, W: number, H: number, logo?: HTMLImageElement | null) {
  drawBackdrop(ctx, W, H);
  drawHeader(ctx, W, p, logo);
  drawTitle(ctx, p, highlight(p) ? 340 : 270, W);

  const panelY = highlight(p) ? 475 : 405;
  roundedPanel(ctx, 52, panelY, W - 104, 790, 56, "rgba(255,255,255,0.04)");

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `600 26px ${F}`;
  ctx.fillText("CARGA TOTAL ACUMULADA", 104, panelY + 86);
  drawBigKg(ctx, p.volumeKg > 0 ? fmt(p.volumeKg) : String(p.sets), W / 2, panelY + 300, W - 190, 210);

  // Autopilot glowing gold hairline under the hero
  const gold = ctx.createLinearGradient(104, 0, W - 104, 0);
  gold.addColorStop(0, "rgba(234,179,8,0)");
  gold.addColorStop(0.5, "#facc15");
  gold.addColorStop(1, "rgba(234,179,8,0)");
  ctx.fillStyle = gold;
  ctx.fillRect(104, panelY + 360, W - 208, 3);

  // Bento telemetry modules (athletic identity)
  const stats: [string, string, number][] = [
    [String(p.sets), "Series", Math.min(1, p.sets / 30)],
    [String(p.exercises), "Ejercicios", Math.min(1, p.exercises / 10)],
    [String(p.muscles.length), "Grupos", Math.min(1, p.muscles.length / 8)],
  ];
  const gap = 24, mw = (W - 104 - 96 - gap * 2) / 3, my = panelY + 420, mh = 300;
  stats.forEach(([value, label, prog], i) => {
    const x = 100 + i * (mw + gap);
    roundedPanel(ctx, x, my, mw, mh, 36, "rgba(255,255,255,0.045)");
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fafafa"; ctx.font = `800 90px ${F}`; ctx.fillText(value, x + 30, my + 150);
    ctx.fillStyle = "#a1a1aa"; ctx.font = `600 24px ${F}`; ctx.fillText(label.toUpperCase(), x + 30, my + 200);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.roundRect(x + 30, my + 240, mw - 60, 8, 4); ctx.fill();
    const g = ctx.createLinearGradient(x + 30, 0, x + mw - 30, 0);
    g.addColorStop(0, "#fde047"); g.addColorStop(1, "#f59e0b");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 30, my + 240, Math.max(16, (mw - 60) * prog), 8, 4); ctx.fill();
  });

  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#71717a"; ctx.font = `600 26px ${F}`;
  ctx.fillText("autopilotplan.com · Tu rutina y registro inteligente", W / 2, H - 88);
}

function drawMusculos(ctx: CanvasRenderingContext2D, p: Props, W: number, H: number, front: HTMLImageElement, back: HTMLImageElement, logo?: HTMLImageElement | null) {
  drawBackdrop(ctx, W, H);
  drawHeader(ctx, W, p, logo);
  drawTitle(ctx, p, 500, W);
  const scale = 0.98, fw = 399 * scale;
  drawFigure(ctx, front, "front", p, W / 2 - fw - 6, 640, scale);
  drawFigure(ctx, back, "back", p, W / 2 + 6, 640, scale);
  // chips
  const top = [...p.muscles].sort((a, b) => (p.muscleSetCounts?.[b] || 0) - (p.muscleSetCounts?.[a] || 0)).slice(0, 4);
  ctx.font = `700 32px ${F}`;
  const widths = top.map((m) => ctx.measureText(m).width + 64);
  let x = (W - (widths.reduce((a, b) => a + b, 0) + 16 * Math.max(0, top.length - 1))) / 2;
  const y = 640 + 698 * scale + 24;
  top.forEach((m, i) => {
    const hot = i < 2;
    ctx.fillStyle = hot ? "rgba(255,140,40,0.14)" : "rgba(255,255,255,0.05)";
    ctx.strokeStyle = hot ? "rgba(255,150,50,0.7)" : "rgba(255,255,255,0.18)"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(x, y, widths[i], 76, 38); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hot ? "#facc15" : "#fafafa"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(m, x + widths[i] / 2, y + 38);
    x += widths[i] + 16;
  });
  const s = drawBigKg(ctx, fmt(p.volumeKg), W / 2, 1620, W - 240, 230);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#a1a1aa"; ctx.font = `500 36px ${F}`;
  ctx.fillText(`${p.sets} series · ${p.exercises} ejercicios`, W / 2, 1620 + Math.min(96, s * 0.4));
  ctx.font = `600 26px ${F}`; ctx.fillStyle = "#71717a";
  ctx.fillText("autopilotplan.com · Tu rutina y registro inteligente", W / 2, H - 88);
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
            className={`flex-1 rounded-xl py-2 type-footnote font-semibold transition-colors duration-100 ${
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
