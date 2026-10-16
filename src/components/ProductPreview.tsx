import { lazy, Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Apple, Check, CheckCircle2, ChevronsUpDown, Dumbbell, Home, ImageOff, Lock, MessageCircle,
  Send, Sparkles, Timer, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListGroup, ListRow } from "@/components/ui/list";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { PhoneAppBar, PhoneFrame, PhoneHome, PhoneTabBar, PhoneWeek } from "@/components/PublicPhone";
import { euro, usePlanAvailability } from "@/lib/planCatalog";
import { track } from "@/lib/analytics";
import { buildExerciseHistory } from "@/lib/workoutMetrics";
import { supabase } from "@/integrations/supabase/client";
import { isIOSNative } from "@/lib/platform";
import { hapticImpact, hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";

const ExerciseProgressChart = lazy(() => import("@/components/dashboard/ExerciseProgressChart"));

const views = [
  { key: "home", label: "Hoy", icon: Home },
  { key: "training", label: "Plan", icon: Dumbbell },
  { key: "nutrition", label: "Nutrición", icon: Apple },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "progress", label: "Progreso", icon: Sparkles },
] as const;
type View = (typeof views)[number]["key"];

const titles: Record<Exclude<View, "home">, string> = {
  training: "Plan",
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
  { from: "trainer", text: "Perfecto, sube a 20 kg la próxima. Para el remo te dejo alternativa con mancuerna en el plan.", time: "9:16" },
];

/** Exercise picture with a composed gap if the URL fails to load. */
function DemoImage({ src, alt, className, draggable }: { src: string; alt: string; className?: string; draggable?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={cn("flex items-center justify-center bg-secondary", className)}><ImageOff className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" /></span>;
  return <img src={src} alt={alt} draggable={draggable} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn("bg-secondary object-contain", className)} />;
}

