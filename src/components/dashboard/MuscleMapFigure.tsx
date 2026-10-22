import { anteriorData, posteriorData, type BodyRegion } from "@/assets/bodyMapData";

export type MuscleSide = "front" | "back";

interface Props {
  side: MuscleSide;
  muscles: string[];
  intensityFor: (muscle: string) => string;
}

/** Nombres de la app → zonas del modelo vectorial. Una zona puede cubrir varios grupos. */
const MUSCLE_REGIONS: Record<string, string[]> = {
  Pecho: ["chest"],
  Hombros: ["front_deltoids", "back_deltoids"],
  Bíceps: ["biceps"],
  Tríceps: ["triceps"],
  Antebrazos: ["forearm"],
  Core: ["abs", "obliques"],
  Abdominales: ["abs", "obliques"],
  Serrato: ["obliques"],
  Espalda: ["upper_back"],
  Dorsales: ["upper_back"],
  Romboides: ["upper_back"],
  Trapecios: ["trapezius"],
  Lumbares: ["lower_back"],
  Glúteos: ["gluteal"],
  Isquiotibiales: ["hamstring"],
  Piernas: ["quadriceps", "hamstring"],
  Cuádriceps: ["quadriceps"],
  Gemelos: ["calves", "left_soleus", "right_soleus"],
  Aductores: ["adductor"],
  Abductores: ["abductors"],
  Cuello: ["neck"],
};

export const bodyRegions = (side: MuscleSide): BodyRegion[] => (side === "front" ? anteriorData : posteriorData);

/** Músculo de la app que colorea cada zona (el primero de la lista que la cubre). */
export function regionMuscles(muscles: string[]): Map<string, string> {
  const owner = new Map<string, string>();
  for (const muscle of muscles) {
    for (const region of MUSCLE_REGIONS[muscle] ?? []) if (!owner.has(region)) owner.set(region, muscle);
  }
  return owner;
}

/**
 * Cuerpo vectorial plano, como los mapas de Hevy o Fitness: zonas sin trabajar en gris,
 * las trabajadas con el color de su intensidad.
 */
export function MuscleMapFigure({ side, muscles, intensityFor }: Props) {
  const owner = regionMuscles(muscles);
  const worked = [...new Set(owner.values())];
  return (
    <svg
      viewBox="0 0 100 200"
      role="img"
      aria-label={`${side === "front" ? "Mapa muscular frontal" : "Mapa muscular posterior"}: ${worked.join(", ") || "sin zonas destacadas"}`}
      className="h-full w-full"
    >
      {bodyRegions(side).map((region) => {
        const muscle = owner.get(region.muscle);
        return region.svgPoints.map((points, index) => (
          <polygon
            key={`${region.muscle}-${index}`}
            points={points}
            className={muscle ? "transition-[fill] duration-300" : "fill-foreground/[0.16]"}
            style={muscle ? { fill: intensityFor(muscle) } : undefined}
          />
        ));
      })}
    </svg>
  );
}
