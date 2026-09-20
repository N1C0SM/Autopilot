import { Eye, EyeOff, Gauge } from "lucide-react";

type Props = {
  hasFront: boolean;
  hasBack: boolean;
  confidence?: number;
  photoQualityNotes?: string[];
};

const FRONT_ONLY_GAPS = "Espalda alta, dorsales, deltoides posterior, glúteos e isquios";
const BACK_ONLY_GAPS = "Pecho, abdomen, bíceps y cuádriceps";

export default function ScanCoverageCard({ hasFront, hasBack, confidence, photoQualityNotes }: Props) {
  const views = [hasFront && "Frontal", hasBack && "Trasera"].filter(Boolean) as string[];
  const level =
    views.length === 2 ? "Orientativo completo" : views.length === 1 ? "Orientativo parcial" : "Basado en respuestas";
  const notEvaluated = !hasBack ? FRONT_ONLY_GAPS : !hasFront ? BACK_ONLY_GAPS : null;
  const pct = typeof confidence === "number" ? Math.round(confidence) : views.length === 2 ? 75 : 55;
  const tone = pct >= 70 ? "text-success" : pct >= 45 ? "text-primary" : "text-destructive";

  return (
    <div className="max-w-3xl mx-auto mb-8 rounded-2xl border border-border bg-card/50 backdrop-blur p-5">
      <div className="grid sm:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            <Eye className="w-3.5 h-3.5 text-primary" /> Vistas analizadas
          </div>
          <div className="font-semibold">{views.length ? views.join(" + ") : "Ninguna"}</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            <Gauge className="w-3.5 h-3.5 text-primary" /> Nivel de confianza
          </div>
          <div className="font-semibold">
            {level} <span className={tone}>· {pct}%</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            <EyeOff className="w-3.5 h-3.5 text-primary" /> Sin valorar
          </div>
          <div className="text-muted-foreground text-[13px] leading-snug">
            {notEvaluated ?? "Nada relevante: tienes las dos vistas"}
          </div>
        </div>
      </div>
      {photoQualityNotes && photoQualityNotes.length > 0 && (
        <ul className="mt-4 pt-4 border-t border-border/60 space-y-1 text-[12px] text-muted-foreground">
          {photoQualityNotes.slice(0, 3).map((n, i) => (
            <li key={i}>· {n}</li>
          ))}
        </ul>
      )}
      {notEvaluated && (
        <p className="mt-4 pt-4 border-t border-border/60 text-[12px] text-muted-foreground">
          {hasBack
            ? "Vista frontal no disponible: sube también la foto de delante para valorar pecho, abdomen y cuádriceps."
            : "Vista trasera no disponible: sube también la foto de atrás para valorar espalda, glúteos e isquios."}
        </p>
      )}
    </div>
  );
}
