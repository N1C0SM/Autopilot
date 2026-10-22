import { useId } from "react";
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

/** Polígono → contorno curvo cerrado (Catmull-Rom a Bézier): formas orgánicas, sin picos. */
export function smoothPath(points: string, tension = 0.5): string {
  const n = points.trim().split(/\s+/).map(Number);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
  if (pts.length < 3) return "";
  const at = (i: number) => pts[(i + pts.length) % pts.length];
  const r = (v: number) => Math.round(v * 100) / 100;
  let d = `M${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const k = tension / 3;
    d += ` C${r(p1[0] + (p2[0] - p0[0]) * k)} ${r(p1[1] + (p2[1] - p0[1]) * k)} ${r(p2[0] - (p3[0] - p1[0]) * k)} ${r(p2[1] - (p3[1] - p1[1]) * k)} ${r(p2[0])} ${r(p2[1])}`;
  }
  return `${d}Z`;
}

const smoothCache = new Map<string, string>();
const smooth = (points: string) => {
  let d = smoothCache.get(points);
  if (d === undefined) { d = smoothPath(points); smoothCache.set(points, d); }
  return d;
};

/**
 * Cuerpo con volumen: cada zona es una forma curva con degradado de luz (arriba más clara),
 * las trabajadas en el color de su intensidad con un brillo suave.
 */
export function MuscleMapFigure({ side, muscles, intensityFor }: Props) {
  const owner = regionMuscles(muscles);
  const worked = [...new Set(owner.values())];
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="-2 -2 104 204"
      role="img"
      aria-label={`${side === "front" ? "Mapa muscular frontal" : "Mapa muscular posterior"}: ${worked.join(", ") || "sin zonas destacadas"}`}
      className="h-full w-full overflow-visible"
    >
      <defs>
        {/* Luz cenital: la parte de arriba de cada músculo brilla un poco más. */}
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Silueta continua: rellena los huecos entre zonas y las une en un solo cuerpo. */}
      <g opacity="0.1" className="fill-foreground stroke-foreground" strokeWidth="3.2" strokeLinejoin="round">
        {bodyRegions(side).flatMap((region) => region.svgPoints.map((points, index) => (
          <path key={`${region.muscle}-${index}`} d={smooth(points)} />
        )))}
      </g>
      {/* Músculos sin trabajar: un tono más claro, la silueta hace de separación. */}
      <g opacity="0.14" className="fill-foreground">
        {bodyRegions(side).flatMap((region) => owner.has(region.muscle) ? [] : region.svgPoints.map((points, index) => (
          <path key={`${region.muscle}-${index}`} d={smooth(points)} />
        )))}
      </g>
      {bodyRegions(side).flatMap((region) => {
        const muscle = owner.get(region.muscle);
        if (!muscle) return [];
        return region.svgPoints.map((points, index) => (
          <path
            key={`${region.muscle}-${index}`}
            d={smooth(points)}
            className="transition-[fill] duration-300"
            style={{ fill: intensityFor(muscle), filter: `url(#${id}-glow)` }}
          />
        ));
      })}
      {/* Volumen: luz cenital sobre todas las zonas. */}
      <g pointerEvents="none">
        {bodyRegions(side).flatMap((region) => region.svgPoints.map((points, index) => (
          <path key={`${region.muscle}-${index}`} d={smooth(points)} fill={`url(#${id}-shade)`} />
        )))}
      </g>
    </svg>
  );
}
