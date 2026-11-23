import { useMemo, useState } from "react";
import { Check, Pause, Play } from "lucide-react";
import VideoEmbed, { toEmbedUrl } from "@/web/components/VideoEmbed";
import { cn } from "@/shared/lib/utils";
import { BrandMark } from "@/shared/components/ui/brand-mark";
import { fastImage } from "@/shared/lib/fastImage";
import { exerciseMotion, exerciseMotionFor } from "@/shared/lib/exerciseMotion";
import { loopUrl } from "@/shared/lib/exerciseLoop";
import { ExerciseMotion, ExerciseMotionBadge, ExerciseMotionGlyph } from "@/app/components/ExerciseMotion";
import ExerciseLoop, { useLoopsAllowed } from "@/app/components/ExerciseLoop";

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
 * Qué se ve, en este orden: la foto → la huella de movimiento del ejercicio (su
 * patrón, su ritmo y su carga; sin patrón, la deducida del nombre y el grupo).
 * Nunca un cuadro vacío ni un icono suelto. Con clip de técnica, el ejercicio se
 * mueve encima en cuanto está en pantalla (`ExerciseLoop`); la foto nunca espera.
 */
export const ExerciseThumb = ({
  image,
  video,
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
  const photo = showImage ? fastImage(image, 192) : null;

  return (
    // 12 px, como `ExerciseThumbView` / `ExerciseThumb` en la app.
    <div className={cn("relative shrink-0 overflow-hidden rounded-[12px] bg-secondary", box, className)}>
      {showImage ? (
        <img
          src={fastImage(image, 192)}
          alt={name ?? ""}
          loading="eager"
          decoding="async"
          onError={() => setBroken(image)}
          className={cn("h-full w-full object-cover", completed && "opacity-70")}
        />
      ) : spec ? (
        <div className="h-full w-full p-1.5">
          <ExerciseMotionGlyph spec={spec} className={completed ? "opacity-60" : ""} />
        </div>
      ) : null}
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
};

type Props = MotionProps & {
  video?: string | null;
  image?: string | null;
  name?: string | null;
  className?: string;
};

/**
 * Media principal de un ejercicio (la ficha de la biblioteca, la técnica desde Entrenar y la vista
 * previa de Admin). Una sola regla de precedencia para toda la app: el clip de técnica en bucle,
 * mudo y sin controles, sobre su foto → la foto → la huella de movimiento. Sin foto ni vídeo se
 * ve la huella (la de la ficha o la deducida), nunca un cuadro de «próximamente». El contenedor
 * es siempre 16:9 y con el mismo radio, así que nunca hay saltos de layout. Si el ejercicio tiene
 * foto y patrón pero aún no clip, se cambia entre las dos con una píldora discreta (igual que
 * `hero` en la app). Con «reducir movimiento» o ahorro de datos, la foto fija y «Ver vídeo» /
 * «Parar vídeo» para verlo solo si se pide.
 */
const ExerciseMedia = ({ video, image, name, pattern, stimulus, load, muscleGroup, className = "" }: Props) => {
  const rhythm = useMotion(name, { pattern, stimulus, load });
  const glyph = useGlyph(name, { pattern, stimulus, load, muscleGroup });
  const loopsAllowed = useLoopsAllowed();
  const [photo, setPhoto] = useState(true);
  const [broken, setBroken] = useState<string | null>(null);
  // «Ver vídeo» con «reducir movimiento» o ahorro de datos: el clip, solo porque se ha pedido.
  const [manual, setManual] = useState(false);

  const clip = loopUrl(video);
  // YouTube o Vimeo (los pega el admin): su reproductor, como siempre.
  if (video && !clip && !isDirectFile(video) && toEmbedUrl(video)) return <VideoEmbed url={video} className={className} />;

  const usable = image && broken !== image ? image : null;
  const still = usable ? fastImage(usable, 1000) : null;
  const showPhoto = Boolean(usable) && (photo || !rhythm || Boolean(clip));

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-media bg-background", className)}>
      {showPhoto ? (
        // cover: mismo encuadre exacto que el vídeo, para que toda la biblioteca
        // se vea igual. El prompt de generación compone dentro de la banda 16:9,
        // así que este recorte no corta al atleta.
        <img src={still!} alt={name ?? ""} loading="eager" decoding="async" onError={() => setBroken(usable)} className="h-full w-full object-cover" />
      ) : (
        <ExerciseMotion spec={rhythm ?? glyph} className="p-3" />
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
      {/* Sin clip ni patrón propio: la foto con la huella dorada en una esquina (como el visor del entreno). */}
      {!clip && !rhythm && usable && glyph && <ExerciseMotionBadge spec={glyph} className="absolute bottom-3 left-3" />}
      {!clip && rhythm && usable && (
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
