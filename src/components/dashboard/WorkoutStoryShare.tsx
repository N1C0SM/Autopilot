import { useState } from "react";
import { Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import frontAnatomy from "@/assets/muscle-map-front.png";
import backAnatomy from "@/assets/muscle-map-back.png";
import { FRONT_REGIONS, BACK_REGIONS, FRONT_SILHOUETTE, BACK_SILHOUETTE } from "./MuscleMapFigure";
import { tonnageEquivalence } from "@/lib/muscleMapping";
import displayFontUrl from "@/assets/fonts/BigShoulders-Bold.ttf";

let fontReady: Promise<void> | null = null;
const ensureFont = () => (fontReady ??= new FontFace("AutopilotDisplay", `url(${displayFontUrl})`).load().then((f) => { document.fonts.add(f); }).catch(() => {}));

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

const GOLD_STOPS: [number, string][] = [[0, "#fff1c2"], [0.35, "#f3c969"], [0.7, "#c8902f"], [1, "#7a5418"]];
const DISPLAY = "AutopilotDisplay, Impact, 'Haettenschweiler', 'Arial Narrow Bold', 'SF Pro Display', system-ui, sans-serif";
const F = "system-ui, -apple-system, 'SF Pro Display', sans-serif";
const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");

function goldFill(ctx: CanvasRenderingContext2D, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  GOLD_STOPS.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

// Seeded so the same session always renders the same sparkles.
function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, cy: number, seed: number) {
  ctx.fillStyle = "#070605"; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, cy, 20, W / 2, cy, 900);
  glow.addColorStop(0, "rgba(243,180,80,0.38)"); glow.addColorStop(0.45, "rgba(160,95,25,0.12)"); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, cy);
  for (let i = 0; i < 48; i++) {
    ctx.rotate((Math.PI * 2) / 48);
    const ray = ctx.createLinearGradient(0, 0, 0, -1100);
    ray.addColorStop(0, "rgba(255,200,110,0.10)"); ray.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = ray; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-28, -1100); ctx.lineTo(28, -1100); ctx.lineTo(6, 0); ctx.fill();
  }
  ctx.restore();
  const r = rng(seed || 7);
  for (let i = 0; i < 140; i++) {
    const x = r() * W, y = r() * H, s = r() * 3 + 0.6;
    ctx.fillStyle = `rgba(255,${190 + Math.floor(r() * 50)},120,${0.25 + r() * 0.6})`;
    ctx.shadowColor = "rgba(255,190,90,0.9)"; ctx.shadowBlur = s * 4;
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
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
  ctx.fillStyle = "#fafaf9"; ctx.font = `76px ${DISPLAY}`;
  if ("letterSpacing" in ctx) (ctx as any).letterSpacing = "6px";
  ctx.fillText("AUTOPILOT", 96, 210);
  if ("letterSpacing" in ctx) (ctx as any).letterSpacing = "0px";
  ctx.textAlign = "right"; ctx.font = `700 34px ${F}`; ctx.fillStyle = "#d6c7a8";
  ctx.fillText(p.date.toUpperCase(), W - 96, 200);
  const label = highlight(p);
  if (!label) return;
  ctx.textAlign = "left"; let fs = 32; ctx.font = `800 ${fs}px ${F}`;
  while (ctx.measureText(label).width + 104 > W - 192 && fs > 20) { fs -= 2; ctx.font = `800 ${fs}px ${F}`; }
  const w = ctx.measureText(label).width + 104;
  ctx.fillStyle = "rgba(255,150,40,0.10)"; ctx.strokeStyle = "rgba(243,180,80,0.6)"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(96, 250, w, 72, 36); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ff8a1f"; ctx.shadowColor = "#ff8a1f"; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(136, 286, 9, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#f3c969"; ctx.fillText(label, 164, 286 + fs * 0.36);
}

// Huge gold number with a small "kg" suffix, auto-fitted to maxW.
function drawBigKg(ctx: CanvasRenderingContext2D, value: string, cx: number, baseline: number, maxW: number, size: number) {
  ctx.textBaseline = "alphabetic";
  let s = size;
  const measure = () => { ctx.font = `${s}px ${DISPLAY}`; const a = ctx.measureText(value).width; ctx.font = `${s * 0.32}px ${DISPLAY}`; return a + ctx.measureText("kg").width + 12; };
  while (measure() > maxW && s > 80) s -= 8;
  ctx.font = `${s}px ${DISPLAY}`; const nw = ctx.measureText(value).width;
  ctx.font = `${s * 0.32}px ${DISPLAY}`; const kw = ctx.measureText("kg").width;
  const x0 = cx - (nw + kw + 12) / 2;
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(255,180,70,0.55)"; ctx.shadowBlur = 50;
  ctx.font = `${s}px ${DISPLAY}`; ctx.fillStyle = goldFill(ctx, baseline - s * 0.75, baseline);
  ctx.fillText(value, x0, baseline);
  ctx.font = `${s * 0.32}px ${DISPLAY}`; ctx.fillText("kg", x0 + nw + 12, baseline);
  ctx.shadowBlur = 0;
  return s;
}

