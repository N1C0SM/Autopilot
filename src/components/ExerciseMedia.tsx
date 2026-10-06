import { useRef } from "react";
import { Dumbbell, Video } from "lucide-react";
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
  name?: string | null;
  size?: ExerciseThumbSize;
  /** Atenúa la miniatura cuando el ejercicio ya está completado. */
  completed?: boolean;
  className?: string;
};

/**
 * Miniatura de ejercicio. Única en toda la app: mismo tamaño, mismo radio y
 * mismo placeholder, tanto en administración como en usuario y entrenador.
 */
export const ExerciseThumb = ({ image, name, size = "md", completed = false, className = "" }: ThumbProps) => (
  <div
    className={`${THUMB_SIZES[size]} shrink-0 overflow-hidden rounded-xl border border-border/60 ${
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
  </div>
);

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
  const ref = useRef<HTMLVideoElement>(null);

  if (video && isDirectFile(video)) {
    return (
      <div
        className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}
        onMouseEnter={() => {
          void ref.current?.play().catch(() => {});
        }}
        onMouseLeave={() => {
          const v = ref.current;
          if (v) {
            v.pause();
            v.currentTime = 0;
          }
        }}
      >
        <video
          ref={ref}
          src={video}
          poster={image ?? undefined}
          muted
          loop
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
        {/* contain: una foto de técnica no debe recortar el cuerpo del ejercicio */}
        <img src={image} alt={name ?? ""} loading="lazy" decoding="async" className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div className={`flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl bg-secondary ${className}`}>
      <Video className="h-7 w-7 text-muted-foreground/50" />
      <p className="text-xs text-muted-foreground">{emptyLabel}</p>
    </div>
  );
};

export default ExerciseMedia;
