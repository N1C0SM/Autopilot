/**
 * MuscleMap — SVG anatomical body map that highlights primary and secondary
 * muscles. Front/back views flip automatically based on the active muscle.
 *
 * Usage:
 *   <MuscleMap primary={["Pecho"]} synergists={["Tríceps","Hombros"]} />
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Which view each muscle group lives on
const BACK_MUSCLES = new Set([
  "Espalda", "Trapecios", "Romboides", "Lumbares",
  "Isquiotibiales", "Glúteos", "Gemelos",
]);

type MuscleId =
  | "f-chest-l" | "f-chest-r"
  | "f-shoulder-l" | "f-shoulder-r"
  | "f-bicep-l" | "f-bicep-r"
  | "f-tricep-l" | "f-tricep-r"
  | "f-quad-l" | "f-quad-r"
  | "f-core"
  | "f-lat-l" | "f-lat-r"
  | "b-trap"
  | "b-shoulder-l" | "b-shoulder-r"
  | "b-lat-l" | "b-lat-r"
  | "b-lower"
  | "b-tricep-l" | "b-tricep-r"
  | "b-glute-l" | "b-glute-r"
  | "b-ham-l" | "b-ham-r"
  | "b-calf-l" | "b-calf-r"
  | "b-bicep-l" | "b-bicep-r";

const MUSCLE_IDS: Record<string, { ids: MuscleId[]; view: "front" | "back" }> = {
  "Pecho":          { ids: ["f-chest-l", "f-chest-r"],              view: "front" },
  "Hombros":        { ids: ["f-shoulder-l", "f-shoulder-r"],        view: "front" },
  "Bíceps":         { ids: ["f-bicep-l", "f-bicep-r"],              view: "front" },
  "Tríceps":        { ids: ["f-tricep-l", "f-tricep-r"],            view: "front" },
  "Piernas":        { ids: ["f-quad-l", "f-quad-r"],                view: "front" },
  "Core":           { ids: ["f-core"],                              view: "front" },
  "Aductores":      { ids: ["f-quad-l", "f-quad-r"],                view: "front" },
  "Abductores":     { ids: ["f-quad-l", "f-quad-r"],                view: "front" },
  "Antebrazos":     { ids: ["f-bicep-l", "f-bicep-r"],              view: "front" },
  "Espalda":        { ids: ["b-lat-l", "b-lat-r", "b-lower"],       view: "back"  },
  "Trapecios":      { ids: ["b-trap"],                              view: "back"  },
  "Romboides":      { ids: ["b-lat-l", "b-lat-r"],                  view: "back"  },
  "Lumbares":       { ids: ["b-lower"],                             view: "back"  },
  "Glúteos":        { ids: ["b-glute-l", "b-glute-r"],              view: "back"  },
  "Isquiotibiales": { ids: ["b-ham-l", "b-ham-r"],                  view: "back"  },
  "Gemelos":        { ids: ["b-calf-l", "b-calf-r"],                view: "back"  },
  "Serrato":        { ids: ["f-lat-l", "f-lat-r"],                  view: "front" },
};

function resolveView(primary: string[], synergists: string[]): "front" | "back" {
  // Determine view by primary muscles; fall back to synergists
  for (const m of [...primary, ...synergists]) {
    const cfg = MUSCLE_IDS[m];
    if (cfg) return cfg.view;
  }
  return "front";
}

function getMuscleIds(muscles: string[]): MuscleId[] {
  return muscles.flatMap((m) => MUSCLE_IDS[m]?.ids ?? []);
}

// ─── SVG paths ────────────────────────────────────────────────────────────────

const BASE = "#1e1e22";
const DIM  = "#181818";

const FrontBody = ({
  highlighted,
  secondary,
}: {
  highlighted: Set<MuscleId>;
  secondary: Set<MuscleId>;
}) => {
  const fill = (id: MuscleId) => {
    if (highlighted.has(id)) return "hsl(var(--primary))";
    if (secondary.has(id)) return "hsl(var(--primary) / 0.45)";
    return BASE;
  };
  const glow = (id: MuscleId) =>
    highlighted.has(id)
      ? "drop-shadow(0 0 8px hsl(var(--primary) / 0.8)) drop-shadow(0 0 3px hsl(var(--primary)))"
      : secondary.has(id)
      ? "drop-shadow(0 0 4px hsl(var(--primary) / 0.4))"
      : "none";

  return (
    <svg viewBox="0 0 200 310" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="body-shadow" x="-15%" y="-10%" width="130%" height="120%">
          <feDropShadow dx="1" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Head */}
      <ellipse cx="100" cy="22" rx="18" ry="20" fill="#252528" filter="url(#body-shadow)" />
      <rect x="93" y="38" width="14" height="14" rx="4" fill="#222225" />

      {/* Shoulders */}
      <ellipse id="f-shoulder-l" cx="66" cy="72" rx="16" ry="18"
        fill={fill("f-shoulder-l")} filter="url(#body-shadow)"
        style={{ filter: glow("f-shoulder-l"), transition: "fill 0.4s, filter 0.4s" }} />
      <ellipse id="f-shoulder-r" cx="134" cy="72" rx="16" ry="18"
        fill={fill("f-shoulder-r")} filter="url(#body-shadow)"
        style={{ filter: glow("f-shoulder-r"), transition: "fill 0.4s, filter 0.4s" }} />

      {/* Chest L */}
      <path id="f-chest-l"
        d="M100,58 C84,60 66,65 62,82 C58,96 64,108 80,109 C90,110 98,104 100,96 Z"
        fill={fill("f-chest-l")} filter="url(#body-shadow)"
        style={{ filter: glow("f-chest-l"), transition: "fill 0.4s, filter 0.4s" }} />
      {/* Chest R */}
      <path id="f-chest-r"
        d="M100,58 C116,60 134,65 138,82 C142,96 136,108 120,109 C110,110 102,104 100,96 Z"
        fill={fill("f-chest-r")} filter="url(#body-shadow)"
        style={{ filter: glow("f-chest-r"), transition: "fill 0.4s, filter 0.4s" }} />
      <line x1="100" y1="58" x2="100" y2="109" stroke="#111" strokeWidth="1.5" />

      {/* Lat sides (front visible) */}
      <path id="f-lat-l" d="M66,80 C60,98 60,125 64,154 L76,154 C72,126 70,100 74,82 Z"
        fill={fill("f-lat-l")} style={{ transition: "fill 0.4s" }} />
      <path id="f-lat-r" d="M134,80 C140,98 140,125 136,154 L124,154 C128,126 130,100 126,82 Z"
        fill={fill("f-lat-r")} style={{ transition: "fill 0.4s" }} />

      {/* Abs / Core */}
      {[0, 1, 2].map((row) =>
        [-1, 0].map((col) => (
          <rect
            key={`${row}-${col}`}
            id={row === 0 && col === -1 ? "f-core" : undefined}
            x={96 + col * 14}
            y={111 + row * 18}
            width={12}
            height={14}
            rx={3}
            fill={fill("f-core")}
            style={{ filter: glow("f-core"), transition: "fill 0.4s, filter 0.4s" }}
          />
        ))
      )}

      {/* Obliques */}
      <path d="M83,111 C74,124 72,142 74,158 L82,158 C80,142 80,124 85,111 Z" fill={DIM} />
      <path d="M117,111 C126,124 128,142 126,158 L118,158 C120,142 120,124 115,111 Z" fill={DIM} />

      {/* Hips */}
      <path d="M76,156 C70,162 68,170 70,176 L130,176 C132,170 130,162 124,156 Z" fill={DIM} />

      {/* Biceps L */}
      <path id="f-bicep-l"
        d="M58,84 C50,94 46,114 48,132 C50,138 56,140 62,138 C68,136 70,130 68,122 C66,112 62,96 58,84 Z"
        fill={fill("f-bicep-l")} filter="url(#body-shadow)"
        style={{ filter: glow("f-bicep-l"), transition: "fill 0.4s, filter 0.4s" }} />
      {/* Biceps R */}
      <path id="f-bicep-r"
        d="M142,84 C150,94 154,114 152,132 C150,138 144,140 138,138 C132,136 130,130 132,122 C134,112 138,96 142,84 Z"
        fill={fill("f-bicep-r")} filter="url(#body-shadow)"
        style={{ filter: glow("f-bicep-r"), transition: "fill 0.4s, filter 0.4s" }} />

      {/* Triceps front (small visible strip) */}
      <path id="f-tricep-l"
        d="M56,86 C50,96 48,110 50,126 C52,130 56,130 60,128 C60,114 60,98 62,86 Z"
        fill={fill("f-tricep-l")} style={{ transition: "fill 0.4s" }} />
      <path id="f-tricep-r"
        d="M144,86 C150,96 152,110 150,126 C148,130 144,130 140,128 C140,114 140,98 138,86 Z"
        fill={fill("f-tricep-r")} style={{ transition: "fill 0.4s" }} />

      {/* Forearms */}
      <path d="M48,134 C44,150 46,170 50,177 C53,181 59,181 63,177 C66,170 67,150 62,134 Z" fill={DIM} />
      <path d="M152,134 C156,150 154,170 150,177 C147,181 141,181 137,177 C134,170 133,150 138,134 Z" fill={DIM} />

      {/* Quads L */}
      <path id="f-quad-l"
        d="M80,176 C70,190 66,222 68,250 C70,260 78,264 90,262 C98,260 100,252 100,242 L100,176 Z"
        fill={fill("f-quad-l")} filter="url(#body-shadow)"
        style={{ filter: glow("f-quad-l"), transition: "fill 0.4s, filter 0.4s" }} />
      {/* Quads R */}
      <path id="f-quad-r"
        d="M120,176 C130,190 134,222 132,250 C130,260 122,264 110,262 C102,260 100,252 100,242 L100,176 Z"
        fill={fill("f-quad-r")} filter="url(#body-shadow)"
        style={{ filter: glow("f-quad-r"), transition: "fill 0.4s, filter 0.4s" }} />
      <line x1="100" y1="176" x2="100" y2="242" stroke="#111" strokeWidth="1.2" />

      {/* Knees */}
      <ellipse cx="84" cy="264" rx="10" ry="7" fill="#161618" />
      <ellipse cx="116" cy="264" rx="10" ry="7" fill="#161618" />

      {/* Calves front */}
      <path d="M74,270 C70,286 72,304 76,312 C79,316 86,316 90,312 C93,307 94,292 92,278 C90,271 84,270 74,270 Z" fill={DIM} />
      <path d="M126,270 C130,286 128,304 124,312 C121,316 114,316 110,312 C107,307 106,292 108,278 C110,271 116,270 126,270 Z" fill={DIM} />
    </svg>
  );
};

