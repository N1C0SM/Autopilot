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
  // Solo mostramos un porcentaje cuando la IA lo devuelve de verdad: nunca inventamos la cifra.
  const hasConfidence = typeof confidence === "number" && Number.isFinite(confidence);
  const pct = hasConfidence ? Math.round(confidence as number) : null;
  const tone = pct === null ? "text-muted-foreground" : pct >= 70 ? "text-success" : pct >= 45 ? "text-primary" : "text-destructive";

  return (
    <section className="max-w-3xl mx-auto mb-8 px-4 space-y-6">
      <div className="flex items-start gap-4">
        <Eye className="w-7 h-7 text-primary shrink-0" strokeWidth={1.75} />
        <div className="min-w-0">
          <div className="type-headline">Vistas analizadas</div>
          <div className="type-subhead text-muted-foreground">{views.length ? views.join(" + ") : "Ninguna"}</div>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <Gauge className="w-7 h-7 text-primary shrink-0" strokeWidth={1.75} />
        <div className="min-w-0">
          <div className="type-headline">Nivel de confianza</div>
          <div className="type-subhead text-muted-foreground">
            {level} {pct !== null && <span className={`${tone} tabular-nums`}>· {pct}%</span>}
          </div>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <EyeOff className="w-7 h-7 text-primary shrink-0" strokeWidth={1.75} />
        <div className="min-w-0">
          <div className="type-headline">Sin valorar</div>
          <div className="type-subhead text-muted-foreground">
            {notEvaluated ?? "Nada relevante: tienes las dos vistas"}
          </div>
        </div>
      </div>
      {photoQualityNotes && photoQualityNotes.length > 0 && (
        <ul className="space-y-1 type-footnote text-muted-foreground">
          {photoQualityNotes.slice(0, 3).map((n, i) => (
            <li key={i}>· {n}</li>
          ))}
        </ul>
      )}
      {notEvaluated && (
        <p className="type-footnote text-muted-foreground">
          {hasBack
            ? "Vista frontal no disponible: sube también la foto de delante para valorar pecho, abdomen y cuádriceps."
            : "Vista trasera no disponible: sube también la foto de atrás para valorar espalda, glúteos e isquios."}
        </p>
      )}
    </section>
  );
}
