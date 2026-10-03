import { useState } from "react";
import { Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  title: string;
  date: string;
  volumeKg: number;
  sets: number;
  exercises: number;
  records: string[];
  muscles: string[];
}

const css = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : fallback;
};

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

async function renderStory(p: Props): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const primary = css("--primary", "#d4a64a");
  const fg = "#f5f5f4", muted = "#a8a29e";

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0c0c0d"); bg.addColorStop(1, "#18181b");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 520, 50, W / 2, 520, 800);
  glow.addColorStop(0, primary.replace("hsl(", "hsla(").replace(")", " / 0.22)"));
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "left";
  ctx.fillStyle = fg;
  ctx.font = "700 44px system-ui, sans-serif";
  ctx.fillText("AUTOPILOT", 96, 150);
  ctx.fillStyle = muted;
  ctx.font = "500 32px system-ui, sans-serif";
  ctx.fillText(p.date, 96, 200);

  ctx.fillStyle = primary;
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText("ENTRENAMIENTO COMPLETADO", 96, 420);
  ctx.fillStyle = fg;
  ctx.font = "800 92px system-ui, sans-serif";
  let y = wrap(ctx, p.title || "Sesión de hoy", 96, 530, W - 192, 104);

  y += 120;
  ctx.fillStyle = primary;
  ctx.font = "800 190px system-ui, sans-serif";
  ctx.fillText(p.volumeKg > 0 ? `${Math.round(p.volumeKg).toLocaleString("es-ES")}` : `${p.sets}`, 96, y);
  ctx.fillStyle = muted;
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText(p.volumeKg > 0 ? "kg levantados" : "series completadas", 100, y + 70);

  y += 220;
  const stats = [
    { v: String(p.sets), l: "Series" },
    { v: String(p.exercises), l: "Ejercicios" },
    { v: String(p.records.length), l: "Récords" },
  ];
  const bw = (W - 192 - 48) / 3;
  stats.forEach((s, i) => {
    const x = 96 + i * (bw + 24);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath(); ctx.roundRect(x, y, bw, 200, 36); ctx.fill();
    ctx.fillStyle = fg; ctx.font = "800 80px system-ui, sans-serif";
    ctx.fillText(s.v, x + 36, y + 110);
    ctx.fillStyle = muted; ctx.font = "500 32px system-ui, sans-serif";
    ctx.fillText(s.l, x + 36, y + 165);
  });
  y += 290;

  if (p.records.length) {
    ctx.fillStyle = primary; ctx.font = "700 40px system-ui, sans-serif";
    y = wrap(ctx, `🏆 Nuevo récord · ${p.records.join(" · ")}`, 96, y, W - 192, 54);
    y += 20;
  }
  if (p.muscles.length) {
    ctx.fillStyle = muted; ctx.font = "500 36px system-ui, sans-serif";
    wrap(ctx, p.muscles.slice(0, 6).join(" · "), 96, y, W - 192, 50);
  }

  ctx.fillStyle = muted; ctx.font = "500 32px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("autopilotplan.com", W / 2, H - 120);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("no blob"))), "image/png"));
}

export function WorkoutStoryShare(props: Props) {
  const [busy, setBusy] = useState(false);
  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "autopilot-entreno.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const run = async (mode: "share" | "download") => {
    setBusy(true);
    try {
      const blob = await renderStory(props);
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
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_3rem] gap-2">
      <Button type="button" variant="hero" disabled={busy} onClick={() => run("share")} className="h-12 min-w-0 px-3 text-sm">
        <Share2 className="h-4 w-4" /> <span className="truncate">Compartir en historias</span>
      </Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => run("download")} className="h-12" aria-label="Descargar imagen">
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
