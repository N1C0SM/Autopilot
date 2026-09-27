import { Video } from "lucide-react";

/**
 * Convierte una URL de YouTube/Vimeo en una URL embebible.
 * Devuelve null si no se reconoce el formato.
 */
export function toEmbedUrl(url: string | null | undefined): { type: "iframe" | "video"; src: string } | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;

  // YouTube
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };

  // Vimeo
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { type: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };

  // MP4/WebM directos
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u)) return { type: "video", src: u };

  // Fallback: intenta como iframe (puede fallar por CORS, pero al menos lo muestra)
  return { type: "iframe", src: u };
}

interface Props {
  url: string | null | undefined;
  className?: string;
}

const VideoEmbed = ({ url, className = "" }: Props) => {
  const embed = toEmbedUrl(url);

  if (!embed) {
    return (
      <div className={`flex flex-col items-center justify-center bg-secondary/30 rounded-lg p-6 text-muted-foreground ${className}`}>
        <Video className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs">Sin vídeo</p>
      </div>
    );
  }

  if (embed.type === "video") {
    return (
      <video
        src={embed.src}
        controls
        playsInline
        className={`w-full rounded-lg bg-black ${className}`}
      />
    );
  }

  return (
    <div className={`relative w-full rounded-lg overflow-hidden bg-black ${className}`} style={{ aspectRatio: "16/9" }}>
      <iframe
        src={embed.src}
        title="Vídeo del ejercicio"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
};

export default VideoEmbed;