/** Founder photo, or their initial when it is missing or fails to load. */
function OwnerAvatar({ photo, initial }: { photo: string | null; initial: string }) {
  const [failed, setFailed] = useState(false);
  return photo && !failed ? <img src={photo} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" /> : <>{initial}</>;
}

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

  const changeView = (key: View) => { void hapticSelection(); setView(key); track("plan_preview_view", { source: "public_demo", section: key }); };

  const lastEntry = demoHistory[progressExercise][demoHistory[progressExercise].length - 1];

  return (
    <section id="ver-app" aria-labelledby="preview-heading" className="scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="type-subhead text-primary">Antes de decidir</p>
            <h2 id="preview-heading" className="mt-1 type-title1 sm:text-[40px] sm:leading-[44px]">Prueba cómo sería tu día.</h2>
            <p className="mt-3 type-body text-muted-foreground">Explora una simulación del plan, el registro por series y la evolución con gráficos.{plans.plus ? ` La nutrición está incluida desde ${plans.plusName}.` : ""}{plans.coach ? ` El chat con Nicolás, en ${plans.coachName}.` : ""} Free incluye rutina inicial, registro y progreso. Sin cuenta ni tarjeta.</p>
          </div>
          <span className="type-footnote text-muted-foreground">Demo con datos ficticios · no es un plan personal</span>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-[1fr_22rem] md:gap-16">
          <div className="order-2 md:order-1">
            <h3 className="type-title1">{side[view].title}</h3>
            <ul className="mt-6 space-y-4">
              {side[view].points.map(p => (
                <li key={p} className="flex items-start gap-3 type-body text-muted-foreground"><Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />{p}</li>
              ))}
            </ul>
            <p className="mt-6 max-w-md type-footnote text-muted-foreground">{view === "nutrition" ? `El plan de nutrición está incluido desde ${plans.plus ? plans.plusName : plans.coachName} · ${euro(plans.plus ? plans.plusPrice : plans.coachPrice)}/mes tras la prueba. No forma parte del plan Free.` : view === "chat" ? `El chat con Nicolás es exclusivo del plan ${plans.coachName} · ${euro(plans.coachPrice)}/mes tras la prueba. No está incluido en Free${plans.plus ? ` ni en ${plans.plusName}` : ""}.` : "La demo usa datos ficticios. Gratis incluye rutina inicial, registro y progreso; la nutrición llega con Plus y el entrenador real con Coach."}</p>
          </div>

          <div className="order-1 mx-auto w-full max-w-[22rem] md:order-2">
            <PhoneFrame screenClassName="h-[37rem]">
              <PhoneAppBar avatar={<OwnerAvatar photo={owner.photo} initial={ownerInitial} />} />

              <div className="flex-1 overflow-y-auto px-4 pb-28 pt-2">
                {view === "home" && (
                  <>
                    <h1 className="sr-only">Hoy</h1>
                    <PhoneHome plans={plans} exerciseCount={exercises.length} heading onSession={() => changeView("training")} onNutrition={() => changeView("nutrition")} onProgress={() => changeView("progress")} />
                  </>
                )}

                {view === "training" && (
                  <div>
                    <h1 className="type-large-title">{titles.training}</h1>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <h4 className="type-title3">Fuerza cuerpo completo</h4>
                      <p role="status" className="shrink-0 type-subhead tabular-nums text-muted-foreground">{completed.length} de {totalSets} series</p>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-ios" style={{ width: `${pct}%` }} /></div>

                    {!started ? (
                      <>
                        <ListGroup className="mt-5" header="Ejercicios">
                          {exercises.map((ex, i) => (
                            <ListRow
                              key={ex.name}
                              leading={<DemoImage src={ex.image} alt="" className="h-12 w-12 shrink-0 rounded-[10px]" />}
                              title={ex.name}
                              subtitle={`${ex.sets} × ${ex.reps} · ${ex.load}`}
                              chevron
                              onClick={() => { void hapticTap(); setStarted(true); setActiveIdx(i); }}
                            />
                          ))}
                        </ListGroup>
                        <Button type="button" variant="hero" size="lg" className="mt-5 w-full" onClick={() => { void hapticTap(); setStarted(true); setActiveIdx(0); }}>
                          Empezar entrenamiento
                        </Button>
                      </>
                    ) : (() => {
                      const ex = exercises[activeIdx];
                      return (
                        <div className="mt-5 space-y-4">
                          <motion.div
                            key={ex.name}
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
                            className="relative flex aspect-[4/3] w-full cursor-grab items-center justify-center overflow-hidden rounded-2xl bg-card active:cursor-grabbing"
                          >
                            <DemoImage src={ex.image} alt={ex.name} draggable={false} className="pointer-events-none h-full w-full bg-card" />
                            <span className="absolute bottom-2 right-3 type-caption1 tabular-nums text-muted-foreground">{activeIdx + 1}/{exercises.length}</span>
                          </motion.div>
                          <div role="tablist" aria-label="Ejercicios de la sesión" className="flex gap-2">
                            {exercises.map((item, idx) => {
                              const done = Array.from({ length: item.sets }, (_, s) => completed.includes(`${item.name}::${s}`)).every(Boolean);
                              return (
                                <button key={item.name} type="button" role="tab" aria-selected={idx === activeIdx} aria-label={`${idx + 1}. ${item.name}${done ? " · hecho" : ""}`} onClick={() => { void hapticSelection(); setActiveIdx(idx); }}
                                  className={`relative rounded-2xl p-0.5 transition-opacity active:opacity-60 ${idx === activeIdx ? "ring-2 ring-primary" : "opacity-60"}`}>
                                  <DemoImage src={item.image} alt="" className="h-11 w-11 rounded-[14px]" />
                                  {done && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                                </button>
                              );
                            })}
                          </div>
                          <div>
                            <p className="type-title3">{ex.name}</p>
                            <p className="type-footnote text-muted-foreground">{ex.last}</p>
                          </div>
                          <div className="space-y-1">
                            <div className="grid grid-cols-[1.5rem_1fr_1fr_2.75rem] gap-2 px-1.5 type-group-header">
                              <span className="text-center">#</span><span className="text-center">kg</span><span className="text-center">Reps</span><span />
                            </div>
                            {Array.from({ length: ex.sets }, (_, setIndex) => {
                              const setKey = `${ex.name}::${setIndex}`;
                              const isDone = completed.includes(setKey);
                              const currentSet = setValues[setKey];
                              return (
                                <div key={setKey} className={`grid grid-cols-[1.5rem_1fr_1fr_2.75rem] items-center gap-2 rounded-xl p-1.5 transition-colors duration-200 ${isDone ? "bg-primary/15" : ""}`}>
                                  <span className="text-center type-subhead font-semibold tabular-nums text-muted-foreground">{setIndex + 1}</span>
                                  <Input type="text" inputMode="decimal" enterKeyHint="next" placeholder={ex.load.replace(/\s*kg$/, "")} value={currentSet?.weight ?? ""} onChange={(e) => updateSetValue(setKey, "weight", e.target.value)} aria-label={`Peso de la serie ${setIndex + 1} de ${ex.name}`} className="px-1 text-center tabular-nums" />
                                  <Input type="number" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" min="0" placeholder={String(ex.reps)} value={currentSet?.reps ?? ""} onChange={(e) => updateSetValue(setKey, "reps", e.target.value)} aria-label={`Repeticiones de la serie ${setIndex + 1} de ${ex.name}`} className="px-1 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                                  <button type="button" aria-pressed={isDone} aria-label={`${isDone ? "Desmarcar" : "Marcar"} serie ${setIndex + 1} de ${ex.name}`}
                                    onClick={() => { const wasDone = isDone; void (wasDone ? hapticTap() : hapticImpact("medium")); toggleSet(ex.name, setIndex); if (!wasDone) setRest(90); }}
                                    className="flex h-11 w-11 items-center justify-center transition-transform duration-100 active:scale-90">
                                    <span className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 ${isDone ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/50"}`}>
                                      {isDone && <Check className="h-4 w-4" strokeWidth={3} />}
                                    </span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          {completed.length === totalSets && (
                            <p className="flex items-center justify-center gap-2 type-subhead font-semibold text-primary"><CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />Sesión de ejemplo completada · {totalSets} series</p>
                          )}
                          <div className="text-center">
                            <Button type="button" variant="plain" onClick={() => { void hapticTap(); resetWorkout(); }}>Reiniciar demo</Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {view === "nutrition" && (
                  <div>
                    <h1 className="type-large-title">{titles.nutrition}</h1>
                    <p className="mt-1 type-subhead text-muted-foreground">Hoy · plan {plans.plus ? plans.plusName : plans.coachName}</p>
                    <div className="mt-5 flex items-center gap-5">
                      <ProgressRing value={62} size={116} stroke={12} label="Calorías del día">
                        <div className="text-center">
                          <p className="font-rounded text-[28px] font-bold leading-none tabular-nums">1.420</p>
                          <p className="mt-1 type-caption1 text-muted-foreground">de 2.300 kcal</p>
                        </div>
                      </ProgressRing>
                      <div className="min-w-0">
                        <p className="type-headline">Quedan 880 kcal</p>
                        <p className="mt-1 type-subhead text-muted-foreground">Marca cada comida al hacerla.</p>
                      </div>
                    </div>
                    <div className="mt-6 flex gap-3">
                      <Lock className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="type-headline">{paidLabel}</p>
                        <p className="type-subhead text-muted-foreground">Función de pago</p>
                      </div>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-4">
                      {[["Proteína", 96, 150], ["Carbos", 150, 240], ["Grasas", 45, 75]].map(([l, v, t]) => (
                        <div key={l as string}>
                          <p className="type-footnote text-muted-foreground">{l}</p>
                          <p className="font-rounded type-title3 font-bold tabular-nums">{v}<span className="type-caption1 font-normal text-muted-foreground">/{t} g</span></p>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${((v as number) / (t as number)) * 100}%` }} /></div>
                        </div>
                      ))}
                    </div>
                    <ListGroup className="mt-6" header="Comidas de hoy">
                      {[["Desayuno", "Yogur, avena y fruta", true], ["Comida", "Arroz, pollo y verduras", true], ["Cena", "Tortilla, patata y ensalada", false]].map(([m, t, d]) => (
                        <ListRow
                          key={m as string}
                          leading={<span aria-hidden className={`flex h-7 w-7 items-center justify-center rounded-full ${d ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/50"}`}>{d && <Check className="h-4 w-4" strokeWidth={3} />}</span>}
                          title={<span className="font-semibold">{m as string}</span>}
                          subtitle={t as string}
                        />
                      ))}
                    </ListGroup>
                    <p className="mt-4 type-footnote text-muted-foreground">Comidas ilustrativas, sin recomendaciones para tu caso. Nutrición disponible desde Plus.</p>
                  </div>
                )}

                {view === "chat" && (
                  <div>
                    <h1 className="type-large-title">{titles.chat}</h1>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 type-subhead font-semibold"><Lock className="h-4 w-4 text-primary" aria-hidden="true" />Plan {plans.coachName}</span>
                      <span className="type-footnote text-muted-foreground">No incluido en Gratis</span>
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary type-subhead font-semibold text-primary">
                        <OwnerAvatar photo={owner.photo} initial={ownerInitial} />
                      </span>
                      <div className="min-w-0">
                        <p className="type-headline">{ownerFirst} · fundador</p>
                        <p className="type-footnote text-muted-foreground">Chat directo · plan {plans.coachName}</p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-2">
                      {chatMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-[18px] px-3.5 py-2 type-subhead ${m.from === "me" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary"}`}>
                            <p>{m.text}</p>
                            <p className={`mt-0.5 text-right type-caption2 tabular-nums ${m.from === "me" ? "opacity-70" : "text-muted-foreground"}`}>{m.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div aria-hidden className="mt-5 flex items-center gap-2 rounded-full bg-secondary py-1.5 pl-4 pr-1.5">
                      <span className="flex-1 type-subhead text-muted-foreground">Escribe a tu entrenador…</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><Send className="h-4 w-4" /></span>
                    </div>
                    <p className="mt-4 type-footnote text-muted-foreground">Conversación de ejemplo; en la app real hablas con tu entrenador.</p>
                  </div>
                )}

                {view === "progress" && (
                  <div>
                    <h1 className="type-large-title">{titles.progress}</h1>
                    <p className="mt-1 type-subhead text-muted-foreground">Tu progreso · muestra ficticia</p>
                    <div className="mt-5">
                      <PhoneWeek done={[0, 2]} today={4} />
                      <p className="mt-3 type-subhead"><span className="font-semibold">2 de 3 sesiones previstas</span> <span className="text-muted-foreground">· la rutina marca tus días</span></p>
                    </div>
                    <div className="relative mt-6">
                      <select
                        aria-label="Ejercicio para ver progresión en demo"
                        value={progressExercise}
                        onChange={(event) => setProgressExercise(event.target.value)}
                        className="min-h-11 w-full appearance-none truncate bg-transparent py-2 pr-8 type-title3 text-foreground"
                      >
                        {demoProgressExercises.map((name) => <option key={name} value={name}>{name}</option>)}
                      </select>
                      <ChevronsUpDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                    </div>
                    <div className="mt-2">
                      <Suspense fallback={<Skeleton className="h-36 w-full rounded-2xl" aria-label="Cargando gráfica" />}>
                        <ExerciseProgressChart
                          exerciseName={progressExercise}
                          history={demoHistory[progressExercise]}
                          metric={progressMetric}
                          onMetricChange={(m) => { if (m !== "reps") setProgressMetric(m); }}
                          compact
                        />
                      </Suspense>
                    </div>
                    {lastEntry && (
                      <div className="mt-6 grid grid-cols-2 gap-y-5">
                        {[
                          ["Series", lastEntry.completedSets],
                          ["Repeticiones", lastEntry.reps],
                          ["Volumen", `${Math.round(lastEntry.volumeKg)} kg`],
                          ["1RM estimado", `${lastEntry.bestEstimated1RmKg ?? "—"} kg`],
                        ].map(([label, value], i) => (
                          <div key={label} className={cn("min-w-0", i % 2 === 1 && "sep-l pl-4")}>
                            <p className="font-rounded type-headline font-bold tabular-nums">{value}</p>
                            <p className="type-caption1 text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <ListGroup className="mt-6" header="Récords personales">
                      {demoBestRecords.map(({ name, best }) => (
                        <ListRow key={name} title={<span className="font-semibold">{name}</span>} subtitle={`${best.bestSetLabel} · ~${best.bestEstimated1RmKg} kg`} />
                      ))}
                    </ListGroup>
                    <div className="mt-6 flex gap-3">
                      <Camera className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="type-headline">Fotos de progreso</p>
                        <p className="type-subhead text-muted-foreground">Documenta tu evolución con fotos de frente, lateral y espalda.</p>
                        {onFree && (
                          <Button type="button" variant="plain" onClick={() => { void hapticTap(); onFree(); }} className="-ml-4">
                            Crear cuenta para subir fotos
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="mt-4 type-footnote text-muted-foreground">Datos ficticios de ejemplo. En tu cuenta, las gráficas se construyen con tus propias series completadas.</p>
                  </div>
                )}
              </div>

              {view === "training" && rest !== null && (
                <div className="material absolute inset-x-8 bottom-[6rem] z-10 flex items-center justify-between rounded-full px-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]" role="timer" aria-label="Descanso">
                  <button type="button" onClick={() => { void hapticTap(); setRest((r) => Math.max(5, (r ?? 0) - 30)); }} className="h-11 rounded-full px-3 type-subhead font-semibold text-primary transition-opacity active:opacity-60">−30</button>
                  <span className="flex items-center gap-1.5 font-rounded type-headline font-bold tabular-nums"><Timer className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}</span>
                  <button type="button" onClick={() => { void hapticTap(); setRest((r) => (r ?? 0) + 30); }} className="h-11 rounded-full px-3 type-subhead font-semibold text-primary transition-opacity active:opacity-60">+30</button>
                </div>
              )}

              <PhoneTabBar tabs={shownViews} active={view} onSelect={(key) => changeView(key as View)} />
            </PhoneFrame>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-sm flex-col items-stretch gap-1 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-3">
          {onFree && <Button type="button" variant="tinted" size="lg" className="sm:px-10" onClick={() => { void hapticTap(); onFree(); }}>Crear mi propia rutina gratis</Button>}
          <Button type="button" variant="plain" size="lg" onClick={() => { void hapticTap(); onPlans(); }}>Ver qué incluye cada plan</Button>
        </div>
      </div>
    </section>
  );
}
