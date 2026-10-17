import { useState } from "react";
import { Info, Check, RotateCcw, Zap, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hapticTap } from "@/lib/native";

// Roadmap data - copiado de Lovable
const ROADMAP = [
  {
    phase: "FASE 1",
    title: "Lanzamiento y consolidación",
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
      "Objetivos de calorías y macronutrientes",
      "Registro de comidas",
      "Análisis de alimentos mediante fotografías con IA",
      "Estimación de proteínas, carbohidratos y grasas",
      "Nutrición adaptada a los objetivos",
      "Fotografiar nevera y despensa",
      "Reconocimiento de alimentos e inventario editable",
      "Recomendaciones adaptadas a los objetivos",
      "Lista de ingredientes que faltan",
      "Elegir supermercado",
      "Estimar el precio total de la compra",
      "Desglosar precios y cantidades",
      "Comparar alternativas económicas",
      "Ajustar la compra a un presupuesto",
      "Usar fuentes fiables para los precios",
      "Recordatorios de entrenamiento y comidas",
      "Historial y estadísticas mejoradas",
      "Face ID / Touch ID",
      "Ajustes de privacidad",
      "Widgets para iOS",
      "Accesos rápidos a rutinas y progreso",
      "Interacciones compatibles con los widgets",
      "Apple Calendar",
      "Google Calendar",
      "Programación de entrenamientos",
      "Actualización de eventos y prevención de duplicados",
      "Acceso directo a las rutinas desde los eventos",
      "Apple Health",
      "Withings: peso y métricas compatibles",
      "Sincronización de datos autorizados",
      "Gestión de permisos y conflictos de sincronización",
      "Garmin y fuentes compatibles",
      "Importación de actividad y entrenamientos",
      "Sincronización entre dispositivos",
      "Uso de métricas compatibles",
      "Optimización del rendimiento",
      "Mejoras de precisión y costes de IA",
      "Corrección de errores",
      "Seguridad, privacidad y calidad de datos",
      "Mejoras basadas en uso y feedback",
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
      "Ajustes de recomendaciones alimentarias",
      "Incorporación prudente de datos compatibles",
      "Plan semanal coordinado",
      "Tendencias, hitos, estadísticas comprensibles",
      "Recomendaciones de cambios cuando el usuario no puede cumplir",
      "Preferencias, horarios, equipamiento y hábitos",
      "Evaluación de la calidad de recomendaciones",
      "Consolidación, rendimiento y experiencia",
    ],
  },
  {
    phase: "FASE 3",
    title: "Análisis físico avanzado",
    progress: 0,
    version: "v1.6",
    items: [
      "Evolución importante del Scan y del seguimiento físico",
      "Registro y comparación temporal de fotografías",
      "Visualizaciones del progreso y comparativas más útiles",
      "Registro de medidas corporales introducidas por el usuario",
      "Mejoras en el reconocimiento visual",
      "Comparación del progreso observado con los objetivos",
      "Historial visual organizado y herramientas",
      "Controles de acceso, almacenamiento y eliminación",
      "Validación, fiabilidad y consolidación",
    ],
  },
  {
    phase: "FASE 4",
    title: "Ecosistema completo",
    progress: 0,
    version: "v2.0",
    items: [
      "Unifica entrenamiento, nutrición, Scan, planificación y compras",
      "Mejoras de continuidad entre dispositivos y plataformas",
      "Automatización de tareas repetitivas",
      "Análisis conjunto de las tendencias",
      "Ampliación de integraciones",
      "Interfaz conversacional para consultar datos",
      "Planificación de más largo plazo",
      "Mejoras de accesibilidad, estabilidad y privacidad",
      "Nuevas integraciones priorizadas",
      "Consolidación de la plataforma",
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
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div>
          <h2 className="type-title2">Roadmap</h2>
          <p className="type-subhead text-muted-foreground">
            Tu roadmap de desarrollo Autopilot
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {ROADMAP.map((phase) => {
          const isExpanded = expanded.has(phase.phase);
          return (
            <div key={phase.phase} className="rounded-2xl border bg-card p-6 shadow-sm">
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
                  <div className="w-20 shrink-0">
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

              {isExpanded && (
                <div className="mt-6 animate-in fade-in slide-in-from-top-2">
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
                  <p className="type-caption1 text-muted-foreground mt-4">
                    Total: {phase.items.length} características
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
