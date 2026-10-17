import { create } from "zustand";
import type { Roadmap, Version, Feature } from "./types";

const STORAGE_KEY = "autopilot_roadmap_v1";

const DEFAULT_ROADMAP: Roadmap = {
  id: "autopilot",
  name: "Autopilot",
  description: "Roadmap de desarrollo de Autopilot",
  phases: [
    { num: 1, name: "Lanzamiento y consolidación" },
    { num: 2, name: "Inteligencia integrada" },
    { num: 3, name: "Análisis físico avanzado" },
    { num: 4, name: "Ecosistema completo" },
  ],
  versions: [
    {
      id: "v1.0",
      number: "1.0",
      name: "Lanzamiento y consolidación",
      focus: "Rutinas personalizadas y Scan",
      phase: 1,
      stage: "beta1",
      build: 1,
      features: [
        { id: "f1", title: "Rutinas personalizadas", priority: "p0", complexity: "m", status: "done" },
        { id: "f2", title: "Seguimiento de series, repeticiones y pesos", priority: "p0", complexity: "m", status: "done" },
        { id: "f3", title: "Sobrecarga progresiva", priority: "p0", complexity: "m", status: "done" },
        { id: "f4", title: "Scan", priority: "p0", complexity: "l", status: "done" },
        { id: "f5", title: "Perfil y objetivos", priority: "p1", complexity: "s", status: "done" },
        { id: "f6", title: "Plan Free", priority: "p1", complexity: "m", status: "done" },
        { id: "f7", title: "Estabilidad y App Store", priority: "p0", complexity: "l", status: "doing" },
      ],
    },
    {
      id: "v1.1",
      number: "1.1",
      name: "Nutrición completa",
      focus: "Registro de comidas y análisis de alimentos",
      phase: 1,
      stage: "planned",
      build: 0,
      features: [
        { id: "f8", title: "Objetivos de calorías y macros", priority: "p0", complexity: "m", status: "todo" },
        { id: "f9", title: "Registro de comidas", priority: "p0", complexity: "m", status: "todo" },
        { id: "f10", title: "Análisis de alimentos con IA", priority: "p1", complexity: "xl", status: "todo" },
        { id: "f11", title: "Nutrición adaptada", priority: "p1", complexity: "m", status: "todo" },
        { id: "f12", title: "Fotografiar nevera", priority: "p2", complexity: "l", status: "todo" },
      ],
    },
    {
      id: "v1.2",
      number: "1.2",
      name: "Inteligencia de mercado",
      focus: "Recomendaciones de compra",
      phase: 1,
      stage: "planned",
      build: 0,
      features: [
        { id: "f13", title: "Lista de ingredientes que faltan", priority: "p1", complexity: "m", status: "todo" },
        { id: "f14", title: "Elegir supermercado", priority: "p1", complexity: "m", status: "todo" },
        { id: "f15", title: "Estimar precio de compra", priority: "p1", complexity: "l", status: "todo" },
        { id: "f16", title: "Comparar alternativas", priority: "p2", complexity: "m", status: "todo" },
        { id: "f17", title: "Ajustar a presupuesto", priority: "p2", complexity: "m", status: "todo" },
      ],
    },
    {
      id: "v1.3",
      number: "1.3",
      name: "Widgets y recordatorios",
      focus: "Experiencia iOS nativa",
      phase: 1,
      stage: "planned",
      build: 0,
      features: [
        { id: "f18", title: "Recordatorios de entrenamiento", priority: "p1", complexity: "s", status: "todo" },
        { id: "f19", title: "Historial y estadísticas", priority: "p1", complexity: "m", status: "todo" },
        { id: "f20", title: "Face ID / Touch ID", priority: "p1", complexity: "s", status: "todo" },
        { id: "f21", title: "Widgets para iOS", priority: "p1", complexity: "m", status: "todo" },
        { id: "f22", title: "Accesos rápidos", priority: "p2", complexity: "s", status: "todo" },
      ],
    },
    {
      id: "v1.4",
      number: "1.4",
      name: "Calendarios y salud",
      focus: "Integraciones con Apple",
      phase: 1,
      stage: "planned",
      build: 0,
      features: [
        { id: "f23", title: "Apple Calendar", priority: "p1", complexity: "m", status: "todo" },
        { id: "f24", title: "Google Calendar", priority: "p2", complexity: "m", status: "todo" },
        { id: "f25", title: "Apple Health", priority: "p1", complexity: "m", status: "todo" },
        { id: "f26", title: "Withings", priority: "p2", complexity: "m", status: "todo" },
        { id: "f27", title: "Garmin", priority: "p2", complexity: "m", status: "todo" },
      ],
    },
    {
      id: "v1.5",
      number: "1.5",
      name: "Inteligencia integrada",
      focus: "Experiencia coordinada",
      phase: 2,
      stage: "planned",
      build: 0,
      features: [
        { id: "f28", title: "Conexión entre entrenamiento y nutrición", priority: "p0", complexity: "l", status: "todo" },
        { id: "f29", title: "Planificación coordinada", priority: "p0", complexity: "l", status: "todo" },
        { id: "f30", title: "Experiencia unificada", priority: "p1", complexity: "m", status: "todo" },
        { id: "f31", title: "Tendencias y hitos", priority: "p1", complexity: "m", status: "todo" },
      ],
    },
    {
      id: "v1.6",
      number: "1.6",
      name: "Análisis físico avanzado",
      focus: "Evolución del Scan",
      phase: 3,
      stage: "planned",
      build: 0,
      features: [
        { id: "f32", title: "Evolución del Scan", priority: "p0", complexity: "xl", status: "todo" },
        { id: "f33", title: "Comparación temporal", priority: "p1", complexity: "l", status: "todo" },
        { id: "f34", title: "Visualizaciones del progreso", priority: "p1", complexity: "m", status: "todo" },
        { id: "f35", title: "Medidas corporales", priority: "p1", complexity: "m", status: "todo" },
      ],
    },
    {
      id: "v2.0",
      number: "2.0",
      name: "Ecosistema completo",
      focus: "Unificación y automatización",
      phase: 4,
      stage: "planned",
      build: 0,
      features: [
        { id: "f36", title: "Experiencia coordinada", priority: "p0", complexity: "xl", status: "todo" },
        { id: "f37", title: "Automatización de tareas", priority: "p1", complexity: "l", status: "todo" },
        { id: "f38", title: "Interfaz conversacional", priority: "p1", complexity: "xl", status: "todo" },
        { id: "f39", title: "Planificación largo plazo", priority: "p2", complexity: "l", status: "todo" },
        { id: "f40", title: "Accesibilidad y estabilidad", priority: "p0", complexity: "m", status: "todo" },
      ],
    },
  ],
};

