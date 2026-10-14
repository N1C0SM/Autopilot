// Academia Autopilot: catálogo editorial (categorías, niveles, evidencia). Pure module.

export type Level = "beginner" | "intermediate" | "advanced";
export type Evidence = "solid" | "limited" | "hypothesis";
export type ReviewStatus = "draft" | "in_review" | "verified";

export interface Reference {
  authors: string;
  year: number;
  title: string;
  journal?: string;
  doi?: string;
  url?: string;
  type?: "meta-analysis" | "systematic-review" | "consensus" | "rct" | "review" | "other";
}

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export const EVIDENCE_LABEL: Record<Evidence, { label: string; hint: string }> = {
  solid: { label: "Evidencia sólida", hint: "Respaldado por metaanálisis o consenso." },
  limited: { label: "Evidencia limitada", hint: "Pocos estudios o resultados mixtos." },
  hypothesis: { label: "Hipótesis", hint: "Mecanismo plausible, aún sin confirmar." },
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  draft: "Borrador",
  in_review: "En revisión",
  verified: "Verificado",
};

export interface Category { slug: string; name: string; summary: string }

export const CATEGORIES: Category[] = [
  { slug: "fundamentos", name: "Fundamentos", summary: "Los principios que explican por qué el entrenamiento funciona." },
  { slug: "sobrecarga-progresiva", name: "Sobrecarga progresiva", summary: "Cómo y cuándo progresar, y qué cuenta de verdad como progreso." },
  { slug: "hipertrofia", name: "Hipertrofia", summary: "Qué hace crecer el músculo y cómo aprovecharlo." },
  { slug: "biomecanica", name: "Biomecánica", summary: "Cómo la física del movimiento decide qué músculo trabaja." },
  { slug: "sistema-nervioso-fuerza", name: "Sistema nervioso y fuerza", summary: "Adaptaciones neurales, fatiga y especificidad." },
  { slug: "programacion", name: "Programación", summary: "Volumen, frecuencia, esfuerzo y periodización." },
  { slug: "tecnica", name: "Técnica", summary: "Fases, tempo, pausas, descansos y ejecución eficiente." },
  { slug: "calistenia", name: "Calistenia", summary: "Progresar con el peso corporal: palancas, técnica y carga." },
  { slug: "nutricion", name: "Nutrición", summary: "Energía, proteína y composición corporal." },
  { slug: "recuperacion", name: "Recuperación", summary: "Sueño, fatiga, tendones y descargas." },
  { slug: "mitos", name: "Mitos frecuentes", summary: "Creencias populares contrastadas con la evidencia." },
  { slug: "entrenamiento-avanzado", name: "Entrenamiento avanzado", summary: "Fuerza máxima, potencia y diseño de programas completos." },
];

export const categoryBySlug = (slug?: string | null) => CATEGORIES.find((c) => c.slug === slug);

/** Estructura obligatoria de cada artículo. El revisor la completa antes de verificar. */
export const ARTICLE_SECTIONS = [
  "Idea clave",
  "Explicación",
  "Qué dice la evidencia",
  "Ejemplo práctico",
  "Errores frecuentes",
  "Cómo aplicarlo a tu entrenamiento",
];

export const readingMinutes = (md: string) =>
  Math.max(1, Math.round((md || "").split(/\s+/).filter(Boolean).length / 220));

export const slugifyHeading = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

export const extractToc = (md: string) =>
  (md || "")
    .split("\n")
    .map((l) => /^(##|###)\s+(.+)$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ depth: m[1].length, text: m[2].replace(/[*_`]/g, ""), id: slugifyHeading(m[2].replace(/[*_`]/g, "")) }));

/** Un artículo de la Academia solo puede publicarse si está verificado y tiene al menos una referencia. */
export const canPublishAcademy = (p: { category?: string | null; review_status?: string | null; references?: unknown }) =>
  !p.category || (p.review_status === "verified" && Array.isArray(p.references) && p.references.length > 0);
