import { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Apple, ArrowRight, Bell, Check, Dumbbell, Home, LineChart, MessageCircle,
  RotateCcw, Send, Settings as SettingsIcon, Sparkles, Timer, Utensils, Lock, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { euro, usePlanAvailability } from "@/lib/planCatalog";
import { track } from "@/lib/analytics";
import { buildExerciseHistory } from "@/lib/workoutMetrics";
import { supabase } from "@/integrations/supabase/client";
import { isIOSNative } from "@/lib/platform";

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
  chat: "Nicolás",
  progress: "Progreso",
};

const exercises = [
  { name: "Sentadilla goblet", sets: 3, reps: 9, load: "20 kg", last: "Última vez: 18 kg × 10", image: "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/14988835-a004-49d6-95c5-63978dbce978-1791475887313.png" },
  { name: "Remo con mancuerna", sets: 3, reps: 11, load: "16 kg", last: "Última vez: 14 kg × 12", image: "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/d5e30e05-0791-4886-84a0-7b2695728225-1791475865184.png" },
  { name: "Press con mancuernas", sets: 3, reps: 9, load: "14 kg", last: "Última vez: 14 kg × 8", image: "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png" },
];

const baseSide: Record<View, { title: string; points: string[] }> = {
  home: {
    title: "Abres la app y sabes qué toca hoy.",
    points: ["Tu rutina y el progreso de tus sesiones están a mano.", "Empieza gratis y registra tus entrenamientos sin tarjeta.", "La nutrición y la progresión automática dependen del plan elegido."],
  },
  training: {
    title: "Sabes qué hacer al entrar al gimnasio.",
    points: ["Registra por separado el peso y las repeticiones de cada serie.", "Ves lo que levantaste la última vez para progresar.", "El tracker y el progreso están incluidos en el plan Gratis."],
  },
  nutrition: {
    title: "Tu plan de nutrición, incluido desde Plus.",
    points: ["Calorías y macros del día de un vistazo.", "Comidas ajustadas a tus gustos y a lo que registras.", "Esta sección no está incluida en el plan Gratis."],
  },
  chat: {
    title: "Una persona real al otro lado.",
    points: ["Dudas, molestias o cambios: se los cuentas a Nicolás, el fundador.", "Te responde él y ajusta tu plan; no es un bot.", "El chat personal es exclusivo del plan Coach."],
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
  // iOS v1 (reader app, App Store §3.1.3(a)): preview includes plan copy and prices.
  // Only ever rendered from public landing pages (already route-blocked), but we
  // keep the belt-and-braces guard in case a future screen imports it.
  if (isIOSNative()) return null;
  return <ProductPreviewContent onPlans={onPlans} onFree={onFree} />;
}

function ProductPreviewContent({ onPlans, onFree }: { onPlans: () => void; onFree?: () => void }) {
  const [view, setView] = useState<View>("home");
  const plans = usePlanAvailability();
  // The chat tab sells Coach: it disappears when Coach is hidden in Admin → Planes.
  const shownViews = views.filter((v) => v.key !== "chat" || plans.coach);
  useEffect(() => { if (view === "chat" && !plans.coach) setView("home"); }, [view, plans.coach]);
  const paidLabel = [plans.plus && plans.plusName, plans.coach && plans.coachName].filter(Boolean).join(" y ") || "planes de pago";
  const side: Record<View, { title: string; points: string[] }> = {
    ...baseSide,
    home: { ...baseSide.home, points: [baseSide.home.points[0], baseSide.home.points[1], plans.coach ? `La nutrición y el chat con Nicolás dependen del plan elegido.` : baseSide.home.points[2]] },
    nutrition: { ...baseSide.nutrition, title: `Tu plan de nutrición, incluido desde ${plans.plus ? plans.plusName : plans.coachName}.` },
    chat: { ...baseSide.chat, points: [baseSide.chat.points[0], baseSide.chat.points[1], `El chat personal es exclusivo del plan ${plans.coachName}.`] },
  };
  // Nombre y foto reales de Ajustes (get_public_settings): si cambias la foto, la demo cambia.
  const [owner, setOwner] = useState<{ name: string; photo: string | null }>({ name: "Nicolás", photo: null });
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)("get_founder_public").then(({ data }: { data: { name: string | null; avatar_url: string | null }[] | null }) => {
      const row = data?.[0];
      if (alive && row) setOwner({ name: row.name?.trim() || "Nicolás", photo: row.avatar_url || null });
    });
    return () => { alive = false; };
  }, []);
  const ownerFirst = owner.name.split(" ")[0];
  const ownerInitial = ownerFirst.charAt(0).toUpperCase();
  const [completed, setCompleted] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [rest, setRest] = useState<number | null>(null);
  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) { setRest(null); return; }
    const id = setTimeout(() => setRest((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(id);
  }, [rest]);
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
    setActiveIdx(0);
    setRest(null);
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
            <p className="mb-3 text-xs font-semibold text-primary">Antes de decidir</p>
            <h2 id="preview-heading" className="font-display text-3xl font-bold sm:text-4xl">Prueba cómo sería tu día.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Explora una simulación del plan, el registro por series y la evolución con gráficos.{plans.plus ? ` La nutrición está incluida desde ${plans.plusName}.` : ""}{plans.coach ? ` El chat con Nicolás, en ${plans.coachName}.` : ""} Free incluye rutina inicial, registro y progreso. Sin cuenta ni tarjeta.</p>
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
                <p className="mt-6 max-w-md text-sm text-muted-foreground">{view === "nutrition" ? `El plan de nutrición está incluido desde ${plans.plus ? plans.plusName : plans.coachName} · ${euro(plans.plus ? plans.plusPrice : plans.coachPrice)}/mes tras la prueba. No forma parte del plan Free.` : view === "chat" ? `El chat con Nicolás es exclusivo del plan ${plans.coachName} · ${euro(plans.coachPrice)}/mes tras la prueba. No está incluido en Free${plans.plus ? ` ni en ${plans.plusName}` : ""}.` : "La demo usa datos ficticios. Gratis incluye rutina inicial, registro y progreso; la nutrición llega con Plus y el entrenador real con Coach."}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* iPhone frame */}
          <div className="order-1 mx-auto w-full max-w-[22rem] md:order-2">
            <div className="relative rounded-[3.25rem] bg-neutral-900 p-[3px] ring-1 ring-neutral-700/60">
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-bold ring-1 ring-border">
                    {owner.photo ? <img src={owner.photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : ownerInitial}
                  </span>
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
                          <h4 className="font-display text-xl font-bold leading-tight">Hola, Laura.<br />Hoy toca fuerza.</h4>
                          <button type="button" onClick={() => changeView("training")} className="flex w-full items-center gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80">
                            <Dumbbell className="h-6 w-6 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold">Fuerza cuerpo completo</span>
                              <span className="block text-xs opacity-80">{exercises.length} ejercicios · ~45 min</span>
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0" />
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => changeView("nutrition")} className="rounded-2xl bg-secondary p-3 text-left transition-colors hover:bg-secondary active:bg-secondary">
                              <div className="flex items-center gap-2">
                                <svg viewBox="0 0 36 36" aria-hidden className="h-9 w-9 -rotate-90 shrink-0">
                                  <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-border" strokeWidth="4" />
                                  <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-primary" strokeWidth="4" strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset="38" />
                                </svg>
                                <div className="min-w-0">
                                  <p className="flex items-center gap-1 text-xs font-semibold"><Utensils className="h-3 w-3 text-primary" />Nutrición <Lock className="h-2.5 w-2.5 text-muted-foreground" /></p>
                                  <p className="text-[11px] text-muted-foreground">1.420 / 2.300 kcal</p>
                                </div>
                              </div>
                              <div className="mt-2 flex gap-1">
                                {[["P", 96, 150], ["C", 150, 240], ["G", 45, 75]].map(([l, v, t]) => (
                                  <div key={l as string} className="flex-1">
                                    <div className="h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${((v as number) / (t as number)) * 100}%` }} /></div>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">{l}</p>
                                  </div>
                                ))}
                              </div>
                            </button>
                            <button type="button" onClick={() => changeView("progress")} className="rounded-2xl bg-secondary p-3 text-left transition-colors hover:bg-secondary active:bg-secondary">
                              <p className="flex items-center gap-1 text-xs font-semibold"><LineChart className="h-3 w-3 text-primary" />Progreso semanal</p>
                              <p className="text-[11px] text-muted-foreground">2 de 3 sesiones</p>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full w-2/3 rounded-full bg-primary" /></div>
                            </button>
                          </div>
                          <div className="flex gap-2.5 rounded-2xl bg-secondary p-3">
                            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <p className="text-xs leading-relaxed">{plans.coach ? <><span className="font-semibold">En {plans.coachName}:</span> <span className="text-muted-foreground">recibes seguimiento humano y ajustes de tu plan. Gratis tienes registro y progreso.</span></> : <span className="text-muted-foreground">Gratis tienes rutina, registro y progreso{plans.plus ? `; ${plans.plusName} añade nutrición y progresión automática` : ""}.</span>}</p>
                          </div>
                        </div>
                      )}


                      {view === "training" && (
                        <div>
                          <div className="flex items-end justify-between">
                            <h4 className="font-display text-lg font-bold leading-tight">Fuerza cuerpo completo</h4>
                            <p role="status" className="text-xs font-semibold">{completed.length} de {totalSets} series</p>
                          </div>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>

                          {!started ? (
                            <>
                              <div className="mt-3 divide-y divide-border">
                                {exercises.map((ex, i) => (
                                  <button key={ex.name} type="button" onClick={() => { setStarted(true); setActiveIdx(i); }} className="flex w-full items-center gap-3 py-2.5 text-left">
                                    <img src={ex.image} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-xl bg-card object-contain" />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-semibold">{ex.name}</span>
                                      <span className="block text-xs text-muted-foreground">{ex.sets} × {ex.reps} · {ex.load}</span>
                                    </span>
                                  </button>
                                ))}
                              </div>
                              <Button type="button" variant="hero" className="mt-4 h-11 w-full" onClick={() => { setStarted(true); setActiveIdx(0); }}>
                                Empezar entrenamiento
                              </Button>
                            </>
                          ) : (() => {
                            const ex = exercises[activeIdx];
                            return (
                              <div className="mt-3 space-y-3">
                                <motion.div
                                  key={ex.name}
                                  initial={{ opacity: 0.4 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ duration: 0.18 }}
                                  drag="x"
                                  dragConstraints={{ left: 0, right: 0 }}
                                  dragElastic={0.35}
                                  onDragEnd={(_, info) => {
                                    const swipe = info.offset.x + info.velocity.x * 0.2;
                                    if (swipe < -60 && activeIdx < exercises.length - 1) setActiveIdx(activeIdx + 1);
                                    else if (swipe > 60 && activeIdx > 0) setActiveIdx(activeIdx - 1);
                                  }}
                                  style={{ touchAction: "pan-y" }}
                                  aria-label="Desliza para cambiar de ejercicio"
                                  className="relative flex aspect-[4/3] w-full cursor-grab items-center justify-center overflow-hidden rounded-3xl bg-card active:cursor-grabbing"
                                >
                                  <img src={ex.image} alt={ex.name} draggable={false} decoding="async" className="pointer-events-none h-full w-full object-contain" />
                                  <span className="absolute bottom-2 right-3 text-[11px] text-muted-foreground">{activeIdx + 1}/{exercises.length}</span>
                                </motion.div>
                                <div role="tablist" aria-label="Ejercicios de la sesión" className="flex gap-2">
                                  {exercises.map((item, idx) => {
                                    const done = Array.from({ length: item.sets }, (_, s) => completed.includes(`${item.name}::${s}`)).every(Boolean);
                                    return (
                                      <button key={item.name} type="button" role="tab" aria-selected={idx === activeIdx} aria-label={`${idx + 1}. ${item.name}${done ? " · hecho" : ""}`} onClick={() => setActiveIdx(idx)}
                                        className={`relative rounded-2xl p-0.5 transition-all ${idx === activeIdx ? "ring-2 ring-primary" : "opacity-60"}`}>
                                        <img src={item.image} alt="" className="h-11 w-11 rounded-xl bg-card object-contain" />
                                        {done && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-2.5 w-2.5" /></span>}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div>
                                  <p className="font-display text-base font-bold leading-tight">{ex.name}</p>
                                  <p className="text-[11px] text-muted-foreground">{ex.last}</p>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="grid grid-cols-[1.5rem_1fr_1fr_2.25rem] gap-1 px-1 text-[11px] font-semibold text-muted-foreground">
                                    <span className="text-center">#</span><span className="text-center">KG</span><span className="text-center">Reps</span><span />
                                  </div>
                                  {Array.from({ length: ex.sets }, (_, setIndex) => {
                                    const setKey = `${ex.name}::${setIndex}`;
                                    const isDone = completed.includes(setKey);
                                    const currentSet = setValues[setKey];
                                    return (
                                      <div key={setKey} className={`grid grid-cols-[1.5rem_1fr_1fr_2.25rem] items-center gap-1 rounded-xl p-1.5 ${isDone ? "bg-primary/10" : ""}`}>
                                        <span className="text-center text-xs font-semibold text-muted-foreground">{setIndex + 1}</span>
                                        <input type="text" inputMode="decimal" placeholder={ex.load.replace(/\s*kg$/, "")} value={currentSet?.weight ?? ""} onChange={(e) => updateSetValue(setKey, "weight", e.target.value)} aria-label={`Peso de la serie ${setIndex + 1} de ${ex.name}`} className="w-full rounded-lg bg-secondary px-1.5 py-2 text-center text-xs placeholder:text-muted-foreground/60" />
                                        <input type="number" inputMode="numeric" min="0" placeholder={String(ex.reps)} value={currentSet?.reps ?? ""} onChange={(e) => updateSetValue(setKey, "reps", e.target.value)} aria-label={`Repeticiones de la serie ${setIndex + 1} de ${ex.name}`} className="w-full rounded-lg bg-secondary px-1.5 py-2 text-center text-xs placeholder:text-muted-foreground/60" />
                                        <button type="button" aria-pressed={isDone} aria-label={`${isDone ? "Desmarcar" : "Marcar"} serie ${setIndex + 1} de ${ex.name}`}
                                          onClick={() => { const wasDone = isDone; toggleSet(ex.name, setIndex); if (!wasDone) setRest(90); }}
                                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${isDone ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                                          <Check className="h-4 w-4" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                                {completed.length === totalSets && (
                                  <div className="rounded-2xl bg-primary/10 p-3 text-center text-xs font-semibold">Sesión de ejemplo completada · {totalSets} series</div>
                                )}
                                <div className="text-center">
                                  <Button variant="ghost" size="sm" onClick={resetWorkout}><RotateCcw className="h-3.5 w-3.5" /> Reiniciar demo</Button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {view === "nutrition" && (
                        <div>
                          <p className="text-[11px] font-medium text-primary">Hoy · plan {plans.plus ? plans.plusName : plans.coachName}</p>
                          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-secondary p-3">
                            <span className="flex items-center gap-2 text-xs font-semibold"><Lock className="h-4 w-4 text-primary" />{paidLabel}</span>
                            <span className="text-[11px] text-muted-foreground">Función de pago</span>
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
                              <div key={l as string} className="rounded-xl bg-secondary p-2.5">
                                <p className="text-[11px] text-muted-foreground">{l}</p>
                                <p className="text-sm font-semibold">{v}<span className="text-[11px] font-normal text-muted-foreground">/{t} g</span></p>
                                <div className="mt-1.5 h-1 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${((v as number) / (t as number)) * 100}%` }} /></div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 divide-y divide-border rounded-2xl bg-secondary">
                            {[["Desayuno", "Yogur, avena y fruta", true], ["Comida", "Arroz, pollo y verduras", true], ["Cena", "Tortilla, patata y ensalada", false]].map(([m, t, d]) => (
                              <div key={m as string} className="flex items-center justify-between gap-2 p-3">
                                <div><p className="text-sm font-semibold">{m}</p><p className="text-xs text-muted-foreground">{t}</p></div>
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${d ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{d && <Check className="h-3 w-3" />}</span>
                              </div>
                            ))}
                          </div>
                          <p className="mt-3 text-[11px] text-muted-foreground">Comidas ilustrativas, sin recomendaciones para tu caso. Nutrición disponible desde Plus.</p>
                        </div>
                      )}

                      {view === "chat" && (
                        <div className="flex h-full flex-col">
                          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2">
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold"><Lock className="h-3.5 w-3.5 text-primary" />Plan {plans.coachName}</span>
                            <span className="text-[11px] text-muted-foreground">No incluido en Gratis</span>
                          </div>
                          <div className="flex items-center gap-2.5 border-b border-border pb-3">
                            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {owner.photo ? <img src={owner.photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : ownerInitial}
                            </span>
                            <div>
                              <p className="text-sm font-semibold">{ownerFirst} · fundador</p>
                              <p className="text-[11px] text-muted-foreground">Chat directo · plan {plans.coachName}</p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2.5">
                            {chatMessages.map((m, i) => (
                              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${m.from === "me" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary"}`}>
                                  <p>{m.text}</p>
                                  <p className={`mt-0.5 text-right text-[11px] ${m.from === "me" ? "opacity-70" : "text-muted-foreground"}`}>{m.time}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex items-center gap-2 rounded-full bg-secondary py-1.5 pl-4 pr-1.5">
                            <span className="flex-1 text-xs text-muted-foreground">Escribe a tu entrenador…</span>
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Send className="h-3.5 w-3.5" /></span>
                          </div>
                          <p className="mt-3 text-[11px] text-muted-foreground">Conversación de ejemplo; en la app real hablas con tu entrenador.</p>
                        </div>
                      )}

                      {view === "progress" && (
                        <div>
                          <p className="text-[11px] font-medium text-primary">Tu progreso · muestra ficticia</p>
                          <div className="mt-3 rounded-2xl bg-secondary p-3">
                            <p className="text-xs text-muted-foreground">Sesiones esta semana</p>
                            <div className="mt-2 flex gap-1.5">{["L", "M", "X", "J", "V", "S", "D"].map((d, i) => <span key={d} className={`flex h-8 flex-1 items-center justify-center rounded-lg text-[11px] font-semibold ${[0, 2].includes(i) ? "bg-primary text-primary-foreground" : i === 4 ? "border border-dashed border-primary" : "bg-secondary text-muted-foreground"}`}>{d}</span>)}</div>
                            <p className="mt-2 text-xs"><span className="font-semibold">2 de 3 sesiones previstas</span> <span className="text-muted-foreground">· la rutina marca tus días</span></p>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold"><Dumbbell className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">Progresión por ejercicio</span></div>
                            <select
                              aria-label="Ejercicio para ver progresión en demo"
                              value={progressExercise}
                              onChange={(event) => setProgressExercise(event.target.value)}
                              className="min-h-9 max-w-32 rounded-lg border border-border bg-background px-2 text-[11px]"
                            >
                              {demoProgressExercises.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </div>
                          <div className="mt-2 rounded-2xl bg-secondary p-3">
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
                                    <p className="text-[11px] text-muted-foreground">{label}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="mt-3 rounded-2xl bg-secondary p-3">
                            <p className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-primary" />Récords personales</p>
                            <div className="mt-2 space-y-1.5">
                              {demoBestRecords.map(({ name, best }) => (
                                <div key={name} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-2.5 py-2">
                                  <span className="truncate text-[11px] font-medium">{name}</span>
                                  <span className="shrink-0 text-[11px] font-semibold text-primary">{best.bestSetLabel} · ~{best.bestEstimated1RmKg} kg</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-3 rounded-2xl bg-secondary p-3">
                            <p className="flex items-center gap-1.5 text-xs font-semibold"><Camera className="h-3.5 w-3.5 text-primary" />Fotos de progreso</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">Documenta tu evolución con fotos de frente, lateral y espalda.</p>
                            {onFree && (
                              <button type="button" onClick={onFree} className="mt-2 min-h-8 text-[11px] font-semibold text-primary underline underline-offset-2">
                                Crear cuenta para subir fotos
                              </button>
                            )}
                          </div>
                          <p className="mt-3 text-[11px] text-muted-foreground">Datos ficticios de ejemplo. En tu cuenta, las gráficas se construyen con tus propias series completadas.</p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {view === "training" && rest !== null && (
                    <motion.div initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.9 }}
                      className="absolute inset-x-10 bottom-[5.25rem] z-10 flex items-center justify-between rounded-full bg-foreground px-3 py-2 text-background" role="timer" aria-label="Descanso">
                      <button type="button" onClick={() => setRest((r) => Math.max(5, (r ?? 0) - 30))} className="h-7 rounded-full px-2 text-xs font-semibold opacity-80">−30</button>
                      <span className="flex items-center gap-1.5 font-display text-sm font-bold tabular-nums"><Timer className="h-3.5 w-3.5" />{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}</span>
                      <button type="button" onClick={() => setRest((r) => (r ?? 0) + 30)} className="h-7 rounded-full px-2 text-xs font-semibold opacity-80">+30</button>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* floating tab bar (same 5 tabs as the real app) */}
                <nav className="absolute inset-x-3 bottom-5 rounded-full bg-background/85 px-1.5 py-1.5 backdrop-blur-xl" role="group" aria-label="Secciones de la demo">
                  <div className={`grid ${shownViews.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
                    {shownViews.map(({ key, label, icon: Icon }) => {
                      const active = view === key;
                      return (
                        <button key={key} type="button" aria-pressed={active} onClick={() => changeView(key)}
                          className={`relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground active:opacity-70"}`}>
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
          {onFree && <Button variant="hero" className="min-h-12" onClick={onFree}>Crear mi propia rutina gratis <ArrowRight className="h-4 w-4" /></Button>}
          <Button variant="outline" onClick={onPlans}>Ver qué incluye cada plan</Button>
        </div>
      </div>
    </section>
  );
}
