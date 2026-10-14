import { useRef, useState, useCallback, useMemo } from "react";
import { ChevronsLeftRight, ChevronsUpDown, ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgressInlineState } from "@/components/progress/ProgressInlineState";
import { evolutionLabel, photoPose } from "@/components/progress/progressPhotos";
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
const POSE_LABEL: Record<Pose, string> = { front: "Frente", back: "Espalda" };

/** Selector de fecha en una fila de lista: valor gris a la derecha que abre el selector del sistema. */
const DateSelect = ({
  label,
  value,
  photos,
  onChange,
}: {
  label: string;
  value: string | undefined;
  photos: Photo[];
  onChange: (id: string) => void;
}) => (
  <span className="relative flex h-11 items-center">
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 cursor-pointer appearance-none bg-transparent pr-6 text-right type-body tabular-nums text-muted-foreground focus-visible:outline-none focus-visible:text-foreground"
    >
      {photos.map((p) => <option key={p.id} value={p.id}>{fmt(p.taken_at)}</option>)}
    </select>
    <ChevronsUpDown className="pointer-events-none absolute right-0 h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
  </span>
);

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
    return evolutionLabel(before.taken_at, after.taken_at);
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
          <ProgressInlineState
            inset
            icon={ImageOff}
            title="Faltan fotos"
            description={`Necesitas al menos 2 fotos de ${pose === "front" ? "frente" : "espalda"} para comparar este ángulo.`}
            className="py-8"
          />
        ) : (<>
        <div
          ref={boxRef}
          className="relative mx-auto aspect-[3/4] h-[45dvh] max-w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-xl bg-secondary"
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
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 type-caption1 font-semibold text-white backdrop-blur-md">Antes</span>
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 type-caption1 font-semibold text-white backdrop-blur-md">Después</span>
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

        <ListGroup inset>
          <ListRow
            title="Antes"
            trailing={
              <DateSelect
                label="Fecha de antes"
                value={beforeId}
                photos={photos}
                onChange={(id) => { void hapticSelection(); setBeforeId(id); }}
              />
            }
          />
          <ListRow
            title="Después"
            trailing={
              <DateSelect
                label="Fecha de después"
                value={afterId}
                photos={photos}
                onChange={(id) => { void hapticSelection(); setAfterId(id); }}
              />
            }
          />
        </ListGroup>
        </>)}
      </DialogContent>
    </Dialog>
  );
};

export default BeforeAfterCompare;
