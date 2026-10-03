import { lazy, Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Apple, ArrowRight, Bell, Check, Dumbbell, Home, LineChart, MessageCircle,
  RotateCcw, Send, Settings as SettingsIcon, Sparkles, Timer, Utensils, Lock, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { buildExerciseHistory } from "@/lib/workoutMetrics";

const ExerciseProgressChart = lazy(() => import("@/components/dashboard/ExerciseProgressChart"));

const views = [
  { key: "home", label: "Hoy", icon: Home },
  { key: "training", label: "Plan", icon: Dumbbell },
  { key: "nutrition", label: "Nutrición", icon: Apple },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "progress", label: "Progreso", icon: Sparkles },
] as const;
type View = (typeof views)[number]["key"];

const titles: Record<View, string> = {
  home: "Hoy",
  training: "Tu plan",
  nutrition: "Nutrición",
  chat: "Tu entrenador",
  progress: "Progreso",
};

const exercises = [
  { name: "Sentadilla goblet", sets: 3, reps: 9, load: "20 kg", last: "Última vez: 18 kg × 10" },
  { name: "Remo con mancuerna", sets: 3, reps: 11, load: "16 kg", last: "Última vez: 14 kg × 12" },
  { name: "Press con mancuernas", sets: 3, reps: 9, load: "14 kg", last: "Última vez: 14 kg × 8" },
];

const side: Record<View, { title: string; points: string[] }> = {
  home: {
    title: "Abres la app y sabes qué toca hoy.",
    points: ["Tu rutina y el progreso de tus sesiones están a mano.", "Empieza gratis y registra tus entrenamientos sin tarjeta.", "El chat con entrenador y la nutrición dependen del plan elegido."],
  },
  training: {
    title: "Sabes qué hacer al entrar al gimnasio.",
    points: ["Registra por separado el peso y las repeticiones de cada serie.", "Ves lo que levantaste la última vez para progresar.", "El tracker y el progreso están incluidos en el plan Gratis."],
  },
  nutrition: {
    title: "Nutrición personalizada en el plan Completo.",
    points: ["Calorías y macros del día de un vistazo.", "Comidas preparadas por tu entrenador, adaptables a tus gustos.", "Esta sección no está incluida en el plan Gratis."],
  },
  chat: {
    title: "Una persona real al otro lado.",
    points: ["Dudas, molestias o cambios: se lo dices a tu entrenador.", "Te responde y ajusta tu plan, no un robot.", "El chat está disponible en los planes con entrenador, no en Gratis."],
  },
  progress: {
    title: "Comprueba tu evolución con datos de tus sesiones.",
    points: ["Compara volumen y fuerza estimada por ejercicio.", "Consulta tus sesiones semanales y récords personales.", "Añade fotos para documentar tu progreso."],
  },
};

const demoHistory = buildExerciseHistory([
  ["Sentadilla goblet", "2026-09-04", "18", 10],
  ["Sentadilla goblet", "2026-09-11", "18", 11],
  ["Sentadilla goblet", "2026-09-18", "20", 9],
  ["Sentadilla goblet", "2026-09-25", "20", 10],
  ["Remo con mancuerna", "2026-09-04", "14", 12],
  ["Remo con mancuerna", "2026-09-11", "16", 10],
  ["Remo con mancuerna", "2026-09-18", "16", 11],
  ["Remo con mancuerna", "2026-09-25", "16", 12],
  ["Press con mancuernas", "2026-09-04", "12", 10],
  ["Press con mancuernas", "2026-09-11", "12", 11],
  ["Press con mancuernas", "2026-09-18", "14", 9],
  ["Press con mancuernas", "2026-09-25", "14", 10],
].map(([exercise_name, logged_at, weight, reps]) => ({
  exercise_name: String(exercise_name),
  logged_at: String(logged_at),
  sets_completed: Array.from({ length: 3 }, () => ({ weight, reps, done: true })),
})));
const demoProgressExercises = Object.keys(demoHistory);

const chatMessages: { from: "trainer" | "me"; text: string; time: string }[] = [
  { from: "trainer", text: "¿Qué tal la sentadilla de ayer? ¿Te sobraron repeticiones?", time: "9:12" },
  { from: "me", text: "Sí, las dos últimas salieron bien. La máquina de remo estaba ocupada eso sí", time: "9:15" },
  { from: "trainer", text: "Perfecto, sube a 20 kg la próxima. Para el remo te dejo alternativa con mancuerna en el plan 👍", time: "9:16" },
];

