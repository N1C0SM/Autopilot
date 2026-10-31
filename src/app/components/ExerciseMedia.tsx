import { useState } from "react";
import { Dumbbell, Video } from "lucide-react";
import VideoEmbed, { toEmbedUrl } from "@/web/components/VideoEmbed";
import { cn } from "@/shared/lib/utils";
import { BrandMark } from "@/shared/components/ui/brand-mark";
import { fastImage } from "@/shared/lib/fastImage";

const isDirectFile = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

/** Escala única de miniaturas. No inventar tamaños fuera de esta lista. */
const THUMB_SIZES = {
  xs: "h-8 w-8",
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
} as const;

export type ExerciseThumbSize = keyof typeof THUMB_SIZES;

type ThumbProps = {
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
 * Cuando el ejercicio tiene vídeo, la miniatura lo muestra y lo reproduce sin
 * necesidad de ningún botón.
 */
export const ExerciseThumb = ({
  image,
  video,
  name,
  size = "md",
  aspect = "square",
  completed = false,
  className = "",
}: ThumbProps) => {
  const box = aspect === "video" ? "aspect-video w-28" : THUMB_SIZES[size];
  const hasVideo = Boolean(video && isDirectFile(video));
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = image && broken !== image;

  return (
    <div
      className={`relative ${box} shrink-0 overflow-hidden rounded-[10px] ${
        completed ? "bg-success/15" : "bg-secondary"
      } ${className}`}
    >
      {showImage ? (
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

type Props = {
  video?: string | null;
  image?: string | null;
  name?: string | null;
  className?: string;
  emptyLabel?: string;
};

/**
 * Media principal de un ejercicio. Una sola regla de precedencia para toda la
 * app: vídeo (con la imagen de póster) → imagen → placeholder. El contenedor es
 * siempre 16:9 y con el mismo radio, así que nunca hay saltos de layout.
 */
const ExerciseMedia = ({ video, image, name, className = "", emptyLabel = "Sin vídeo de técnica todavía" }: Props) => {
  // Intro de marca de 1 s al reproducir (la «A» con el rayo latiendo sobre negro) y marca de agua fija.
  const [intro, setIntro] = useState(false);
  if (video && isDirectFile(video)) {
    return (
      // El héroe es el vídeo con su portada: se ve al abrir la ficha y se
      // reproduce solo si el usuario pulsa play. Nunca en automático.
      <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl bg-black", className)}>
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
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black motion-safe:animate-fade-in">
            <BrandMark size={36} beat />
          </div>
        )}
      </div>
    );
  }

  if (video && toEmbedUrl(video)) return <VideoEmbed url={video} className={className} />;

  if (image) {
    return (
      <div className={cn("aspect-video w-full overflow-hidden rounded-xl bg-black", className)}>
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
