import { createRoot } from "react-dom/client";
import "@/index.css";
import HomeOverview from "@/app/components/dashboard/HomeOverview";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";
import type { DayPlan } from "@/shared/types/training";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const today = DAYS[(new Date().getDay() + 6) % 7];
const other = DAYS[(DAYS.indexOf(today) + 2) % 7];

const exercise = (name: string, series: number) => ({
  exercise_id: "",
  name,
  series,
  reps: 10,
  weight: "",
  rest: "90 s",
  image_url: BRAND_PHOTOS.gym,
});

const todayPlan: DayPlan = {
  day: today,
  type: "gimnasio",
  routine_name: "Full Body A",
  muscle_focus: "Pecho, espalda, piernas y core",
  exercises: [
    exercise("Press banca", 3),
    exercise("Remo con barra", 3),
    exercise("Sentadilla", 3),
    exercise("Press militar", 3),
    exercise("Jalón al pecho", 2),
    exercise("Curl de bíceps", 2),
    exercise("Extensión de tríceps", 2),
  ],
};

const dayPlans: DayPlan[] = [
  todayPlan,
  { day: other, type: "gimnasio", routine_name: "Full Body B", exercises: [] },
];

const App = () => {
  const state = new URLSearchParams(location.search).get("state") ?? "start";
  const done = state === "done";
  const rest = state === "rest";
  const plans = rest ? [{ ...todayPlan, day: other, exercises: [] }] : dayPlans;
  return (
  <div className="flex min-h-dvh bg-background text-foreground">
    {/* Barra lateral aproximada de la captura */}
    <aside className="hidden w-[265px] shrink-0 border-r-[0.5px] border-border md:block" />
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="app-chrome sticky top-0 z-50 flex h-14 items-center gap-3 border-b-[0.5px] px-4 lg:h-16 lg:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate type-headline lg:text-[18px]">Inicio</h1>
          </div>
          <p className="hidden truncate type-caption1 text-muted-foreground sm:block lg:text-[13px]">
            Tu entreno de hoy y lo que toca comer
          </p>
        </div>
      </header>
      <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 lg:pt-8">
        <div className="flex w-full flex-1 flex-col gap-3">
          <HomeOverview
            dayPlans={plans}
            meals={[]}
            nutrition
            profileName="Nicolás Pérez"
            macros={{ protein: 180, carbs: 220, fats: 70, calories: 2366 }}
            completedThisWeek={0}
            completedToday={done}
            onNavigate={() => {}}
          />
        </div>
      </main>
    </div>
  </div>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