/** Public, isolated example. Never reads or writes a customer's training data. */
export default function ProductPreview({ onPlans, onFree }: { onPlans: () => void; onFree?: () => void }) {
  const [view, setView] = useState<View>("home");
  const [completed, setCompleted] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [setValues, setSetValues] = useState<Record<string, { weight: string; reps: number }>>({});
  const [progressExercise, setProgressExercise] = useState(demoProgressExercises[0]);
  const [progressMetric, setProgressMetric] = useState<"volumeKg" | "bestEstimated1RmKg">("volumeKg");
  const totalSets = exercises.reduce((total, exercise) => total + exercise.sets, 0);
  const pct = Math.round((completed.length / totalSets) * 100);
  const toggleSet = (exerciseName: string, setIndex: number) => {
    const key = `${exerciseName}::${setIndex}`;
    setCompleted((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };
  const resetWorkout = () => {
    setCompleted([]);
    setStarted(false);
    setExpandedExercise(null);
    setSetValues({});
  };
  const updateSetValue = (key: string, field: "weight" | "reps", value: string) => {
    const exerciseName = key.slice(0, key.lastIndexOf("::"));
    const exercise = exercises.find((item) => item.name === exerciseName);
    if (!exercise) return;
    setSetValues((current) => ({
      ...current,
      [key]: {
        weight: current[key]?.weight ?? exercise.load.replace(/\s*kg$/, ""),
        reps: current[key]?.reps ?? exercise.reps,
        [field]: field === "weight" ? value : Number(value) || 0,
      },
    }));
  };
  const demoBestRecords = demoProgressExercises
    .map((name) => ({
      name,
      best: demoHistory[name].reduce((best, entry) =>
        entry.bestEstimated1RmKg !== null
          && (best.bestEstimated1RmKg === null || entry.bestEstimated1RmKg > best.bestEstimated1RmKg)
          ? entry
          : best,
      demoHistory[name][0]),
    }))
    .sort((a, b) => (b.best.bestEstimated1RmKg || 0) - (a.best.bestEstimated1RmKg || 0))
    .slice(0, 2);

  const changeView = (key: View) => { setView(key); track("plan_preview_view", { source: "public_demo", section: key }); };

  return (
    <section id="ver-app" aria-labelledby="preview-heading" className="scroll-mt-24 border-y border-border px-4 py-16 sm:py-20">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Antes de decidir</p>
            <h2 id="preview-heading" className="font-display text-3xl font-bold sm:text-4xl">Prueba cómo sería tu día.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Explora una simulación del plan, el registro por series y la evolución con gráficos. Nutrición y chat aparecen como ejemplos de planes con entrenador; no están incluidos en Gratis. Sin cuenta ni tarjeta.</p>
          </div>
          <span className="text-xs text-muted-foreground">Demo con datos ficticios · no es un plan personal</span>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-[1fr_22rem]">
          <div className="order-2 md:order-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <h3 className="font-display text-2xl font-bold">{side[view].title}</h3>
                <ul className="mt-5 space-y-3">
                  {side[view].points.map(p => (
                    <li key={p} className="flex gap-3 text-sm text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{p}</li>
                  ))}
                </ul>
                <p className="mt-6 max-w-md text-sm text-muted-foreground">{view === "nutrition" ? "Nutrición personalizada incluida en Completo · 49€/mes tras la prueba. No forma parte del plan Gratis." : view === "chat" ? "Chat en los planes de pago: respuesta en 48h con Entrenamiento y en 24h con Completo. No está incluido en Gratis." : "La demo usa datos ficticios. Gratis incluye rutina inicial, registro y progreso; el chat y la nutrición son funciones de los planes con entrenador."}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* iPhone frame */}
          <div className="order-1 mx-auto w-full max-w-[22rem] md:order-2">
            <div className="relative rounded-[3.25rem] bg-neutral-900 p-[3px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)] ring-1 ring-neutral-700/60">
              {/* side buttons */}
              <span aria-hidden className="absolute -left-[2px] top-24 h-8 w-[3px] rounded-l-md bg-neutral-700" />
              <span aria-hidden className="absolute -left-[2px] top-36 h-12 w-[3px] rounded-l-md bg-neutral-700" />
              <span aria-hidden className="absolute -left-[2px] top-52 h-12 w-[3px] rounded-l-md bg-neutral-700" />
              <span aria-hidden className="absolute -right-[2px] top-40 h-16 w-[3px] rounded-r-md bg-neutral-700" />

              <div className="relative flex h-[37rem] flex-col overflow-hidden rounded-[3rem] bg-background ring-1 ring-black/40">
                {/* status bar + dynamic island */}
                <div className="relative flex items-center justify-between px-7 pb-1 pt-3 text-[11px] font-semibold">
                  <span>9:41</span>
                  <span aria-hidden className="absolute left-1/2 top-2 h-[26px] w-28 -translate-x-1/2 rounded-full bg-black" />
                  <span className="flex items-center gap-1.5" aria-hidden>
                    <svg viewBox="0 0 16 12" className="h-3 w-4 fill-current"><rect x="0" y="7" width="3" height="5" rx="0.5"/><rect x="4.5" y="5" width="3" height="7" rx="0.5"/><rect x="9" y="2.5" width="3" height="9.5" rx="0.5"/><rect x="13" y="0" width="3" height="12" rx="0.5"/></svg>
                    <svg viewBox="0 0 24 12" className="h-3 w-6"><rect x="0.5" y="0.5" width="20" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.4"/><rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor"/><rect x="22" y="4" width="2" height="4" rx="1" fill="currentColor" fillOpacity="0.4"/></svg>
                  </span>
                </div>

                {/* app header (same as real app) */}
                <header className="flex h-12 items-center gap-3 border-b border-border px-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold ring-1 ring-border">M</span>
                  <h1 className="flex-1 truncate text-center font-display text-sm font-bold">{titles[view]}</h1>
                  <span className="flex items-center gap-0.5 text-muted-foreground">
                    <Bell className="h-4 w-4" />
                    <SettingsIcon className="h-4 w-4" />
                  </span>
                </header>

                {/* content */}
                <div className="flex-1 overflow-y-auto px-3 pb-24 pt-3">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={view} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>

                      {view === "home" && (
                        <div className="space-y-3">
                          <p className="text-[11px] font-medium text-primary">Lunes 28 · Semana 3 de 12</p>
                          <h4 className="font-display text-xl font-bold leading-tight">Hola, Nicolás.<br />Hoy toca fuerza.</h4>
                          <button type="button" onClick={() => changeView("training")} className="flex w-full items-center gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground transition-opacity hover:opacity-90">
                            <Dumbbell className="h-6 w-6 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold">Fuerza cuerpo completo</span>
                              <span className="block text-xs opacity-80">{exercises.length} ejercicios · ~45 min</span>
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0" />
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => changeView("nutrition")} className="rounded-2xl border border-border p-3 text-left transition-colors hover:bg-secondary">
                              <div className="flex items-center gap-2">
                                <svg viewBox="0 0 36 36" aria-hidden className="h-9 w-9 -rotate-90 shrink-0">
                                  <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-border" strokeWidth="4" />
                                  <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-primary" strokeWidth="4" strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset="38" />
                                </svg>
                                <div className="min-w-0">
                                  <p className="flex items-center gap-1 text-xs font-semibold"><Utensils className="h-3 w-3 text-primary" />Nutrición <Lock className="h-2.5 w-2.5 text-muted-foreground" /></p>
                                  <p className="text-[10px] text-muted-foreground">1.420 / 2.300 kcal</p>
                                </div>
                              </div>
                              <div className="mt-2 flex gap-1">
                                {[["P", 96, 150], ["C", 150, 240], ["G", 45, 75]].map(([l, v, t]) => (
                                  <div key={l as string} className="flex-1">
                                    <div className="h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${((v as number) / (t as number)) * 100}%` }} /></div>
                                    <p className="mt-0.5 text-[8px] text-muted-foreground">{l}</p>
                                  </div>
                                ))}
                              </div>
                            </button>
                            <button type="button" onClick={() => changeView("progress")} className="rounded-2xl border border-border p-3 text-left transition-colors hover:bg-secondary">
                              <p className="flex items-center gap-1 text-xs font-semibold"><LineChart className="h-3 w-3 text-primary" />Tu semana</p>
                              <p className="text-[10px] text-muted-foreground">2 de 3 sesiones</p>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full w-2/3 rounded-full bg-primary" /></div>
                            </button>
                          </div>
                          <div className="flex gap-2.5 rounded-2xl bg-secondary p-3">
                            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <p className="text-xs leading-relaxed"><span className="font-semibold">En planes con entrenador:</span> <span className="text-muted-foreground">recibes seguimiento humano y ajustes de tu plan. Gratis tienes registro y progreso.</span></p>
                          </div>
                        </div>
                      )}


                      {view === "training" && (
                        <div>
                          <p className="text-[11px] font-medium text-primary">Lunes · Semana 3 de 12</p>
                          <div className="mt-1 flex items-end justify-between">
                            <h4 className="font-display text-lg font-bold leading-tight">Fuerza cuerpo completo</h4>
                            <p role="status" className="text-xs font-semibold">{completed.length} de {totalSets} series</p>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>

                          {!started && (
                            <Button type="button" variant="hero" className="mt-4 h-11 w-full" onClick={() => {
                              setStarted(true);
                              setExpandedExercise(exercises[0].name);
                            }}>
                              Empezar entrenamiento
                            </Button>
                          )}

                          <div className="mt-4 space-y-2">
                            {exercises.map(({ name, sets, reps, load, last }) => {
                              const doneSets = Array.from({ length: sets }, (_, index) => completed.includes(`${name}::${index}`)).filter(Boolean).length;
                              const allDone = doneSets === sets;
                              const expanded = expandedExercise === name;
                              return (
                                <div key={name} className={`overflow-hidden rounded-2xl border ${allDone ? "border-primary/40" : "border-border"}`}>
                                  <button
                                    type="button"
                                    aria-expanded={expanded}
                                    onClick={() => {
                                      setStarted(true);
                                      setExpandedExercise(expanded ? null : name);
                                    }}
                                    className="flex w-full items-center gap-3 p-3 text-left"
                                  >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary"><Dumbbell className="h-5 w-5 text-muted-foreground" /></span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-semibold">{name}</span>
                                      <span className="block text-xs text-muted-foreground">{sets} series · {reps} reps · {load}</span>
                                      <span className="block text-[10px] text-muted-foreground/80">{last}</span>
                                    </span>
                                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{doneSets}/{sets}</span>
                                  </button>
                                  {started && expanded && (
                                    <div className="space-y-1.5 border-t border-border p-2">
                                      {Array.from({ length: sets }, (_, setIndex) => {
                                        const setKey = `${name}::${setIndex}`;
                                        const isDone = completed.includes(setKey);
                                        const currentSet = setValues[setKey] || { weight: load.replace(/\s*kg$/, ""), reps };
                                        return (
                                          <div key={setKey} className={`grid grid-cols-[1.5rem_1fr_1fr_2.5rem] items-center gap-1 rounded-xl p-2 ${isDone ? "bg-primary/10" : "bg-secondary/40"}`}>
                                            <span className="text-center text-xs font-semibold text-muted-foreground">{setIndex + 1}</span>
                                            <label className="min-w-0">
                                              <span className="sr-only">Peso de la serie {setIndex + 1} de {name}</span>
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                value={currentSet.weight}
                                                onChange={(event) => updateSetValue(setKey, "weight", event.target.value)}
                                                aria-label={`Peso de la serie ${setIndex + 1} de ${name}`}
                                                className="w-full rounded-lg border border-border bg-background px-1.5 py-2 text-center text-xs"
                                              />
                                            </label>
                                            <label className="min-w-0">
                                              <span className="sr-only">Repeticiones de la serie {setIndex + 1} de {name}</span>
                                              <input
                                                type="number"
                                                inputMode="numeric"
                                                min="0"
                                                value={currentSet.reps}
                                                onChange={(event) => updateSetValue(setKey, "reps", event.target.value)}
                                                aria-label={`Repeticiones de la serie ${setIndex + 1} de ${name}`}
                                                className="w-full rounded-lg border border-border bg-background px-1.5 py-2 text-center text-xs"
                                              />
                                            </label>
                                            <button
                                              type="button"
                                              aria-pressed={isDone}
                                              aria-label={`${isDone ? "Desmarcar" : "Marcar"} serie ${setIndex + 1} de ${name}`}
                                              onClick={() => toggleSet(name, setIndex)}
                                              className={`flex h-9 w-9 items-center justify-center rounded-lg ${isDone ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                                            >
                                              {isDone && <Check className="h-4 w-4" />}
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {completed.length > 0 && completed.length < totalSets && (
                            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-primary/10 p-3 text-xs"><Timer className="h-4 w-4 text-primary" /><span className="font-semibold">Descanso 1:30</span><span className="text-muted-foreground">· siguiente ejercicio</span></div>
                          )}
                          {completed.length === totalSets && (
                            <div className="mt-3 rounded-2xl bg-primary/10 p-3 text-center text-xs font-semibold">Sesión de ejemplo completada · {totalSets} series registradas</div>
                          )}
                          <div className="mt-3 text-center">
                            <Button variant="ghost" size="sm" onClick={resetWorkout}><RotateCcw className="h-3.5 w-3.5" /> Reiniciar demo</Button>
                          </div>
                        </div>
                      )}

                      {view === "nutrition" && (
                        <div>
                          <p className="text-[11px] font-medium text-primary">Hoy · plan Completo</p>
                          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-secondary p-3">
                            <span className="flex items-center gap-2 text-xs font-semibold"><Lock className="h-4 w-4 text-primary" />Plan Completo</span>
                            <span className="text-[10px] text-muted-foreground">Función de pago</span>
                          </div>
                          <div className="mt-3 flex items-center gap-4 rounded-2xl bg-secondary p-4">
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
                          <p className="mt-3 text-[10px] text-muted-foreground">Comidas ilustrativas, sin recomendaciones para tu caso. Nutrición disponible en Completo, no en Gratis.</p>
                        </div>
                      )}

                      {view === "chat" && (
                        <div className="flex h-full flex-col">
                          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2">
                            <span className="flex items-center gap-1.5 text-[10px] font-semibold"><Lock className="h-3.5 w-3.5 text-primary" />Plan con entrenador</span>
                            <span className="text-[9px] text-muted-foreground">No incluido en Gratis</span>
                          </div>
                          <div className="flex items-center gap-2.5 border-b border-border pb-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">N</span>
                            <div>
                              <p className="text-sm font-semibold">Niko · tu entrenador</p>
                              <p className="text-[10px] text-muted-foreground">Respuesta: 48 h · Completo: 24 h</p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2.5">
                            {chatMessages.map((m, i) => (
                              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${m.from === "me" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary"}`}>
                                  <p>{m.text}</p>
                                  <p className={`mt-0.5 text-right text-[9px] ${m.from === "me" ? "opacity-70" : "text-muted-foreground"}`}>{m.time}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1.5 pl-4 pr-1.5">
                            <span className="flex-1 text-xs text-muted-foreground">Escribe a tu entrenador…</span>
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Send className="h-3.5 w-3.5" /></span>
                          </div>
                          <p className="mt-3 text-[10px] text-muted-foreground">Conversación de ejemplo; en la app real hablas con tu entrenador.</p>
                        </div>
                      )}

                      {view === "progress" && (
                        <div>
                          <p className="text-[11px] font-medium text-primary">Tu progreso · muestra ficticia</p>
                          <div className="mt-3 rounded-2xl border border-border p-3">
                            <p className="text-xs text-muted-foreground">Sesiones esta semana</p>
                            <div className="mt-2 flex gap-1.5">{["L", "M", "X", "J", "V", "S", "D"].map((d, i) => <span key={d} className={`flex h-8 flex-1 items-center justify-center rounded-lg text-[10px] font-semibold ${[0, 2].includes(i) ? "bg-primary text-primary-foreground" : i === 4 ? "border border-dashed border-primary" : "bg-secondary text-muted-foreground"}`}>{d}</span>)}</div>
                            <p className="mt-2 text-xs"><span className="font-semibold">2 de 3 sesiones previstas</span> <span className="text-muted-foreground">· la rutina marca tus días</span></p>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold"><Dumbbell className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">Progresión por ejercicio</span></div>
                            <select
                              aria-label="Ejercicio para ver progresión en demo"
                              value={progressExercise}
                              onChange={(event) => setProgressExercise(event.target.value)}
                              className="min-h-9 max-w-32 rounded-lg border border-border bg-background px-2 text-[10px]"
                            >
                              {demoProgressExercises.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </div>
                          <div className="mt-2 rounded-2xl border border-border bg-card p-3">
                            <Suspense fallback={<div className="h-36 animate-pulse rounded-xl bg-secondary/50" aria-label="Cargando gráfica" />}>
                              <ExerciseProgressChart
                                exerciseName={progressExercise}
                                history={demoHistory[progressExercise]}
                                metric={progressMetric}
                                onMetricChange={(m) => { if (m !== "reps") setProgressMetric(m); }}
                                compact
                              />
                            </Suspense>
                            {demoHistory[progressExercise][demoHistory[progressExercise].length - 1] && (
                              <div className="mt-3 grid grid-cols-2 gap-1.5">
                                {[
                                  ["Series", demoHistory[progressExercise][demoHistory[progressExercise].length - 1].completedSets],
                                  ["Repeticiones", demoHistory[progressExercise][demoHistory[progressExercise].length - 1].reps],
                                  ["Volumen", `${Math.round(demoHistory[progressExercise][demoHistory[progressExercise].length - 1].volumeKg)} kg`],
                                  ["1RM estimado", `${demoHistory[progressExercise][demoHistory[progressExercise].length - 1].bestEstimated1RmKg ?? "—"} kg`],
                                ].map(([label, value]) => (
                                  <div key={label} className="rounded-lg bg-secondary/50 p-2">
                                    <p className="text-xs font-bold">{value}</p>
                                    <p className="text-[9px] text-muted-foreground">{label}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="mt-3 rounded-2xl border border-border p-3">
                            <p className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-primary" />Récords personales</p>
                            <div className="mt-2 space-y-1.5">
                              {demoBestRecords.map(({ name, best }) => (
                                <div key={name} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-2.5 py-2">
                                  <span className="truncate text-[10px] font-medium">{name}</span>
                                  <span className="shrink-0 text-[10px] font-semibold text-primary">{best.bestSetLabel} · ~{best.bestEstimated1RmKg} kg</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-3 rounded-2xl border border-border p-3">
                            <p className="flex items-center gap-1.5 text-xs font-semibold"><Camera className="h-3.5 w-3.5 text-primary" />Fotos de progreso</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">Documenta tu evolución con fotos de frente, lateral y espalda.</p>
                            {onFree && (
                              <button type="button" onClick={onFree} className="mt-2 min-h-8 text-[10px] font-semibold text-primary underline underline-offset-2">
                                Crear cuenta para subir fotos
                              </button>
                            )}
                          </div>
                          <p className="mt-3 text-[10px] text-muted-foreground">Datos ficticios de ejemplo. En tu cuenta, las gráficas se construyen con tus propias series completadas.</p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* floating tab bar (same 5 tabs as the real app) */}
                <nav className="absolute inset-x-3 bottom-5 rounded-full border border-border bg-background/85 px-1.5 py-1.5 shadow-lg backdrop-blur-xl" role="group" aria-label="Secciones de la demo">
                  <div className="grid grid-cols-5">
                    {views.map(({ key, label, icon: Icon }) => {
                      const active = view === key;
                      return (
                        <button key={key} type="button" aria-pressed={active} onClick={() => changeView(key)}
                          className={`relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-full text-[9px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                          {active && <motion.span layoutId="demo-tab" className="absolute inset-0 rounded-full bg-primary/10" transition={{ type: "spring", bounce: 0.25, duration: 0.5 }} />}
                          <Icon className="relative h-5 w-5" />
                          <span className="relative">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </nav>

                {/* home indicator */}
                <span aria-hidden className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-foreground/30" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {onFree && <Button variant="hero" onClick={onFree}>Crear cuenta gratis y guardar mi progreso <ArrowRight className="h-4 w-4" /></Button>}
          <Button variant="outline" onClick={onPlans}>Ver qué incluye cada plan</Button>
        </div>
      </div>
    </section>
  );
}
