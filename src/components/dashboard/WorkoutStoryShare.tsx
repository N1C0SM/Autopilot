import { useState } from "react";
import { Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import frontAnatomy from "@/assets/muscle-map-front.png";
import backAnatomy from "@/assets/muscle-map-back.png";
import { FRONT_REGIONS, BACK_REGIONS, FRONT_SILHOUETTE, BACK_SILHOUETTE } from "./MuscleMapFigure";
import { tonnageEquivalence } from "@/lib/muscleMapping";

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
  img.onload = () => res(img); img.onerror = rej; img.src = src;
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

function roundedPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill = "rgba(255,255,255,0.055)") {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#191919");
  bg.addColorStop(0.48, "#0d0d0f");
  bg.addColorStop(1, "#050506");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const light = ctx.createLinearGradient(0, 0, W, H * 0.65);
  light.addColorStop(0, "rgba(255,255,255,0.055)");
  light.addColorStop(0.42, "rgba(255,255,255,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
}

// The most share-worthy fact of this session: PR > progress vs last time > nothing.
function highlight(p: Props): string | null {
  if (p.records.length) return `NUEVO RÉCORD · ${p.records[0]}`.toUpperCase();
  const prev = p.previousVolumeKg || 0, diff = p.volumeKg - prev;
  if (prev > 0 && diff > 0) return `+${fmt(diff)} KG VS TU ÚLTIMA SESIÓN (+${Math.round((diff / prev) * 100)} %)`;
  return null;
}

function drawHeader(ctx: CanvasRenderingContext2D, W: number, p: Props) {
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f5f5f7"; ctx.font = `700 50px ${F}`;
  ctx.fillText("Autopilot", 76, 128);
  ctx.textAlign = "right"; ctx.font = `500 29px ${F}`; ctx.fillStyle = "#8e8e93";
  ctx.fillText(p.date, W - 76, 123);
  const label = highlight(p);
  if (!label) return;
  ctx.textAlign = "left"; let fs = 29; ctx.font = `700 ${fs}px ${F}`;
  while (ctx.measureText(label).width + 100 > W - 152 && fs > 22) { fs -= 1; ctx.font = `700 ${fs}px ${F}`; }
  const w = ctx.measureText(label).width + 92;
  ctx.fillStyle = "rgba(255,159,10,0.13)";
  ctx.beginPath(); ctx.roundRect(76, 170, w, 66, 33); ctx.fill();
  ctx.fillStyle = "#ff9f0a";
  ctx.beginPath(); ctx.arc(108, 203, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillText(label, 132, 213);
}

function drawBigKg(ctx: CanvasRenderingContext2D, value: string, cx: number, baseline: number, maxW: number, size: number) {
  ctx.textBaseline = "alphabetic";
  let s = size;
  const measure = () => { ctx.font = `700 ${s}px ${F}`; const a = ctx.measureText(value).width; ctx.font = `600 ${s * 0.27}px ${F}`; return a + ctx.measureText("kg").width + 18; };
  while (measure() > maxW && s > 80) s -= 8;
  ctx.font = `700 ${s}px ${F}`; const nw = ctx.measureText(value).width;
  ctx.font = `600 ${s * 0.27}px ${F}`; const kw = ctx.measureText("kg").width;
  const x0 = cx - (nw + kw + 18) / 2;
  ctx.textAlign = "left";
  ctx.font = `700 ${s}px ${F}`; ctx.fillStyle = "#f5f5f7";
  ctx.fillText(value, x0, baseline);
  ctx.font = `600 ${s * 0.27}px ${F}`; ctx.fillStyle = "#8e8e93";
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
  ctx.textAlign = "left"; ctx.fillStyle = "#f5f5f7";
  let s = 68; const t = p.title || "Sesión de hoy";
  ctx.font = `700 ${s}px ${F}`;
  while (ctx.measureText(t).width > W - 152 && s > 42) { s -= 2; ctx.font = `700 ${s}px ${F}`; }
  ctx.fillText(t, 76, y);
  ctx.fillStyle = "#8e8e93"; ctx.font = `500 34px ${F}`;
  wrap(ctx, muscleSubtitle(p), 76, y + 58, W - 152, 42, 1);
}

function drawResumen(ctx: CanvasRenderingContext2D, p: Props, W: number, H: number) {
  drawBackdrop(ctx, W, H);
  drawHeader(ctx, W, p);
  drawTitle(ctx, p, highlight(p) ? 340 : 270, W);

  const panelY = highlight(p) ? 475 : 405;
  roundedPanel(ctx, 52, panelY, W - 104, 790, 68, "rgba(255,255,255,0.048)");

  ctx.textAlign = "left";
  ctx.fillStyle = "#8e8e93";
  ctx.font = `600 29px ${F}`;
  ctx.fillText("CARGA TOTAL", 104, panelY + 86);
  drawBigKg(ctx, p.volumeKg > 0 ? fmt(p.volumeKg) : String(p.sets), W / 2, panelY + 300, W - 190, 210);

  // Autopilot gold hairline under the hero
  const gold = ctx.createLinearGradient(104, 0, W - 104, 0);
  gold.addColorStop(0, "rgba(245,166,35,0)"); gold.addColorStop(0.5, "#f5a623"); gold.addColorStop(1, "rgba(245,166,35,0)");
  ctx.fillStyle = gold; ctx.fillRect(104, panelY + 360, W - 208, 3);

  // Bento telemetry modules (own identity, no rings)
  const stats: [string, string, number][] = [
    [String(p.sets), "Series", Math.min(1, p.sets / 30)],
    [String(p.exercises), "Ejercicios", Math.min(1, p.exercises / 10)],
    [String(p.muscles.length), "Grupos", Math.min(1, p.muscles.length / 8)],
  ];
  const gap = 24, mw = (W - 104 - 96 - gap * 2) / 3, my = panelY + 420, mh = 300;
  stats.forEach(([value, label, prog], i) => {
    const x = 100 + i * (mw + gap);
    roundedPanel(ctx, x, my, mw, mh, 40, "rgba(255,255,255,0.05)");
    ctx.textAlign = "left";
    ctx.fillStyle = "#f5f5f7"; ctx.font = `700 92px ${F}`; ctx.fillText(value, x + 30, my + 150);
    ctx.fillStyle = "#8e8e93"; ctx.font = `600 26px ${F}`; ctx.fillText(label.toUpperCase(), x + 30, my + 200);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.roundRect(x + 30, my + 240, mw - 60, 8, 4); ctx.fill();
    const g = ctx.createLinearGradient(x + 30, 0, x + mw - 30, 0);
    g.addColorStop(0, "#ffd166"); g.addColorStop(1, "#f5a623");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 30, my + 240, Math.max(16, (mw - 60) * prog), 8, 4); ctx.fill();
  });

  ctx.textAlign = "center"; ctx.fillStyle = "#636366"; ctx.font = `500 27px ${F}`;
  ctx.fillText("Entrenamiento completado", W / 2, H - 88);
}

function drawMusculos(ctx: CanvasRenderingContext2D, p: Props, W: number, H: number, front: HTMLImageElement, back: HTMLImageElement) {
  drawBackdrop(ctx, W, H);
  drawHeader(ctx, W, p);
  drawTitle(ctx, p, 500, W);
  const scale = 0.98, fw = 399 * scale;
  drawFigure(ctx, front, "front", p, W / 2 - fw - 6, 640, scale);
  drawFigure(ctx, back, "back", p, W / 2 + 6, 640, scale);
  // chips
  const top = [...p.muscles].sort((a, b) => (p.muscleSetCounts?.[b] || 0) - (p.muscleSetCounts?.[a] || 0)).slice(0, 4);
  ctx.font = `700 34px ${F}`;
  const widths = top.map((m) => ctx.measureText(m).width + 64);
  let x = (W - (widths.reduce((a, b) => a + b, 0) + 16 * Math.max(0, top.length - 1))) / 2;
  const y = 640 + 698 * scale + 24;
  top.forEach((m, i) => {
    const hot = i < 2;
    ctx.fillStyle = hot ? "rgba(255,140,40,0.12)" : "rgba(255,255,255,0.05)";
    ctx.strokeStyle = hot ? "rgba(255,150,50,0.7)" : "rgba(255,255,255,0.18)"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(x, y, widths[i], 76, 38); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hot ? "#f3c969" : "#fafaf9"; ctx.textAlign = "center"; ctx.fillText(m, x + widths[i] / 2, y + 50);
    x += widths[i] + 16;
  });
  const s = drawBigKg(ctx, fmt(p.volumeKg), W / 2, 1620, W - 240, 230);
  ctx.textAlign = "center"; ctx.fillStyle = "#8e8e93"; ctx.font = `500 38px ${F}`;
  ctx.fillText(`${p.sets} series · ${p.exercises} ejercicios`, W / 2, 1620 + Math.min(96, s * 0.4));
}

export async function renderStory(p: Props, variant: Variant): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  if (variant === "resumen") drawResumen(ctx, p, W, H);
  else {
    const [front, back] = await Promise.all([loadImage(frontAnatomy), loadImage(backAnatomy)]);
    drawMusculos(ctx, p, W, H, front, back);
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("no blob"))), "image/png"));
}

export function WorkoutStoryShare(props: Props) {
  const [busy, setBusy] = useState(false);
  const variant: Variant = "resumen";
  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "autopilot-entreno.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const run = async (mode: "share" | "download") => {
    setBusy(true);
    try {
      const blob = await renderStory(props, variant);
      const file = new File([blob], "autopilot-entreno.png", { type: "image/png" });
      if (mode === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mi entreno en Autopilot" });
      } else {
        download(blob);
        if (mode === "share") toast.success("Imagen descargada. Súbela a tu historia.");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("No se pudo crear la imagen");
    } finally { setBusy(false); }
  };
  return (
    <div className="w-full min-w-0 space-y-2">
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_3rem] gap-2">
      <Button type="button" variant="hero" disabled={busy} onClick={() => run("share")} className="h-12 min-w-0 px-3 text-sm">
        <Share2 className="h-4 w-4" /> <span className="truncate">Compartir en historias</span>
      </Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => run("download")} className="h-12 w-12 px-0" aria-label="Descargar imagen">
        <Download className="h-4 w-4" />
      </Button>
    </div>
    </div>
  );
}
