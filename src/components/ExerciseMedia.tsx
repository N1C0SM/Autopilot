import { useRef } from "react";
import { Video } from "lucide-react";
import VideoEmbed, { toEmbedUrl } from "@/components/VideoEmbed";

const isDirectFile = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

type Props = {
  video?: string | null;
  image?: string | null;
  name?: string | null;
  className?: string;
  emptyLabel?: string;
};

/**
 * Media principal de un ejercicio: el vídeo manda; al pasar el ratón sobre la
 * portada el vídeo se reproduce solo (silenciado y en bucle).
 */
const ExerciseMedia = ({ video, image, name, className = "", emptyLabel = "Sin vídeo de técnica todavía" }: Props) => {
  const ref = useRef<HTMLVideoElement>(null);

  if (video && isDirectFile(video)) {
    return (
      <div
        className={`relative aspect-video w-full bg-black ${className}`}
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

  if (video && toEmbedUrl(video)) return <VideoEmbed url={video} className={className} />;

  if (image) {
    return (
      <div className={`aspect-video w-full overflow-hidden ${className}`}>
        <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`flex aspect-video w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-secondary/60 to-secondary/20 ${className}`}>
      <Video className="h-7 w-7 text-muted-foreground/50" />
      <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>
    </div>
  );
};

export default ExerciseMedia;
