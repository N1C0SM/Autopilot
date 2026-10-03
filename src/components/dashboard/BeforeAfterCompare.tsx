import { useRef, useState, useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Photo {
  id: string;
  photo_url: string;
  taken_at: string;
}

interface Props {
  photos: Photo[]; // sorted newest first
  signed: Map<string, string>;
  onClose: () => void;
}

const fmt = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

const BeforeAfterCompare = ({ photos, signed, onClose }: Props) => {
  const [beforeId, setBeforeId] = useState(photos[photos.length - 1].id);
  const [afterId, setAfterId] = useState(photos[0].id);
  const [pos, setPos] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const before = photos.find((p) => p.id === beforeId)!;
  const after = photos.find((p) => p.id === afterId)!;

  const weeks = useMemo(() => {
    const ms = Math.abs(new Date(after.taken_at).getTime() - new Date(before.taken_at).getTime());
    const days = Math.round(ms / 86400000);
    if (days < 14) return `${days} ${days === 1 ? "día" : "días"} de evolución`;
    return `${Math.round(days / 7)} semanas de evolución`;
  }, [before, after]);

  const move = useCallback((clientX: number) => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col items-center justify-center p-4 overflow-y-auto">
      <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose} className="absolute top-4 right-4">
        <X className="w-5 h-5" />
      </Button>

      <h3 className="font-display font-bold text-lg mb-1">Antes / Después</h3>
      <p className="text-xs text-muted-foreground mb-3">{weeks} · Arrastra la barra</p>

      <div
        ref={boxRef}
        className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden border border-border select-none touch-none cursor-ew-resize"
        onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); move(e.clientX); }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        <img src={signed.get(after.photo_url) || ""} alt="Después" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
        <img
          src={signed.get(before.photo_url) || ""}
          alt="Antes"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <div className="absolute inset-y-0 w-0.5 bg-primary-foreground shadow" style={{ left: `${pos}%` }}>
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-lg">
            ‹›
          </div>
        </div>
        <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-1 rounded-full bg-background/80">Antes · {fmt(before.taken_at)}</span>
        <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-full bg-background/80">Después · {fmt(after.taken_at)}</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Posición de la comparación"
        className="w-full max-w-sm mt-3 accent-primary"
      />

      <div className="grid grid-cols-2 gap-2 w-full max-w-sm mt-3">
        <label className="text-xs text-muted-foreground">
          Antes
          <select value={beforeId} onChange={(e) => setBeforeId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-card p-2 text-sm text-foreground">
            {photos.map((p) => <option key={p.id} value={p.id}>{fmt(p.taken_at)}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Después
          <select value={afterId} onChange={(e) => setAfterId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-card p-2 text-sm text-foreground">
            {photos.map((p) => <option key={p.id} value={p.id}>{fmt(p.taken_at)}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
};

export default BeforeAfterCompare;
