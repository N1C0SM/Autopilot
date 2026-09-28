import { useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

const views = [
  { key: "training", label: "Entrenamiento" },
  { key: "nutrition", label: "Nutrición" },
  { key: "progress", label: "Progreso" },
] as const;
type View = (typeof views)[number]["key"];
const exercises = [
  { name: "Sentadilla goblet", detail: "3 series · 8–10 repeticiones" },
  { name: "Remo con mancuerna", detail: "3 series · 10–12 repeticiones" },
  { name: "Press con mancuernas", detail: "3 series · 8–10 repeticiones" },
];

/** Public, isolated example. Never reads or writes a customer's training data. */
export default function ProductPreview({ onPlans }: { onPlans: () => void }) {
  const [view, setView] = useState<View>("training");
  const [completed, setCompleted] = useState<string[]>([]);
  return (
    <section id="ver-app" aria-labelledby="preview-heading" className="scroll-mt-24 border-y border-border px-4 py-16 sm:py-20">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Antes de decidir</p>
            <h2 id="preview-heading" className="font-display text-3xl font-bold sm:text-4xl">Prueba cómo sería tu día.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Explora un ejemplo de entrenamiento, nutrición y progreso. Sin cuenta, sin tarjeta y sin subir fotos.</p>
          </div>
          <span className="text-xs text-muted-foreground">Demo con datos ficticios · no es un plan personal</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap gap-2 border-b border-border p-3" role="group" aria-label="Secciones de la demo">
            {views.map(({ key, label }) => (
              <button key={key} type="button" aria-pressed={view === key} onClick={() => {
                setView(key);
                track("plan_preview_view", { source: "public_demo", section: key });
              }} className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors ${view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="p-5 sm:p-8">
            {view === "training" && (
              <div>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div><p className="text-xs text-primary">Lunes · ejemplo de sesión</p><h3 className="mt-1 font-display text-xl font-bold">Fuerza de cuerpo completo</h3><p className="mt-2 text-sm text-muted-foreground">Marca los ejercicios para probar el registro.</p></div>
                  <p role="status" className="text-sm font-semibold">{completed.length} de {exercises.length} completados</p>
                </div>
                <div className="divide-y divide-border">
                  {exercises.map(({ name, detail }) => {
                    const done = completed.includes(name);
                    return <button key={name} type="button" aria-pressed={done} aria-label={`${done ? "Desmarcar" : "Completar"} ${name}`} onClick={() => setCompleted(current => done ? current.filter(item => item !== name) : [...current, name])} className="flex w-full items-center justify-between gap-4 py-5 text-left hover:text-primary">
                      <span><span className="block text-sm font-semibold">{name}</span><span className="mt-1 block text-xs text-muted-foreground">{detail}</span></span>
                      <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{done && <Check className="h-4 w-4" />}</span>
                    </button>;
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">En tu cuenta registras también pesos, repeticiones y descansos.</p>
                  <Button variant="ghost" size="sm" onClick={() => setCompleted([])}><RotateCcw className="h-3.5 w-3.5" /> Reiniciar demo</Button>
                </div>
              </div>
            )}
            {view === "nutrition" && <div>
              <p className="text-xs text-primary">Incluida en Completo y Transformación</p>
              <h3 className="mt-1 font-display text-xl font-bold">Tus comidas, en un mismo lugar.</h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">En tu plan verás los objetivos diarios y las comidas que haya preparado tu entrenador. Este ejemplo solo muestra la organización.</p>
              <dl className="mt-6 divide-y divide-border">{[["Desayuno", "Yogur, avena y fruta"], ["Comida", "Arroz, pollo y verduras"], ["Cena", "Tortilla, patata y ensalada"]].map(([meal, text]) => <div key={meal} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]"><dt className="text-sm font-semibold">{meal}</dt><dd className="text-sm text-muted-foreground">{text}</dd></div>)}</dl>
              <p className="mt-5 text-xs text-muted-foreground">Comidas ilustrativas, sin cantidades ni recomendaciones para tu caso.</p>
            </div>}
            {view === "progress" && <div>
              <p className="text-xs text-primary">Ejemplo de seguimiento</p>
              <h3 className="mt-1 font-display text-xl font-bold">Mira lo que has hecho. Decide qué ajustar.</h3>
              <dl className="mt-6 divide-y divide-border">{[["Sesiones de esta semana", "2 de 3"], ["Registro de entrenamiento", "Pesos y repeticiones por ejercicio"], ["Evolución", "Fotos y medidas para comparar contigo"]].map(([label, value]) => <div key={label} className="grid gap-2 py-4 sm:grid-cols-2"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-semibold">{value}</dd></div>)}</dl>
              <p className="mt-5 text-xs text-muted-foreground">Los datos de esta demo no representan resultados de un cliente.</p>
            </div>}
          </div>
        </div>
        <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="max-w-xl text-sm text-muted-foreground">La app organiza el día a día. El valor del servicio está en la persona que prepara y revisa tu plan.</p>
          <Button variant="hero" onClick={onPlans}>Ver qué incluye cada plan <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </section>
  );
}
