import { memo, useState } from "react";
import { Check, Pause, Play } from "lucide-react";
import VideoEmbed, { toEmbedUrl } from "@/web/components/VideoEmbed";
import { cn } from "@/shared/lib/utils";
import { BrandMark } from "@/shared/components/ui/brand-mark";
import { fastImage, HERO_SIDE, THUMB_SIDE } from "@/shared/lib/fastImage";
import { loopUrl } from "@/shared/lib/exerciseLoop";
import { MuscleMap } from "@/app/components/MuscleMap";
import ExerciseLoop, { useLoopsAllowed } from "@/app/components/ExerciseLoop";

export const isDirectFile = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

/**
 * Datos de la ficha. La huella dibujada del patrón se retiró (9964e3ea): `pattern`, `stimulus` y
 * `load` se siguen aceptando para no romper llamadas, pero ya no cambian lo que se ve. El grupo
 * muscular sí: sin foto, el ejercicio se enseña con su músculo resaltado en la silueta.
 */
type MotionProps = {
  pattern?: string | null;
  stimulus?: string | null;
  load?: string | null;
  /** Grupo muscular: sin foto, la silueta con ese músculo en dorado (nunca un hueco vacío). */
  muscleGroup?: string | null;
};

/** El músculo del ejercicio en la silueta, para cuando no hay foto ni clip. */
const musclesOf = (muscleGroup: string | null | undefined) => (muscleGroup?.trim() ? [muscleGroup.trim()] : []);

/** Escala única de miniaturas. No inventar tamaños fuera de esta lista. */
const THUMB_SIZES = {
  xs: "h-8 w-8",
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
} as const;

/** Ancho de la silueta dentro de cada miniatura (alto ≈ 1,55 × ancho): cabe con aire. */
const SILHOUETTE = { xs: 15, sm: 19, md: 23, lg: 31, video: 30 } as const;

export type ExerciseThumbSize = keyof typeof THUMB_SIZES;

type ThumbProps = MotionProps & {
  image?: string | null;
  /** Clip de técnica: si lo hay, la miniatura se mueve en bucle (mudo, sin controles) sobre la foto. */
  video?: string | null;
  name?: string | null;
  size?: ExerciseThumbSize;
  /** "video" usa un marco 16:9 en vez del cuadrado. */
  aspect?: "square" | "video";
  /** Atenúa la miniatura cuando el ejercicio ya está completado (y la deja quieta). */
  completed?: boolean;
  className?: string;
};

/**
 * Miniatura de ejercicio. Única en toda la app: mismo tamaño, mismo radio y
 * mismo placeholder, tanto en administración como en usuario y entrenador.
 *
 * Qué se ve, en este orden: la foto (a 192 px, la misma petición en toda la app) → sin foto, la
 * silueta con su músculo en dorado. Nunca un cuadro vacío ni un icono suelto. Con clip de técnica,
 * el ejercicio se mueve encima en cuanto está en pantalla (`ExerciseLoop`); la foto nunca espera.
 * Igual que `ExerciseThumb` en la app (TrainView.swift).
 */
export const ExerciseThumb = memo(function ExerciseThumb({
  image,
  video,
  name,
  muscleGroup,
  size = "md",
  aspect = "square",
  completed = false,
  className = "",
}: ThumbProps) {
  const box = aspect === "video" ? "aspect-video w-28" : THUMB_SIZES[size];
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = image && broken !== image;
  const photo = showImage ? fastImage(image, THUMB_SIDE) : null;

  return (
    // 12 px, como `ExerciseThumbView` / `ExerciseThumb` en la app.
    <div className={cn("relative shrink-0 overflow-hidden rounded-[12px] bg-secondary", box, className)}>
      {photo ? (
        <img
          src={photo}
          alt={name ?? ""}
          loading="eager"
          decoding="async"
          onError={() => setBroken(image ?? null)}
          className={cn("h-full w-full object-cover", completed && "opacity-70")}
        />
      ) : (
        <span className={cn("flex h-full w-full items-center justify-center", completed && "opacity-60")}>
          <MuscleMap primary={musclesOf(muscleGroup)} size={SILHOUETTE[aspect === "video" ? "video" : size]} dots={false} />
        </span>
      )}
      {/* En movimiento sobre la foto; hecho, quieto (la atenuación y el check mandan). */}
      <ExerciseLoop src={video} poster={photo} paused={completed} />
      {/* Hecho: atenuada y con el check dorado (un solo dorado, como `WorkoutThumb` en la app). */}
      {completed && (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Check className="!size-5 text-primary" strokeWidth={2.75} />
        </span>
      )}
    </div>
  );
});

