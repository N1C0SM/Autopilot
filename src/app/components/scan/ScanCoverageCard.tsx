import { Eye, EyeOff, Gauge } from "lucide-react";
import { FindingRow } from "@/app/components/scan/ScanResultParts";

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
    <section>
      <h2 className="type-title2">Cobertura del análisis</h2>
      <div className="mt-5 space-y-6">
        <FindingRow
          icon={Eye}
          iconClassName="text-muted-foreground"
          title="Vistas analizadas"
          description={views.length ? views.join(" + ") : "Ninguna"}
        />
        <FindingRow
          icon={Gauge}
          iconClassName="text-muted-foreground"
          title="Nivel de confianza"
          description={
            <>
              {level} {pct !== null && <span className={`${tone} tabular-nums`}>· {pct}%</span>}
            </>
          }
        />
        <FindingRow
          icon={EyeOff}
          iconClassName="text-muted-foreground"
          title="Sin valorar"
          description={
            <>
              {notEvaluated ?? "Nada relevante: tienes las dos vistas"}
              {notEvaluated && (
                <span className="mt-1.5 block type-footnote">
                  {hasBack
                    ? "Vista frontal no disponible: sube también la foto de delante para valorar pecho, abdomen y cuádriceps."
                    : "Vista trasera no disponible: sube también la foto de atrás para valorar espalda, glúteos e isquios."}
                </span>
              )}
            </>
          }
        />
      </div>
      {photoQualityNotes && photoQualityNotes.length > 0 && (
        <ul className="mt-4 space-y-1 pl-14 type-footnote text-muted-foreground">
          {photoQualityNotes.slice(0, 3).map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