function muscleSubtitle(p: Props) {
  const top = [...p.muscles].sort((a, b) => (p.muscleSetCounts?.[b] || 0) - (p.muscleSetCounts?.[a] || 0)).slice(0, 3);
  if (!top.length) return "Sesión completada";
  const low = top.map((m, i) => (i ? m.toLowerCase() : m));
  return low.length > 1 ? `${low.slice(0, -1).join(", ")} y ${low[low.length - 1]}` : low[0];
}

function drawTitle(ctx: CanvasRenderingContext2D, p: Props, y: number, W: number) {
  ctx.textAlign = "left"; ctx.fillStyle = "#fafaf9";
  let s = 150; const t = (p.title || "Sesión de hoy").toUpperCase();
  ctx.font = `${s}px ${DISPLAY}`;
  while (ctx.measureText(t).width > W - 192 && s > 70) { s -= 6; ctx.font = `${s}px ${DISPLAY}`; }
  ctx.fillText(t, 96, y);
  ctx.fillStyle = "#d9d4ca"; ctx.font = `500 48px ${F}`;
  wrap(ctx, muscleSubtitle(p), 96, y + 80, W - 192, 56, 1);
}

function drawResumen(ctx: CanvasRenderingContext2D, p: Props, W: number, H: number) {
  const cx = W / 2, cy = 820, R = 400;
  drawBackdrop(ctx, W, H, cy, Math.round(p.volumeKg) + p.sets);
  drawHeader(ctx, W, p);
  // Segmented ring: one segment per set (capped for legibility).
  const n = Math.max(1, Math.min(p.sets || 1, 40)), gap = n > 1 ? 0.06 : 0;
  ctx.lineCap = "round"; ctx.lineWidth = 22;
  ctx.shadowColor = "rgba(255,180,70,0.8)"; ctx.shadowBlur = 30;
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + (i * Math.PI * 2) / n + gap / 2, a1 = a0 + (Math.PI * 2) / n - gap;
    ctx.strokeStyle = goldFill(ctx, cy - R, cy + R);
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(243,201,105,0.18)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R - 46, 0, Math.PI * 2); ctx.stroke();
  drawBigKg(ctx, p.volumeKg > 0 ? fmt(p.volumeKg) : String(p.sets), cx, cy + 110, 2 * R - 90, 330);
  ctx.textAlign = "center"; ctx.fillStyle = "#f3c969"; ctx.font = `800 40px ${F}`;
  if ("letterSpacing" in ctx) (ctx as any).letterSpacing = "4px";
  ctx.fillText(`${p.sets} SERIES`, cx, cy + 200);
  if ("letterSpacing" in ctx) (ctx as any).letterSpacing = "0px";
  const eq = tonnageEquivalence(p.volumeKg);
  if (eq) {
    ctx.textAlign = "center"; ctx.fillStyle = "#fafaf9"; ctx.font = `700 46px ${F}`;
    wrap(ctx, eq.text, cx, 1300, W - 192, 54, 1);
  }
  drawTitle(ctx, p, 1470, W);
  ctx.fillStyle = "rgba(243,201,105,0.25)"; ctx.fillRect(96, 1610, W - 192, 2);
  const stats = [[String(p.sets), "series"], [String(p.exercises), "ejercicios"], [fmt(p.volumeKg), "kg movidos"]];
  stats.forEach(([v, l], i) => {
    const x = 96 + i * ((W - 192) / 3);
    ctx.textAlign = "left"; ctx.font = `110px ${DISPLAY}`; ctx.fillStyle = goldFill(ctx, 1640, 1740);
    ctx.fillText(v, x, 1740);
    ctx.font = `500 34px ${F}`; ctx.fillStyle = "#bdb6a8"; ctx.fillText(l, x, 1792);
  });
}

function drawMusculos(ctx: CanvasRenderingContext2D, p: Props, W: number, H: number, front: HTMLImageElement, back: HTMLImageElement) {
  drawBackdrop(ctx, W, H, 820, Math.round(p.volumeKg) + 3);
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
  const eq = tonnageEquivalence(p.volumeKg);
  ctx.textAlign = "center"; ctx.fillStyle = "#fafaf9"; ctx.font = `700 52px ${F}`;
  const eqText = eq ? eq.text.replace(/^Como levantar /, "Como levantar ") : `${p.sets} series completadas`;
  wrap(ctx, eqText, W / 2, 1620 + Math.min(96, s * 0.4), W - 160, 60, 1);
  ctx.fillStyle = "#bdb6a8"; ctx.font = `500 38px ${F}`;
  ctx.fillText(`${p.sets} series · ${p.exercises} ejercicios`, W / 2, 1620 + Math.min(96, s * 0.4) + 62);
}

export async function renderStory(p: Props, variant: Variant): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  await ensureFont();
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