const BackBody = ({
  highlighted,
  secondary,
}: {
  highlighted: Set<MuscleId>;
  secondary: Set<MuscleId>;
}) => {
  const fill = (id: MuscleId) => {
    if (highlighted.has(id)) return "hsl(var(--primary))";
    if (secondary.has(id)) return "hsl(var(--primary) / 0.45)";
    return BASE;
  };
  const glow = (id: MuscleId) =>
    highlighted.has(id)
      ? "drop-shadow(0 0 8px hsl(var(--primary) / 0.8)) drop-shadow(0 0 3px hsl(var(--primary)))"
      : secondary.has(id)
      ? "drop-shadow(0 0 4px hsl(var(--primary) / 0.4))"
      : "none";

  return (
    <svg viewBox="0 0 200 310" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="body-shadow-b" x="-15%" y="-10%" width="130%" height="120%">
          <feDropShadow dx="1" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Head */}
      <ellipse cx="100" cy="22" rx="18" ry="20" fill="#252528" filter="url(#body-shadow-b)" />
      <rect x="93" y="38" width="14" height="14" rx="4" fill="#222225" />

      {/* Traps */}
      <path id="b-trap"
        d="M84,42 C76,48 66,56 62,70 L80,74 C84,64 92,58 100,56 C108,58 116,64 120,74 L138,70 C134,56 124,48 116,42 Z"
        fill={fill("b-trap")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-trap"), transition: "fill 0.4s, filter 0.4s" }} />

      {/* Shoulders back */}
      <ellipse id="b-shoulder-l" cx="62" cy="76" rx="18" ry="16"
        fill={fill("b-shoulder-l")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-shoulder-l"), transition: "fill 0.4s, filter 0.4s" }} />
      <ellipse id="b-shoulder-r" cx="138" cy="76" rx="18" ry="16"
        fill={fill("b-shoulder-r")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-shoulder-r"), transition: "fill 0.4s, filter 0.4s" }} />

      {/* Lats L */}
      <path id="b-lat-l"
        d="M66,82 C56,96 54,120 58,148 C60,158 68,162 78,160 C86,158 88,150 86,136 C84,118 76,100 66,82 Z"
        fill={fill("b-lat-l")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-lat-l"), transition: "fill 0.4s, filter 0.4s" }} />
      {/* Lats R */}
      <path id="b-lat-r"
        d="M134,82 C144,96 146,120 142,148 C140,158 132,162 122,160 C114,158 112,150 114,136 C116,118 124,100 134,82 Z"
        fill={fill("b-lat-r")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-lat-r"), transition: "fill 0.4s, filter 0.4s" }} />

      {/* Lower back / spinal erectors */}
      <path id="b-lower"
        d="M86,82 C82,104 80,132 82,158 L100,162 L118,158 C120,132 118,104 114,82 C110,78 90,78 86,82 Z"
        fill={fill("b-lower")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-lower"), transition: "fill 0.4s, filter 0.4s" }} />
      <line x1="100" y1="56" x2="100" y2="162" stroke="#111" strokeWidth="1.5" />

      {/* Triceps back L */}
      <path id="b-tricep-l"
        d="M54,88 C46,100 44,120 46,138 C48,144 54,146 60,144 C66,142 68,136 66,128 C64,116 58,100 54,88 Z"
        fill={fill("b-tricep-l")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-tricep-l"), transition: "fill 0.4s, filter 0.4s" }} />
      {/* Triceps back R */}
      <path id="b-tricep-r"
        d="M146,88 C154,100 156,120 154,138 C152,144 146,146 140,144 C134,142 132,136 134,128 C136,116 142,100 146,88 Z"
        fill={fill("b-tricep-r")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-tricep-r"), transition: "fill 0.4s, filter 0.4s" }} />

      {/* Biceps back (small visible) */}
      <path id="b-bicep-l" d="M60,86 C56,96 56,108 58,120 C60,124 64,124 66,120 C64,110 62,96 64,86 Z"
        fill={fill("b-bicep-l")} style={{ transition: "fill 0.4s" }} />
      <path id="b-bicep-r" d="M140,86 C144,96 144,108 142,120 C140,124 136,124 134,120 C136,110 138,96 136,86 Z"
        fill={fill("b-bicep-r")} style={{ transition: "fill 0.4s" }} />

      {/* Forearms back */}
      <path d="M46,140 C42,156 44,174 48,181 C51,185 57,185 61,181 C64,174 65,156 60,140 Z" fill={DIM} />
      <path d="M154,140 C158,156 156,174 152,181 C149,185 143,185 139,181 C136,174 135,156 140,140 Z" fill={DIM} />

      {/* Glutes L */}
      <path id="b-glute-l"
        d="M82,162 C72,168 68,180 70,194 C72,204 80,210 92,208 C100,206 102,198 100,186 L100,162 Z"
        fill={fill("b-glute-l")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-glute-l"), transition: "fill 0.4s, filter 0.4s" }} />
      {/* Glutes R */}
      <path id="b-glute-r"
        d="M118,162 C128,168 132,180 130,194 C128,204 120,210 108,208 C100,206 98,198 100,186 L100,162 Z"
        fill={fill("b-glute-r")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-glute-r"), transition: "fill 0.4s, filter 0.4s" }} />
      <line x1="100" y1="162" x2="100" y2="208" stroke="#111" strokeWidth="1.2" />

      {/* Hamstrings L */}
      <path id="b-ham-l"
        d="M80,210 C70,224 68,248 70,264 C72,272 80,276 90,274 C98,272 100,264 100,256 L100,210 Z"
        fill={fill("b-ham-l")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-ham-l"), transition: "fill 0.4s, filter 0.4s" }} />
      {/* Hamstrings R */}
      <path id="b-ham-r"
        d="M120,210 C130,224 132,248 130,264 C128,272 120,276 110,274 C102,272 100,264 100,256 L100,210 Z"
        fill={fill("b-ham-r")} filter="url(#body-shadow-b)"
        style={{ filter: glow("b-ham-r"), transition: "fill 0.4s, filter 0.4s" }} />
      <line x1="100" y1="210" x2="100" y2="256" stroke="#111" strokeWidth="1.2" />

      {/* Knees back */}
      <ellipse cx="84" cy="276" rx="10" ry="7" fill="#161618" />
      <ellipse cx="116" cy="276" rx="10" ry="7" fill="#161618" />

      {/* Calves back */}
      <path id="b-calf-l"
        d="M74,282 C70,298 72,314 76,320 C79,324 86,324 90,320 C93,315 94,300 92,286 C90,279 84,282 74,282 Z"
        fill={fill("b-calf-l")} style={{ filter: glow("b-calf-l"), transition: "fill 0.4s, filter 0.4s" }} />
      <path id="b-calf-r"
        d="M126,282 C130,298 128,314 124,320 C121,324 114,324 110,320 C107,315 106,300 108,286 C110,279 116,282 126,282 Z"
        fill={fill("b-calf-r")} style={{ filter: glow("b-calf-r"), transition: "fill 0.4s, filter 0.4s" }} />
    </svg>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

interface MuscleMapProps {
  /** Primary muscles (fully highlighted) */
  primary: string[];
  /** Synergist muscles (dimly highlighted) */
  synergists?: string[];
  className?: string;
  /** Size in px of the SVG container */
  size?: number;
}

export function MuscleMap({ primary, synergists = [], className = "", size = 160 }: MuscleMapProps) {
  const targetView = resolveView(primary, synergists);
  const [view, setView] = useState<"front" | "back">(targetView);
  const [flipping, setFlipping] = useState(false);
  const prevViewRef = useRef(targetView);

  // Flip when targeted view changes
  useEffect(() => {
    if (targetView === prevViewRef.current) return;
    prevViewRef.current = targetView;
    setFlipping(true);
    const timer = setTimeout(() => {
      setView(targetView);
      setFlipping(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [targetView]);

  const primaryIds = new Set(getMuscleIds(primary) as MuscleId[]);
  const synergistIds = new Set(
    getMuscleIds(synergists).filter((id) => !primaryIds.has(id as MuscleId)) as MuscleId[]
  );

  const viewLabel = view === "front" ? "Vista frontal" : "Vista trasera";

  return (
    <div
      className={`relative flex flex-col items-center gap-2 ${className}`}
      role="img"
      aria-label={`Mapa muscular – ${primary.join(", ")} (${viewLabel})`}
    >
      <motion.div
        animate={{ opacity: flipping ? 0 : 1, scaleX: flipping ? 0.05 : 1 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: size, height: size * 1.55 }}
      >
        {view === "front" ? (
          <FrontBody highlighted={primaryIds} secondary={synergistIds} />
        ) : (
          <BackBody highlighted={primaryIds} secondary={synergistIds} />
        )}
      </motion.div>

      {/* View indicator dots */}
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${view === "front" ? "bg-primary" : "bg-muted-foreground/30"}`} />
        <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${view === "back"  ? "bg-primary" : "bg-muted-foreground/30"}`} />
      </div>
    </div>
  );
}

export default MuscleMap;
