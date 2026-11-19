import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import VideoEmbed, { toEmbedUrl } from "@/web/components/VideoEmbed";
import { cn } from "@/shared/lib/utils";
import { BrandMark } from "@/shared/components/ui/brand-mark";
import { fastImage } from "@/shared/lib/fastImage";
import { exerciseMotion, exerciseMotionFor } from "@/shared/lib/exerciseMotion";
import { ExerciseMotion, ExerciseMotionGlyph } from "@/app/components/ExerciseMotion";

export const isDirectFile = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

/** Datos de la ficha que dibujan la huella de movimiento. */
type MotionProps = {
  pattern?: string | null;
  stimulus?: string | null;
  load?: string | null;
  /** Grupo muscular: sin patrón en la ficha, deduce la huella (nunca un hueco vacío). */
  muscleGroup?: string | null;
};

/** La huella con el patrón de la ficha, o `null` si no lo tiene (no hay «Ritmo» que enseñar). */
const useMotion = (name: string | null | undefined, { pattern, stimulus, load }: MotionProps) =>
  useMemo(() => exerciseMotion({ name: name ?? "", pattern, stimulus, load }), [name, pattern, stimulus, load]);

/** La huella siempre: la de la ficha o la deducida del nombre y el grupo (`ExerciseMotion.specFor` en la app). */
const useGlyph = (name: string | null | undefined, { pattern, stimulus, load, muscleGroup }: MotionProps) =>
  useMemo(
    () => exerciseMotionFor({ name: name ?? "", pattern, stimulus, load, muscleGroup }),
    [name, pattern, stimulus, load, muscleGroup],
  );

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
 * Qué se ve, en este orden: la foto → la huella de movimiento del ejercicio (su
 * patrón, su ritmo y su carga; sin patrón, la deducida del nombre y el grupo).
 * Nunca un cuadro vacío ni un icono suelto.
 */
export const ExerciseThumb = ({
  image,
  name,
  pattern,
  stimulus,
  load,
  muscleGroup,
  size = "md",
  aspect = "square",
  completed = false,
  className = "",
}: ThumbProps) => {
  const box = aspect === "video" ? "aspect-video w-28" : THUMB_SIZES[size];
  const spec = useGlyph(name, { pattern, stimulus, load, muscleGroup });
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = image && broken !== image;

  return (
    // 12 px, como `ExerciseThumbView` / `ExerciseThumb` en la app.
    <div className={cn("relative shrink-0 overflow-hidden rounded-[12px] bg-secondary", box, className)}>
      {showImage ? (
        <img
          src={fastImage(image, 192)}
          alt={name ?? ""}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(image)}
          className={cn("h-full w-full object-cover", completed && "opacity-70")}
        />
      ) : spec ? (
        <div className="h-full w-full p-1.5">
          <ExerciseMotionGlyph spec={spec} className={completed ? "opacity-60" : ""} />
        </div>
      ) : null}
      {/* Hecho: atenuada y con el check dorado (un solo dorado, como `WorkoutThumb` en la app). */}
      {completed && (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Check className="!size-5 text-primary" strokeWidth={2.75} />
        </span>
      )}
    </div>
  );
};

type Props = MotionProps & {
  video?: string | null;
  image?: string | null;
  name?: string | null;
  className?: string;
};

/**
 * Media principal de un ejercicio. Una sola regla de precedencia para toda la
 * app: vídeo (con la imagen de póster) → foto → huella de movimiento. Sin foto
 * ni vídeo se ve la huella (la de la ficha o la deducida), nunca un cuadro de
 * «próximamente». El contenedor es siempre 16:9 y con el mismo radio, así que
 * nunca hay saltos de layout. Si el ejercicio tiene foto y patrón, se cambia
 * entre las dos con una píldora discreta (igual que `hero` en la app).
 */
const ExerciseMedia = ({ video, image, name, pattern, stimulus, load, muscleGroup, className = "" }: Props) => {
  // Intro de marca de 1 s al reproducir (la «A» con el rayo latiendo sobre negro) y marca de agua fija.
  const [intro, setIntro] = useState(false);
  const rhythm = useMotion(name, { pattern, stimulus, load });
  const glyph = useGlyph(name, { pattern, stimulus, load, muscleGroup });
  const [photo, setPhoto] = useState(true);
  const [broken, setBroken] = useState<string | null>(null);

  if (video && isDirectFile(video)) {
    return (
      // El héroe es el vídeo con su portada: se ve al abrir la ficha y se
      // reproduce solo si el usuario pulsa play. Nunca en automático.
      <div className={cn("relative aspect-video w-full overflow-hidden rounded-media bg-background", className)}>
        <video
          src={video}
          poster={image ?? undefined}
          playsInline
          controls
          loop
          preload="metadata"
          onPlay={(e) => {
            if (e.currentTarget.currentTime > 0.2) return;
            setIntro(true);
            window.setTimeout(() => setIntro(false), 1000);
          }}
          className="h-full w-full object-cover"
        />
        <BrandMark size={18} className="pointer-events-none absolute bottom-3 right-3 opacity-60" />
        {intro && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background motion-safe:animate-fade-in">
            <BrandMark size={36} beat />
          </div>
        )}
      </div>
    );
  }

  if (video && toEmbedUrl(video)) return <VideoEmbed url={video} className={className} />;

  const usable = image && broken !== image ? image : null;
  const showPhoto = Boolean(usable) && (photo || !rhythm);

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-media bg-background", className)}>
      {showPhoto ? (
        // cover: mismo encuadre exacto que el vídeo, para que toda la biblioteca
        // se vea igual. El prompt de generación compone dentro de la banda 16:9,
        // así que este recorte no corta al atleta.
        <img src={fastImage(usable!, 1000)} alt={name ?? ""} loading="lazy" decoding="async" onError={() => setBroken(usable)} className="h-full w-full object-cover" />
      ) : (
        <ExerciseMotion spec={rhythm ?? glyph} className="p-3" />
      )}
      {rhythm && usable && (
        <div className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-full bg-secondary/90 p-0.5 backdrop-blur-sm">
          {[
            { label: "Ritmo", on: !showPhoto, show: () => setPhoto(false) },
            { label: "Foto", on: showPhoto, show: () => setPhoto(true) },
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
};

export default ExerciseMedia;
