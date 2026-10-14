import { useRef, useState, useCallback, useMemo } from "react";
import { ChevronsLeftRight, ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hapticSelection } from "@/lib/native";

interface Photo {
  id: string;
  note?: string | null;
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

type Pose = "front" | "back";
export const photoPose = (note?: string | null): "front" | "back" | "other" => {
  const n = (note || "").toLowerCase();
  if (/espalda|dorsal|back/.test(n)) return "back";
  if (/frente|pecho|front/.test(n)) return "front";
  return "other";
};
const POSE_LABEL: Record<Pose, string> = { front: "Frente", back: "Espalda" };

const BeforeAfterCompare = ({ photos: allPhotos, signed, onClose }: Props) => {
  const counts = { front: allPhotos.filter((p) => photoPose(p.note) === "front").length, back: allPhotos.filter((p) => photoPose(p.note) === "back").length };
  const [pose, setPoseState] = useState<Pose>(counts.front >= 2 ? "front" : counts.back >= 2 ? "back" : "front");
  const photos = allPhotos.filter((p) => photoPose(p.note) === pose);
  const [beforeId, setBeforeId] = useState(photos[photos.length - 1]?.id);
  const [afterId, setAfterId] = useState(photos[0]?.id);
  const setPose = (p: Pose) => {
    const list = allPhotos.filter((x) => photoPose(x.note) === p);
    setPoseState(p); setBeforeId(list[list.length - 1]?.id); setAfterId(list[0]?.id);
  };
  const [pos, setPos] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const before = photos.find((p) => p.id === beforeId);
  const after = photos.find((p) => p.id === afterId);

  const weeks = useMemo(() => {
    if (!before || !after) return "";
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

  const canCompare = photos.length >= 2 && before && after;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Antes / Después</DialogTitle>
          <DialogDescription className={canCompare ? undefined : "sr-only"}>
            {canCompare ? `${weeks} · Arrastra la barra` : "Compara dos fotos de tu progreso"}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={pose}
          onValueChange={(next) => {
            void hapticSelection();
            setPose(next as Pose);
          }}
        >
          <TabsList aria-label="Ángulo" className="w-full">
            {(["front", "back"] as Pose[]).map((p) => (
              <TabsTrigger key={p} value={p}>{POSE_LABEL[p]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {!canCompare ? (
          <EmptyState
            icon={ImageOff}
            title="Faltan fotos"
            description={`Necesitas al menos 2 fotos de ${pose === "front" ? "frente" : "espalda"} para comparar este ángulo.`}
            className="py-6"
          />
        ) : (<>
        <div
          ref={boxRef}
          className="relative mx-auto aspect-[3/4] h-[50dvh] max-w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-2xl bg-secondary"
          onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); move(e.clientX); }}
          onPointerMove={(e) => dragging.current && move(e.clientX)}
          onPointerUp={() => { dragging.current = false; }}
          onPointerCancel={() => { dragging.current = false; }}
        >
          <img loading="lazy" decoding="async" src={signed.get(after.photo_url) || ""} alt="Después" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          <img loading="lazy" decoding="async"
            src={signed.get(before.photo_url) || ""}
            alt="Antes"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
          <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white" style={{ left: `${pos}%` }}>
            <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
              <ChevronsLeftRight className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2.5 py-1 type-caption1 font-semibold text-white backdrop-blur-md">Antes · {fmt(before.taken_at)}</span>
          <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2.5 py-1 type-caption1 font-semibold text-white backdrop-blur-md">Después · {fmt(after.taken_at)}</span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Posición de la comparación"
          className="h-11 w-full accent-primary"
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="type-subhead text-muted-foreground">
            Antes
            <select value={beforeId} onChange={(e) => { void hapticSelection(); setBeforeId(e.target.value); }} className="field mt-1.5 w-full text-foreground">
              {photos.map((p) => <option key={p.id} value={p.id}>{fmt(p.taken_at)}</option>)}
            </select>
          </label>
          <label className="type-subhead text-muted-foreground">
            Después
            <select value={afterId} onChange={(e) => { void hapticSelection(); setAfterId(e.target.value); }} className="field mt-1.5 w-full text-foreground">
              {photos.map((p) => <option key={p.id} value={p.id}>{fmt(p.taken_at)}</option>)}
            </select>
          </label>
        </div>
        </>)}
      </DialogContent>
    </Dialog>
  );
};

export default BeforeAfterCompare;