interface RoadmapStore {
  roadmap: Roadmap;
  currentVersionId: string | null;
  load: () => void;
  save: () => void;
  setVersionStage: (versionId: string, stage: VersionStage) => void;
  setFeatureStatus: (featureId: string, status: FeatureStatus) => void;
  moveFeature: (featureId: string, toVersionId: string) => void;
}

export const useRoadmapStore = create<RoadmapStore>((set, get) => ({
  roadmap: DEFAULT_ROADMAP,
  currentVersionId: DEFAULT_ROADMAP.versions[0].id,

  load: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Roadmap;
        set({ roadmap: parsed });
      }
    } catch {
      console.error("Failed to load roadmap from localStorage");
    }
  },

  save: () => {
    try {
      const { roadmap } = get();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(roadmap));
    } catch {
      console.error("Failed to save roadmap to localStorage");
    }
  },

  setVersionStage: (versionId, stage) => {
    set((state) => ({
      roadmap: {
        ...state.roadmap,
        versions: state.roadmap.versions.map((v) =>
          v.id === versionId ? { ...v, stage } : v
        ),
      },
    }));
  },

  setFeatureStatus: (featureId, status) => {
    set((state) => ({
      roadmap: {
        ...state.roadmap,
        versions: state.roadmap.versions.map((v) => ({
          ...v,
          features: v.features.map((f) =>
            f.id === featureId ? { ...f, status } : f
          ),
        })),
      },
    }));
  },

  moveFeature: (featureId, toVersionId) => {
    set((state) => {
      const fromVersion = state.roadmap.versions.find((v) =>
        v.features.some((f) => f.id === featureId)
      );
      if (!fromVersion) return state;

      const feature = fromVersion.features.find((f) => f.id === featureId);
      if (!feature) return state;

      return {
        roadmap: {
          ...state.roadmap,
          versions: state.roadmap.versions.map((v) => {
            if (v.id === fromVersion.id) {
              return { ...v, features: v.features.filter((f) => f.id !== featureId) };
            }
            if (v.id === toVersionId) {
              return { ...v, features: [...v.features, feature] };
            }
            return v;
          }),
        },
      };
    });
  },
}));

// Load on mount
if (typeof window !== "undefined") {
  useRoadmapStore.getState().load();
}
