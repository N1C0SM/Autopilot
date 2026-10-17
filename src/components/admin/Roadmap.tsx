import { useState } from "react";
import { Info } from "lucide-react";

// Roadmap copied from https://roadmap-wizardry-76.lovable.app
const ROADMAP_DATA = [
  {
    phase: "FASE 1",
    title: "Lanzamiento y consolidación del producto",
    progress: 10,
    version: "v1.0",
    items: [
      "Rutinas personalizadas",
      "Seguimiento de series, repeticiones y pesos",
      "Sobrecarga progresiva y cálculo de la siguiente carga",
      "Scan, parte central de la propuesta",
      "Perfil, objetivos y nutrición básica existente",
      "Plan Free y preparación de Plus",
      "Estabilidad, privacidad y publicación en App Store",
    ],
  },
  {
    phase: "FASE 1",
    title: "Nutrición completa",
    progress: 10,
    version: "v1.1",
    items: [
      "Objetivos de calorías y macronutrientes",
      "Registro de comidas",
      "Análisis de alimentos mediante fotografías con IA",
      "Estimación de proteínas, carbohidratos y grasas",
      "Nutrición adaptada a los objetivos",
      "Fotografiar nevera y despensa",
      "Reconocimiento de alimentos e inventario editable",
    ],
  },
  {
    phase: "FASE 1",
    title: "Inteligencia de mercado",
    progress: 0,
    version: "v1.2",
    items: [
      "Recomendaciones adaptadas a los objetivos",
      "Lista de ingredientes que faltan",
      "Elegir supermercado",
      "Estimar el precio total de la compra",
      "Desglosar precios y cantidades",
      "Comparar alternativas económicas",
      "Ajustar la compra a un presupuesto",
    ],
  },
  {
    phase: "FASE 1",
    title: "Recordatorios y widgets",
    progress: 0,
    version: "v1.3",
    items: [
      "Recordatorios de entrenamiento y comidas",
      "Historial y estadísticas mejoradas",
      "Face ID / Touch ID",
      "Ajustes de privacidad",
      "Widgets para iOS",
      "Accesos rápidos a rutinas y progreso",
      "Interacciones compatibles con los widgets",
    ],
  },
  {
    phase: "FASE 1",
    title: "Calendarios y salud",
    progress: 0,
    version: "v1.4",
    items: [
      "Apple Calendar",
      "Google Calendar",
      "Programación de entrenamientos",
      "Actualización de eventos y prevención de duplicados",
      "Apple Health",
      "Withings: peso y métricas compatibles",
      "Garmin y fuentes compatibles",
    ],
  },
  {
    phase: "FASE 2",
    title: "Inteligencia integrada",
    progress: 0,
    version: "v1.5",
    items: [
      "Conexión entre entrenamiento, nutrición y actividad",
      "Recomendaciones basadas en los datos disponibles",
      "Planificación coordinada de la semana",
      "Experiencia unificada",
      "Ajuste de rutinas según el rendimiento",
      "Plan semanal coordinado",
      "Tendencias, hitos, estadísticas",
    ],
  },
  {
    phase: "FASE 3",
    title: "Análisis físico avanzado",
    progress: 0,
    version: "v1.6",
    items: [
      "Evolución del Scan y seguimiento físico",
      "Registro y comparación temporal de fotografías",
      "Visualizaciones del progreso",
      "Registro de medidas corporales",
      "Mejoras en el reconocimiento visual",
      "Comparación con objetivos",
      "Historial visual organizado",
    ],
  },
  {
    phase: "FASE 4",
    title: "Ecosistema completo",
    progress: 0,
    version: "v2.0",
    items: [
      "Unifica entrenamiento, nutrición, Scan en una experiencia",
      "Mejoras de continuidad entre dispositivos",
      "Automatización de tareas repetitivas",
      "Análisis conjunto de tendencias",
      "Interfaz conversacional",
      "Planificación de largo plazo",
      "Accesibilidad y estabilidad",
    ],
  },
];

export default function RoadmapAdmin() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const togglePhase = (phase: string) => {
    const next = new Set(expanded);
    if (next.has(phase)) {
      next.delete(phase);
    } else {
      next.add(phase);
    }
    setExpanded(next);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Info className="h-5 w-5" />
        </div>
        <div>
          <h2 className="type-title2">Roadmap</h2>
          <p className="type-subhead text-muted-foreground">
            Tu roadmap de desarrollo Autopilot
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {ROADMAP_DATA.map((phase) => {
          const isExpanded = expanded.has(phase.phase);
          return (
            <div key={phase.phase} className="rounded-2xl border bg-card p-6 shadow-sm">
              {/* Header */}
              <div
                className="flex cursor-pointer items-center justify-between gap-4"
                onClick={() => togglePhase(phase.phase)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="type-title3 font-bold">{phase.phase}</span>
                    <span className="type-footnote text-muted-foreground">· {phase.version}</span>
                  </div>
                  <p className="type-subhead mt-1 text-foreground">{phase.title}</p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Progress bar */}
                  <div className="w-24 shrink-0">
                    <div className="h-1.5 w-full rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>
                  </div>
                  <span className="type-footnote font-medium tabular-nums text-muted-foreground">
                    {phase.progress}%
                  </span>
                  <Info
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>

              {/* Content */}
              {isExpanded && (
                <div className="mt-6 border-t border-border pt-6 animate-in fade-in slide-in-from-top-2 duration-200">
                  <ul className="space-y-3">
                    {phase.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {idx + 1}
                        </div>
                        <span className="type-subhead text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-primary/5 p-4 text-sm text-primary/80">
        <strong>¿Cómo funciona?</strong> Este roadmap se sincroniza automáticamente con Lovable.
        Cuando actualices tu roadmap allí, se refrescará aquí automáticamente.
      </div>
    </div>
  );
}
