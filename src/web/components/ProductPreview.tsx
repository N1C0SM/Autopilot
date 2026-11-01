import { PublicBasicNutrition } from "@/web/components/PublicAppScreen";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import ScrollWords from "@/web/components/ScrollWords";
import { lazy, Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Apple, Check, CheckCircle2, ChevronsUpDown, Dumbbell, Home, ImageOff, Lock, MessageCircle,
  Send, Sparkles, Timer, Camera,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { ProgressRing } from "@/shared/components/ui/progress-ring";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { PhoneAppBar, PhoneFrame, PhoneHome, PhoneTabBar, PhoneWeek, demoWeek } from "@/web/components/PublicPhone";
import { euro, usePlanAvailability } from "@/shared/lib/planCatalog";
import { track } from "@/shared/lib/analytics";
import { buildExerciseHistory } from "@/shared/lib/workoutMetrics";
import { supabase } from "@/shared/integrations/supabase/client";
import { isIOSNative } from "@/shared/lib/platform";
import { hapticImpact, hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { fastImage } from "@/shared/lib/fastImage";

const ExerciseProgressChart = lazy(() => import("@/app/components/dashboard/ExerciseProgressChart"));

const views = [
  { key: "home", label: "Hoy", icon: Home },
  { key: "training", label: "Entrenar", icon: Dumbbell },
  { key: "nutrition", label: "Nutrición", icon: Apple },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "progress", label: "Progreso", icon: Sparkles },
] as const;
type View = (typeof views)[number]["key"];

const titles: Record<Exclude<View, "home">, string> = {
  training: "Entrenar",
  nutrition: "Nutrición",
  chat: "Nicolás",
  progress: "Progreso",
};

const exercises = [
  { name: "Sentadilla goblet", sets: 3, reps: 9, load: "20 kg", last: "Última vez: 18 kg × 10", image: fastImage("https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/14988835-a004-49d6-95c5-63978dbce978-1791475887313.png", 800) },
  { name: "Remo con mancuerna", sets: 3, reps: 11, load: "16 kg", last: "Última vez: 14 kg × 12", image: fastImage("https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/d5e30e05-0791-4886-84a0-7b2695728225-1791475865184.png", 800) },
  { name: "Press con mancuernas", sets: 3, reps: 9, load: "14 kg", last: "Última vez: 14 kg × 8", image: fastImage("https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png", 800) },
];

const DEMO_SHOTS: Record<View, string> = {
  home: "/app-shots/hoy.jpg",
  training: "/app-shots/registro.jpg",
  nutrition: "/app-shots/nutricion.jpg",
  chat: "/app-shots/hoy.jpg",
  progress: "/app-shots/progreso.jpg",
};

const baseSide: Record<View, { title: string; points: string[] }> = {
  home: {
    title: "Abres la app y sabes qué toca hoy.",
    points: ["Tu sesión de hoy y tu último récord en una pantalla.", "Empieza gratis y registra tus entrenamientos sin tarjeta.", "Con Plus, tus macros, tus comidas y tu scan completo."],
  },
  training: {
    title: "Cada serie, un toque.",
    points: ["Peso y repeticiones de cada serie, con foto de cada ejercicio.", "Supersets, calentamiento, bajadas, fallo y RPE.", "El tracker y el progreso están incluidos en el plan Gratis."],
  },
  nutrition: {
    title: "Tus macros y comidas, con Plus.",
    points: ["Calorías, proteína, carbohidratos y grasas para tu objetivo.", "Tus comidas de cada día según tus gustos y alergias.", "Incluido en Plus."],
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

const aiMessages: { from: "assistant" | "me"; text: string }[] = [
  { from: "me", text: "La máquina de remo está ocupada, ¿qué hago?" },
  { from: "assistant", text: "Haz remo con mancuerna: mismas 3 series de 11. Apoya la mano en el banco y tira hacia la cadera." },
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
  // Chat mirrors the app: Coach talks to Nicolás; with Coach hidden, Plus shows the AI assistant.
  const aiChat = !plans.coach;
  const shownViews = views.filter((v) => v.key !== "chat");
  useEffect(() => { if (view === "chat" && !plans.coach && !plans.plus) setView("home"); }, [view, plans.coach, plans.plus]);
  const paidLabel = [plans.plus && plans.plusName, plans.coach && plans.coachName].filter(Boolean).join(" y ") || "planes de pago";
  const side: Record<View, { title: string; points: string[] }> = {
    ...baseSide,
    home: { ...baseSide.home, points: [baseSide.home.points[0], baseSide.home.points[1], plans.campaign ? "Sobrecarga progresiva y objetivos nutricionales básicos, sin tarjeta." : baseSide.home.points[2]] },
    nutrition: baseSide.nutrition,
    chat: aiChat
      ? { title: "Pregunta lo que quieras de tu plan.", points: ["Dudas de técnica, alternativas de ejercicios o comidas.", "Responde un asistente con IA que conoce tu rutina y tus macros.", `Incluido en ${plans.plusName}; no forma parte de Gratis.`] }
      : { ...baseSide.chat, points: [baseSide.chat.points[0], baseSide.chat.points[1], `El chat personal es exclusivo del plan ${plans.coachName}.`] },
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
  const [progressTab, setProgressTab] = useState("evolution");
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
  const week = demoWeek();

  return (
    <section id="ver-app" aria-labelledby="preview-heading" className="scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="type-subhead text-primary">Antes de decidir</p>
            <h2 id="preview-heading" className="mt-1 type-title1 sm:text-[40px] sm:leading-[44px]"><ScrollWords text="Prueba cómo sería tu día." /></h2>
            <p className="mt-3 type-body text-muted-foreground">Así se ve la app por dentro: tu día, cada serie y tu progreso. Cambia de pantalla con las pestañas de la demo.</p>
          </div>
          <span className="hidden type-footnote text-muted-foreground sm:inline">Capturas reales de la app</span>
        </div>

        {/* Alineado arriba, no centrado: el texto arranca a la altura del teléfono en vez
            de quedar 400 px por debajo de la entradilla. */}
        <div className="grid items-start gap-10 md:grid-cols-[1fr_22rem] md:gap-16">
          <div className="order-2 md:order-1">
            <h3 className="type-title1">{side[view].title}</h3>
            <ul className="mt-6 space-y-4">
              {side[view].points.map(p => (
                <li key={p} className="flex items-start gap-3 type-body text-muted-foreground"><Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />{p}</li>
              ))}
            </ul>
            <p className="mt-6 max-w-md type-footnote text-muted-foreground">{`Capturas reales de la app. Gratis incluye rutina, registro, progreso, macros y scan básico${plans.plus ? `; ${plans.plusName} añade tus comidas y el scan completo por ${euro(plans.plusPrice)}/mes tras la prueba` : ""}.`}</p>
            {/* Las acciones viven con el texto, no en una fila suelta al pie de la sección. */}
            <div className="mt-8 flex max-w-md flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
              {onFree && <Button type="button" variant="tinted" size="lg" onClick={() => { void hapticTap(); onFree(); }}>Crear mi propia rutina gratis</Button>}
              <Button type="button" variant="plain" size="lg" onClick={() => { void hapticTap(); onPlans(); }}>{plans.campaign ? "Ver qué incluye Free" : "Ver qué incluye cada plan"}</Button>
            </div>
          </div>

          <div className="order-1 mx-auto flex w-full max-w-[22rem] flex-col md:order-2">
            {/* Capturas REALES de la app (public/app-shots); las pestañas de abajo cambian de pantalla. */}
            {/* La proporción del marco es la de las capturas (738×1645): no se corta la
                barra de la app. */}
            <PhoneFrame screenClassName="aspect-[738/1645]" chrome={false}>
              <img
                key={view}
                src={DEMO_SHOTS[view]}
                alt={`Pantalla ${view === "home" ? "Hoy" : titles[view as Exclude<View, "home">]} de la app Autopilot`}
                className="h-full w-full object-cover object-top motion-safe:animate-fade-in"
                decoding="async"
              />
              {/* Zonas táctiles sobre la barra dibujada en la captura: solo puntero, el control
                  accesible es el visible de abajo. */}
              <nav aria-hidden="true" className="absolute inset-x-3 bottom-4 z-10 hidden h-16 grid-cols-4 md:grid">
                {shownViews.map((v) => (
                  <button key={v.key} type="button" tabIndex={-1} onClick={() => changeView(v.key as View)} className="rounded-full" />
                ))}
              </nav>
            </PhoneFrame>

            {/* Control visible: las zonas táctiles sobre la barra del teléfono existían pero
                eran invisibles, así que la demo parecía una imagen fija. */}
            <div role="tablist" aria-label="Pantallas de la demo" className="order-first mb-4 grid grid-cols-4 gap-1 rounded-full bg-card p-1 md:order-last md:mb-0 md:mt-5">
              {shownViews.map((v) => (
                <button key={v.key} type="button" role="tab" aria-selected={view === v.key} onClick={() => changeView(v.key as View)}
                  className={cn(
                    "h-9 rounded-full type-footnote font-semibold transition-colors",
                    view === v.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