type Props = MotionProps & {
  video?: string | null;
  image?: string | null;
  name?: string | null;
  className?: string;
};

/**
 * Media principal de un ejercicio (la ficha de la biblioteca, la técnica desde Entrenar y la vista
 * previa de Admin). Una sola regla de precedencia para toda la app: el clip de técnica en bucle,
 * mudo y sin controles, sobre su foto → la foto (a 1000 px, la misma que el visor del entreno) →
 * sin foto ni vídeo, la silueta con su músculo en dorado, nunca un cuadro de «próximamente» ni un
 * hueco. El contenedor es siempre 16:9 y con el mismo radio, así que nunca hay saltos de layout.
 * Con «reducir movimiento» o ahorro de datos, la foto fija y «Ver vídeo» / «Parar vídeo» para verlo
 * solo si se pide. Igual que `ExerciseHeroMedia` en la app.
 */
const ExerciseMedia = ({ video, image, name, muscleGroup, className = "" }: Props) => {
  const loopsAllowed = useLoopsAllowed();
  const [broken, setBroken] = useState<string | null>(null);
  // «Ver vídeo» con «reducir movimiento» o ahorro de datos: el clip, solo porque se ha pedido.
  const [manual, setManual] = useState(false);

  const clip = loopUrl(video);
  // YouTube o Vimeo (los pega el admin): su reproductor, como siempre.
  if (video && !clip && !isDirectFile(video) && toEmbedUrl(video)) return <VideoEmbed url={video} className={className} />;

  const usable = image && broken !== image ? image : null;
  const still = usable ? fastImage(usable, HERO_SIDE) : null;

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-media bg-background", className)}>
      {still ? (
        // cover: mismo encuadre exacto que el vídeo, para que toda la biblioteca
        // se vea igual. El prompt de generación compone dentro de la banda 16:9,
        // así que este recorte no corta al atleta.
        <img src={still} alt={name ?? ""} loading="eager" decoding="async" onError={() => setBroken(usable)} className="h-full w-full object-cover" />
      ) : (
        // Sin foto todavía: el ejercicio por su músculo, en la silueta (como el héroe de la app).
        <div className="flex h-full w-full items-center justify-center bg-card py-3">
          <MuscleMap primary={musclesOf(muscleGroup)} size={84} />
        </div>
      )}
      {/* El ejercicio en movimiento sobre su foto (que hace de portada hasta el primer fotograma). */}
      {clip && <ExerciseLoop src={clip} poster={still} priority force={manual} />}
      {clip && <BrandMark size={18} className="pointer-events-none absolute bottom-3 right-3 opacity-60" />}
      {clip && !loopsAllowed && (
        // Con la foto fija, el clip solo si se pide (y se para igual).
        <button
          type="button"
          onClick={() => setManual((on) => !on)}
          aria-label={`${manual ? "Parar vídeo" : "Ver vídeo"} de técnica${name ? ` de ${name}` : ""}`}
          className="material absolute bottom-3 left-3 flex h-11 items-center gap-1.5 rounded-full pl-3.5 pr-4 type-footnote font-semibold text-foreground transition active:opacity-60"
        >
          {manual ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
          {manual ? "Parar vídeo" : "Ver vídeo"}
        </button>
      )}
    </div>
  );
};

export default ExerciseMedia;
