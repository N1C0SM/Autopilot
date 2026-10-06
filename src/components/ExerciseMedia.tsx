import { Dumbbell, Play, Video } from "lucide-react";
import VideoEmbed, { toEmbedUrl } from "@/components/VideoEmbed";

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

  return (
    <div
      className={`relative ${box} shrink-0 overflow-hidden rounded-xl border border-border/60 ${
        completed ? "bg-primary/15" : "bg-secondary"
      } ${className}`}
    >
      {image ? (
        <img
          src={image}
          alt={name ?? ""}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover ${completed ? "opacity-70" : ""}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Dumbbell className={`h-4 w-4 ${completed ? "text-primary" : "text-muted-foreground"}`} />
        </div>
      )}
      {/* Nada se reproduce solo: la miniatura es la portada y el play te lleva al vídeo */}
      {hasVideo && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-background/85 ring-1 ring-border"
        >
          <Play className="h-2.5 w-2.5 text-primary" fill="currentColor" />
        </span>
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
  if (video && isDirectFile(video)) {
    return (
      // El héroe es el vídeo con su portada: se ve al abrir la ficha y se
      // reproduce solo si el usuario pulsa play. Nunca en automático.
      <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
        <video
          src={video}
          poster={image ?? undefined}
          playsInline
          controls
          preload="metadata"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (video && toEmbedUrl(video)) return <VideoEmbed url={video} className={`rounded-xl ${className}`} />;

  if (image) {
    return (
      <div className={`aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
        {/* cover: mismo encuadre exacto que el vídeo, para que toda la biblioteca
            se vea igual. El prompt de generación compone dentro de la banda 16:9,
            así que este recorte no corta al atleta. */}
        <img src={image} alt={name ?? ""} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`flex aspect-video w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-border/60 bg-black ${className}`}>
      <Video className="h-7 w-7 text-muted-foreground/50" />
      <p className="text-xs text-muted-foreground">{emptyLabel}</p>
    </div>
  );
};

export default ExerciseMedia;
