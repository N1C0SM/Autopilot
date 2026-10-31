import { useMemo, useState } from "react";
import { Dumbbell, Video } from "lucide-react";
import VideoEmbed, { toEmbedUrl } from "@/web/components/VideoEmbed";
import { cn } from "@/shared/lib/utils";
import { BrandMark } from "@/shared/components/ui/brand-mark";
import { fastImage } from "@/shared/lib/fastImage";
import { exerciseMotion } from "@/shared/lib/exerciseMotion";
import { ExerciseMotion, ExerciseMotionGlyph } from "@/app/components/ExerciseMotion";

export const isDirectFile = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

/** Datos de la ficha que dibujan la huella de movimiento. Sin patrón no hay huella. */
type MotionProps = {
  pattern?: string | null;
  stimulus?: string | null;
  load?: string | null;
};

const useMotion = (name: string | null | undefined, { pattern, stimulus, load }: MotionProps) =>
  useMemo(() => exerciseMotion({ name: name ?? "", pattern, stimulus, load }), [name, pattern, stimulus, load]);

/** Escala única de miniaturas. No inventar tamaños fuera de esta lista. */
const THUMB_SIZES = {
  xs: "h-8 w-8",
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
} as const;

export type ExerciseThumbSize = keyof typeof THUMB_SIZES;

type ThumbProps = MotionProps & {
  image?: string | null;
  /** Si hay vídeo, la miniatura ES el vídeo: se reproduce al pasar el ratón o al tocarla. */
  video?: string | null;
  name?: string | null;
  size?: ExerciseThumbSize;
  /** "video" usa un marco 16:9 en vez del cuadrado. */
  aspect?: "square" | "video";
  /** Atenúa la miniatura cuando el ejercicio ya está completado. */
  completed?: boolean;
  className?: string;
};

/**
 * Miniatura de ejercicio. Única en toda la app: mismo tamaño, mismo radio y
 * mismo placeholder, tanto en administración como en usuario y entrenador.
 *
 * Qué se ve, en este orden: la huella de movimiento del ejercicio (su patrón,
 * su ritmo y su carga) → la foto → hueco. La administración no pasa el patrón a
 * propósito: allí se gestiona la foto, así que allí se sigue viendo la foto.
 */
export const ExerciseThumb = ({
  image,
  name,
  pattern,
  stimulus,
  load,
  size = "md",
  aspect = "square",
  completed = false,
  className = "",
}: ThumbProps) => {
  const box = aspect === "video" ? "aspect-video w-28" : THUMB_SIZES[size];
  const spec = useMotion(name, { pattern, stimulus, load });
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = image && broken !== image;

  return (
    <div
      className={`relative ${box} shrink-0 overflow-hidden rounded-[10px] ${
        completed ? "bg-success/15" : "bg-secondary"
      } ${className}`}
    >
      {spec ? (
        <div className="h-full w-full p-1.5">
          <ExerciseMotionGlyph spec={spec} className={completed ? "opacity-60" : ""} />
        </div>
      ) : showImage ? (
        <img
          src={fastImage(image, 192)}
          alt={name ?? ""}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(image)}
          className={`h-full w-full object-cover ${completed ? "opacity-70" : ""}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Dumbbell className={`h-4 w-4 ${completed ? "text-success" : "text-muted-foreground"}`} />
        </div>
      )}
    </div>
  );
};

type Props = MotionProps & {
  video?: string | null;
  image?: string | null;
  name?: string | null;
  className?: string;
  emptyLabel?: string;
};

/**
 * Media principal de un ejercicio. Una sola regla de precedencia para toda la
 * app: vídeo (con la imagen de póster) → huella de movimiento → imagen → hueco.
 * El contenedor es siempre 16:9 y con el mismo radio, así que nunca hay saltos
 * de layout. Si el ejercicio tiene foto además de huella, se cambia entre las
 * dos con una píldora discreta: nada de capas ni de botones sueltos.
 */
const ExerciseMedia = ({ video, image, name, pattern, stimulus, load, className = "", emptyLabel = "Sin vídeo de técnica todavía" }: Props) => {
  // Intro de marca de 1 s al reproducir (la «A» con el rayo latiendo sobre negro) y marca de agua fija.
  const [intro, setIntro] = useState(false);
  const spec = useMotion(name, { pattern, stimulus, load });
  const [photo, setPhoto] = useState(false);

  if (video && isDirectFile(video)) {
    return (
      // El héroe es el vídeo con su portada: se ve al abrir la ficha y se
      // reproduce solo si el usuario pulsa play. Nunca en automático.
      <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl bg-background", className)}>
        <video
          src={video}
          poster={image ?? undefined}
          playsInline
          controls
          preload="metadata"
          onPlay={(e) => {
            if (e.currentTarget.currentTime > 0.2) return;
            setIntro(true);
            window.setTimeout(() => setIntro(false), 1000);
          }}
          className="h-full w-full object-cover"
        />
        <BrandMark size={14} className="pointer-events-none absolute bottom-3 right-3 opacity-60" />
        {intro && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background motion-safe:animate-fade-in">
            <BrandMark size={36} beat />
          </div>
        )}
      </div>
    );
  }

  if (video && toEmbedUrl(video)) return <VideoEmbed url={video} className={className} />;

  if (spec && !(photo && image)) {
    return (
      <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl bg-background", className)}>
        <ExerciseMotion spec={spec} className="p-3" />
        <BrandMark size={14} className="pointer-events-none absolute bottom-3 right-3 opacity-40" />
        {image && (
          <div className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-full bg-secondary/90 p-0.5">
            {[
              { label: "Ritmo", on: !photo, show: () => setPhoto(false) },
              { label: "Foto", on: photo, show: () => setPhoto(true) },
            ].map((tab) => (
              <button
                key={tab.label}
                type="button"
                aria-pressed={tab.on}
                onClick={tab.show}
                className={cn(
                  "h-7 rounded-full px-3 type-footnote font-semibold transition active:opacity-60",
                  tab.on ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (image) {
    return (
      <div className={cn("aspect-video w-full overflow-hidden rounded-xl bg-background", className)}>
        {/* cover: mismo encuadre exacto que el vídeo, para que toda la biblioteca
            se vea igual. El prompt de generación compone dentro de la banda 16:9,
            así que este recorte no corta al atleta. */}
        <img src={fastImage(image, 1000)} alt={name ?? ""} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={cn("flex aspect-video w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-secondary px-6 text-center", className)}>
      <Video className="h-7 w-7 text-muted-foreground/60" strokeWidth={1.75} aria-hidden="true" />
      <p className="type-footnote text-muted-foreground">{emptyLabel}</p>
    </div>
  );
};

export default ExerciseMedia;
