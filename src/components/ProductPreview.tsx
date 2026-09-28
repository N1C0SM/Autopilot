import { useState } from "react";
import { ArrowRight, Check, Dumbbell, LineChart, MessageCircle, RotateCcw, Timer, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

const views = [
  { key: "training", label: "Entrenamiento", icon: Dumbbell },
  { key: "nutrition", label: "Nutrición", icon: Utensils },
  { key: "progress", label: "Progreso", icon: LineChart },
] as const;
type View = (typeof views)[number]["key"];

const exercises = [
  { name: "Sentadilla goblet", sets: "3 × 8–10", load: "20 kg", last: "Última vez: 18 kg × 10" },
  { name: "Remo con mancuerna", sets: "3 × 10–12", load: "16 kg", last: "Última vez: 14 kg × 12" },
  { name: "Press con mancuernas", sets: "3 × 8–10", load: "14 kg", last: "Última vez: 14 kg × 8" },
];

const side: Record<View, { title: string; points: string[] }> = {
  training: {
    title: "Sabes qué hacer al entrar al gimnasio.",
    points: ["Series, repeticiones y peso sugerido para cada ejercicio.", "Ves lo que levantaste la última vez para progresar.", "Si la máquina está ocupada, pides una alternativa a tu entrenador."],
  },
  nutrition: {
    title: "Comes con un objetivo claro, sin contar a ciegas.",
    points: ["Calorías y macros del día de un vistazo.", "Comidas preparadas por tu entrenador, adaptables a tus gustos.", "Cambias una comida sin romper el plan."],
  },
  progress: {
    title: "Ves que avanzas, y tu entrenador también.",
    points: ["Peso, medidas y fotos en un mismo lugar.", "Constancia semanal sin tener que apuntarlo tú.", "Tu entrenador revisa los datos y ajusta el plan."],
  },
};

const weights = [82.4, 82.1, 81.9, 81.6, 81.7, 81.2, 80.9, 80.6];

/** Public, isolated example. Never reads or writes a customer's training data. */
export default function ProductPreview({ onPlans }: { onPlans: () => void }) {
  const [view, setView] = useState<View>("training");
  const [completed, setCompleted] = useState<string[]>([]);
  const pct = Math.round((completed.length / exercises.length) * 100);
  const max = Math.max(...weights), min = Math.min(...weights);
  const path = weights.map((w, i) => `${(i / (weights.length - 1)) * 100},${((max - w) / (max - min)) * 36 + 4}`).join(" ");

  return (
    <section id="ver-app" aria-labelledby="preview-heading" className="scroll-mt-24 border-y border-border px-4 py-16 sm:py-20">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Antes de decidir</p>
            <h2 id="preview-heading" className="font-display text-3xl font-bold sm:text-4xl">Prueba cómo sería tu día.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Toca la app: marca ejercicios, mira tu nutrición y tu progreso. Sin cuenta, sin tarjeta y sin subir fotos.</p>
          </div>
          <span className="text-xs text-muted-foreground">Demo con datos ficticios · no es un plan personal</span>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-[1fr_22rem]">
          <div className="order-2 md:order-1">
            <h3 className="font-display text-2xl font-bold">{side[view].title}</h3>
            <ul className="mt-5 space-y-3">
              {side[view].points.map(p => (
                <li key={p} className="flex gap-3 text-sm text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{p}</li>
              ))}
            </ul>
            <p className="mt-6 max-w-md text-sm text-muted-foreground">La app organiza el día a día. El valor está en la persona que prepara y revisa tu plan.</p>
          </div>

          {/* Phone */}
          <div className="order-1 mx-auto w-full max-w-[22rem] md:order-2">
            <div className="rounded-[2.75rem] border border-border bg-secondary p-2.5 shadow-2xl">
              <div className="flex h-[36rem] flex-col overflow-hidden rounded-[2.25rem] bg-background">
                <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold"><span>9:41</span><span className="h-5 w-20 rounded-full bg-secondary" /><span>100%</span></div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
                  {view === "training" && (
                    <div>
                      <p className="text-[11px] font-medium text-primary">Lunes · Semana 3 de 12</p>
                      <div className="mt-1 flex items-end justify-between">
                        <h4 className="font-display text-lg font-bold leading-tight">Fuerza cuerpo completo</h4>
                        <p role="status" className="text-xs font-semibold">{completed.length} de {exercises.length} completados</p>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>

                      <div className="mt-4 flex gap-2.5 rounded-2xl bg-secondary p-3">
                        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="text-xs leading-relaxed"><span className="font-semibold">Tu entrenador:</span> <span className="text-muted-foreground">sube 2 kg en la sentadilla si ayer te sobraron repeticiones.</span></p>
                      </div>

                      <div className="mt-4 space-y-2">
                        {exercises.map(({ name, sets, load, last }) => {
                          const done = completed.includes(name);
                          return (
                            <button key={name} type="button" aria-pressed={done} aria-label={`${done ? "Desmarcar" : "Completar"} ${name}`}
                              onClick={() => setCompleted(c => done ? c.filter(i => i !== name) : [...c, name])}
                              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${done ? "border-primary/40 bg-primary/5" : "border-border hover:bg-secondary"}`}>
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary"><Dumbbell className="h-5 w-5 text-muted-foreground" /></span>
                              <span className="min-w-0 flex-1">
                                <span className={`block truncate text-sm font-semibold ${done ? "line-through opacity-60" : ""}`}>{name}</span>
                                <span className="block text-xs text-muted-foreground">{sets} · {load}</span>
                                <span className="block text-[10px] text-muted-foreground/80">{last}</span>
                              </span>
                              <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{done && <Check className="h-4 w-4" />}</span>
                            </button>
                          );
                        })}
                      </div>

                      {completed.length > 0 && completed.length < exercises.length && (
                        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-primary/10 p-3 text-xs"><Timer className="h-4 w-4 text-primary" /><span className="font-semibold">Descanso 1:30</span><span className="text-muted-foreground">· siguiente ejercicio</span></div>
                      )}
                      {completed.length === exercises.length && (
                        <div className="mt-3 rounded-2xl bg-primary/10 p-3 text-center text-xs font-semibold">Sesión completada · tu entrenador la verá</div>
                      )}
                      <div className="mt-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => setCompleted([])}><RotateCcw className="h-3.5 w-3.5" /> Reiniciar demo</Button>
                      </div>
                    </div>
                  )}

                  {view === "nutrition" && (
                    <div>
                      <p className="text-[11px] font-medium text-primary">Hoy · plan Completo</p>
                      <h4 className="font-display text-lg font-bold">Nutrición</h4>
                      <div className="mt-4 flex items-center gap-4 rounded-2xl bg-secondary p-4">
                        <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                          <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-border" strokeWidth="3.5" />
                          <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-primary" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset="38" />
                        </svg>
                        <div><p className="font-display text-2xl font-bold">1.420</p><p className="text-xs text-muted-foreground">de 2.300 kcal</p></div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[["Proteína", 96, 150], ["Carbos", 150, 240], ["Grasas", 45, 75]].map(([l, v, t]) => (
                          <div key={l as string} className="rounded-xl border border-border p-2.5">
                            <p className="text-[10px] text-muted-foreground">{l}</p>
                            <p className="text-sm font-semibold">{v}<span className="text-[10px] font-normal text-muted-foreground">/{t} g</span></p>
                            <div className="mt-1.5 h-1 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${((v as number) / (t as number)) * 100}%` }} /></div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 divide-y divide-border rounded-2xl border border-border">
                        {[["Desayuno", "Yogur, avena y fruta", true], ["Comida", "Arroz, pollo y verduras", true], ["Cena", "Tortilla, patata y ensalada", false]].map(([m, t, d]) => (
                          <div key={m as string} className="flex items-center justify-between gap-2 p-3">
                            <div><p className="text-sm font-semibold">{m}</p><p className="text-xs text-muted-foreground">{t}</p></div>
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${d ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{d && <Check className="h-3 w-3" />}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[10px] text-muted-foreground">Comidas ilustrativas, sin recomendaciones para tu caso.</p>
                    </div>
                  )}

                  {view === "progress" && (
                    <div>
                      <p className="text-[11px] font-medium text-primary">Últimas 8 semanas</p>
                      <h4 className="font-display text-lg font-bold">Progreso</h4>
                      <div className="mt-4 rounded-2xl bg-secondary p-4">
                        <div className="flex items-end justify-between"><div><p className="text-xs text-muted-foreground">Peso corporal</p><p className="font-display text-2xl font-bold">80,6 kg</p></div><p className="text-xs font-semibold text-primary">−1,8 kg</p></div>
                        <svg viewBox="0 0 100 44" preserveAspectRatio="none" className="mt-3 h-20 w-full"><polyline points={path} fill="none" className="stroke-primary" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>
                      </div>
                      <div className="mt-3 rounded-2xl border border-border p-4">
                        <p className="text-xs text-muted-foreground">Sesiones esta semana</p>
                        <div className="mt-2 flex gap-1.5">{["L", "M", "X", "J", "V", "S", "D"].map((d, i) => <span key={d} className={`flex h-8 flex-1 items-center justify-center rounded-lg text-[10px] font-semibold ${[0, 2].includes(i) ? "bg-primary text-primary-foreground" : i === 4 ? "border border-dashed border-primary" : "bg-secondary text-muted-foreground"}`}>{d}</span>)}</div>
                        <p className="mt-2 text-xs"><span className="font-semibold">2 de 3</span> <span className="text-muted-foreground">· próxima el viernes</span></p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border p-3"><p className="text-[10px] text-muted-foreground">Sentadilla</p><p className="text-sm font-semibold">14 → 20 kg</p></div>
                        <div className="rounded-xl border border-border p-3"><p className="text-[10px] text-muted-foreground">Cintura</p><p className="text-sm font-semibold">−3 cm</p></div>
                      </div>
                      <p className="mt-3 text-[10px] text-muted-foreground">Los datos de esta demo no representan resultados de un cliente.</p>
                    </div>
                  )}
                </div>

                <nav className="grid grid-cols-3 border-t border-border bg-background/90 px-2 pb-4 pt-2 backdrop-blur" role="group" aria-label="Secciones de la demo">
                  {views.map(({ key, label, icon: Icon }) => (
                    <button key={key} type="button" aria-pressed={view === key} onClick={() => { setView(key); track("plan_preview_view", { source: "public_demo", section: key }); }}
                      className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium transition-colors ${view === key ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                      <Icon className="h-5 w-5" />{label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Button variant="hero" onClick={onPlans}>Ver qué incluye cada plan <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </section>
  );
}
