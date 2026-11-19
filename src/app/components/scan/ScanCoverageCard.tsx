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

/** «Cobertura del análisis»: qué vistas se valoraron y con qué confianza, en un grupo sin borde. */
export default function ScanCoverageCard({ hasFront, hasBack, confidence, photoQualityNotes }: Props) {
  const views = [hasFront && "Frontal", hasBack && "Trasera"].filter(Boolean) as string[];
  const level =
    views.length === 2 ? "Orientativo completo" : views.length === 1 ? "Orientativo parcial" : "Basado en respuestas";
  const notEvaluated = !hasBack ? FRONT_ONLY_GAPS : !hasFront ? BACK_ONLY_GAPS : null;
  // Solo mostramos un porcentaje cuando la IA lo devuelve de verdad: nunca inventamos la cifra.
  const hasConfidence = typeof confidence === "number" && Number.isFinite(confidence);
  const pct = hasConfidence ? Math.round(confidence as number) : null;

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="type-title3">Cobertura del análisis</h2>
      <div className="flex flex-col gap-5 rounded-card bg-card p-4">
        <FindingRow
          icon={Eye}
          iconClassName="text-muted-foreground"
          title="Vistas analizadas"
          description={views.length ? views.join(" + ") : "Las de tus respuestas"}
        />
        <FindingRow
          icon={Gauge}
          iconClassName="text-muted-foreground"
          title="Nivel de confianza"
          description={
            <>
              {level}
              {pct !== null && <span className={`tabular-nums ${pct >= 70 ? "text-primary" : ""}`}> · {pct} %</span>}
            </>
          }
        />
        <FindingRow
          icon={EyeOff}
          iconClassName="text-muted-foreground"
          title={notEvaluated ? "Para la próxima vez" : "Cobertura completa"}
          description={
            notEvaluated ? (
              <>
                {hasBack
                  ? "Añade también la foto de delante para valorar pecho, abdomen y cuádriceps."
                  : "Añade también la foto de atrás para valorar espalda, glúteos e isquios."}
                <span className="mt-1 block type-footnote">Esta vez sin valorar: {notEvaluated.toLowerCase()}.</span>
              </>
            ) : "Tienes las dos vistas: se ha valorado todo lo visible."
          }
        />
        {photoQualityNotes && photoQualityNotes.length > 0 && (
          <ul className="flex flex-col gap-1 pl-12 type-footnote text-muted-foreground">
            {photoQualityNotes.slice(0, 3).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
